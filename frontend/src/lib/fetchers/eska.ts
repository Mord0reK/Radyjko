import type { SongInfo, Station } from "@/lib/types";

/**
 * Fetches now-playing data from Eska player API.
 *
 * API endpoint: https://player.eska.pl/api/mobile/station/{EskaID}/now_playing/
 * Graceful degradation: empty arrays don't break the app, just skip that station.
 */
export async function fetchEskaData(
  stations: Station[]
): Promise<Record<string, SongInfo>> {
  const result: Record<string, SongInfo> = {};
  const eskaStations = stations.filter((s) => s.EskaID);

  await Promise.all(
    eskaStations.map(async (station) => {
      try {
        const response = await fetch(
          `https://player.eska.pl/api/mobile/station/${station.EskaID}/now_playing/`,
          { cf: { cacheTtl: 10 } }
        );

        const data = (await response.json()) as Array<{
          start_time: string;
          end_time?: string;
          name: string;
          uid: string;
          artists?: Array<{ name?: string }>;
          image?: string;
          thumb?: string;
        }>;

        if (Array.isArray(data) && data.length === 0) {
          return;
        }

        // Separate finished (have end_time) and scheduled (still playing/upcoming) tracks
        const finished = data.filter((t) => t.end_time != null);
        const scheduled = data.filter((t) => t.end_time == null);

        // Current track = scheduled with earliest start_time (already started, still playing)
        // Fallback = most recently finished track
        const currentTrack =
          scheduled.length > 0
            ? scheduled.sort(
                (a, b) =>
                  new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              )[0]
            : finished.length > 0
              ? finished.sort(
                  (a, b) =>
                    new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime()
                )[0]
              : null;

        if (currentTrack) {
          // Previous tracks = finished (DESC by end_time)
          const previous = finished
            .sort(
              (a, b) =>
                new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime()
            )
            .map((t) => ({
              title: t.name,
              artist: t.artists?.[0]?.name || "",
              ...((t.image || t.thumb) && { cover: t.image || t.thumb }),
            }));

          // Next tracks = scheduled except current (ASC by start_time)
          const next = scheduled
            .filter((t) => t.uid !== currentTrack.uid)
            .sort(
              (a, b) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            )
            .map((t) => ({
              title: t.name,
              artist: t.artists?.[0]?.name || "",
              ...((t.image || t.thumb) && { cover: t.image || t.thumb }),
            }));

          result[station.EskaID!] = {
            title: currentTrack.name,
            artist: currentTrack.artists?.[0]?.name || "",
            cover: currentTrack.image || currentTrack.thumb || null,
            timestamp: Math.floor(
              new Date(currentTrack.start_time).getTime() / 1000
            ),
            ...(previous.length > 0 && { previous }),
            ...(next.length > 0 && { next }),
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Eska] Station ${station.EskaID}: Error - ${errorMessage}`);
      }
    })
  );

  return result;
}
