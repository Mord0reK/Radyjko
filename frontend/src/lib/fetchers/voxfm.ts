import type { SongInfo, Station } from "@/lib/types";

/**
 * VoxFM API track response format
 * 
 * Example:
 * {
 *   media_id: 141017,
 *   artists: ["Loreen"],
 *   image: "https://cdn.music.smcloud.net/t/covers/...",
 *   thumb: "https://cdn.music.smcloud.net/t/covers/.../100x100.jpg",
 *   name: "Euphoria",
 *   start_time: "2026-04-23T13:27:43+00:00",
 *   end_time: null,
 *   uid: "pb-pmp9-5C3G-DSc9",
 *   is_published: true
 * }
 */
interface VoxFMTrack {
  media_id: number;
  artists: string[];
  image?: string | null;
  thumb?: string | null;
  name: string;
  start_time: string;
  end_time?: string | null;
  uid: string;
  is_published: boolean;
}

/**
 * Extracts VoxFM station ID from the station URL.
 * Pattern: https://liveradio.timesa.pl/{ID}-1.aac/...
 * 
 * Examples:
 * - "https://liveradio.timesa.pl/3990-1.aac/playlist.m3u8" → "3990"
 * - "https://liveradio.timesa.pl/6100-1.aac/chunklist.m3u8" → "6100"
 */
function extractVoxFMId(url: string): string | null {
  const match = url.match(/\/(\d+)-/);
  return match ? match[1] : null;
}

/**
 * Extracts artist names from the API response.
 * Returns the first artist or empty string as fallback.
 */
function extractArtistName(artists: string[]): string {
  if (!artists || artists.length === 0) return "";
  return artists[0] || "";
}

/**
 * Maps VoxFM API tracks to SongInfo with current/previous/next.
 * 
 * API Logic:
 * - Tracks with end_time !== null: Already finished playing (history)
 * - Tracks with end_time === null: Currently playing or scheduled for playback (next)
 * 
 * Current track identification:
 * - Current = track with end_time === null and MINIMUM start_time (already started)
 * - This represents the track actively playing right now
 * - If no scheduled tracks exist, fallback to track with highest end_time
 * 
 * Data structure:
 * - current: { title, artist, cover, timestamp }
 * - previous: [{ title, artist, cover }, ...] (DESC by end_time)
 * - next: [{ title, artist }, ...] (ASC by start_time, excluding current)
 */
function processTracks(tracks: VoxFMTrack[]): SongInfo | null {
  if (!tracks || tracks.length === 0) return null;

  // Separate finished and scheduled tracks
  const finished = tracks.filter((t) => t.end_time !== null);
  const scheduled = tracks.filter((t) => t.end_time === null);

  // Current track = scheduled track with minimum start_time (already started, now playing)
  const currentTrack = scheduled.length > 0
    ? scheduled.sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )[0]
    : finished.length > 0 // Fallback: if nothing scheduled, use most recently finished
    ? finished.sort(
        (a, b) =>
          new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime()
      )[0]
    : null;

  if (!currentTrack) return null;

  // Previous tracks = finished tracks (DESC by end_time)
  const previous = finished
    .sort(
      (a, b) =>
        new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime()
    )
    .map((t) => {
      const cover = t.image || t.thumb;
      return {
        title: t.name,
        artist: extractArtistName(t.artists),
        ...(cover && { cover }),
      };
    });

  // Next tracks = scheduled tracks except current (ASC by start_time)
  const next = scheduled
    .filter((t) => t.uid !== currentTrack.uid)
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )
    .map((t) => {
      const cover = t.image || t.thumb;
      return {
        title: t.name,
        artist: extractArtistName(t.artists),
        ...(cover && { cover }),
      };
    });

  const currentCover = currentTrack.image || currentTrack.thumb;
  return {
    title: currentTrack.name,
    artist: extractArtistName(currentTrack.artists),
    ...(currentCover && { cover: currentCover }),
    timestamp: Math.floor(
      new Date(currentTrack.start_time).getTime() / 1000
    ),
    ...(previous.length > 0 && { previous }),
    ...(next.length > 0 && { next }),
  };
}

/**
 * Fetches now-playing data from the new VoxFM API endpoint.
 * 
 * New endpoint: https://front-api.grupazprmedia.pl/music/v1/now_playing/{stationId}/
 * Station ID is extracted from stream URL (e.g., 3990 from liveradio.timesa.pl/3990-1.aac/...)
 * 
 * Data processing:
 * - Current track: track with end_time === null (actively playing)
 * - Previous tracks: tracks with end_time !== null (already finished)
 * - Next tracks: tracks with end_time === null except current
 * - Each track includes cover art (image > thumb fallback)
 * 
 * Supports all VoxFM variants:
 * - VOX FM (3990): Fetches tracks from API
 * - VOX FM - Best Lista (6100): Fetches tracks from API
 * - VOX FM - DJ Mix (6020): Returns static "Mix" by "DJ Charis" (continuous DJ set)
 */
export async function fetchVoxFMData(
  stations: Station[]
): Promise<Record<string, SongInfo>> {
  const result: Record<string, SongInfo> = {};
  const voxStations = stations.filter(
    (s) => s.shortName?.toLowerCase().includes("voxfm")
  );

  await Promise.all(
    voxStations.map(async (station) => {
      const stationId = extractVoxFMId(station.url);

      if (!stationId) {
        console.error(
          `[VoxFM] Station ${station.shortName}: Could not extract station ID from URL: ${station.url}`
        );
        return;
      }

      // Special case: DJ Mix station always plays a continuous set
      if (station.shortName === "voxfm-djmix") {
        result[stationId] = {
          title: "Mix",
          artist: "DJ Charis",
          cover: null,
        };
        return;
      }

      try {
        const response = await fetch(
          `https://front-api.grupazprmedia.pl/music/v1/now_playing/${stationId}/`,
          { cf: { cacheTtl: 10 } }
        );

        if (!response.ok) {
          console.error(
            `[VoxFM] Station ${station.shortName} (ID: ${stationId}): HTTP ${response.status}`
          );
          return;
        }

        const tracks = (await response.json()) as VoxFMTrack[];

        if (!tracks || tracks.length === 0) {
          return;
        }

        // Process tracks: identify current, previous, and next
        const songInfo = processTracks(tracks);
        if (songInfo) {
          result[stationId] = songInfo;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[VoxFM] Station ${station.shortName} (ID: ${stationId}): Error - ${errorMessage}`
        );
        // Graceful degradation: continue processing other stations
      }
    })
  );

  return result;
}
