export async function fetchOpenFMData(): Promise<Record<string, { title: string; artist: string; next?: Array<{ title: string; artist: string }> }>> {
  try {
    const response = await fetch("https://open.fm/api/radio/playlist", {
      cf: { cacheTtl: 10 },
    });
    const data = (await response.json()) as Record<string, { currentSong?: { title?: string; artist?: string }; playlist?: Array<{ title?: string; artist?: string }> }>;
    const result: Record<string, { title: string; artist: string; next?: Array<{ title: string; artist: string }> }> = {};
    for (const [stationId, stationData] of Object.entries(data)) {
      const sd = stationData as { currentSong?: { title?: string; artist?: string }; playlist?: Array<{ title?: string; artist?: string }> };
      if (sd?.currentSong) {
        const songData: { title: string; artist: string; next?: Array<{ title: string; artist: string }> } = {
          title: sd.currentSong.title || "",
          artist: sd.currentSong.artist || "",
        };
        if (sd.playlist && Array.isArray(sd.playlist)) {
          songData.next = sd.playlist.map((track) => ({
            title: track.title || "",
            artist: track.artist || "",
          }));
        }
        result[stationId] = songData;
      }
    }
    return result;
  } catch {
    return {};
  }
}
