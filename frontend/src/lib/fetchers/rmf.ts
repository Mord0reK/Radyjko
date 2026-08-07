import type { Station, SongInfo } from "@/lib/types";
import { mapToSongInfo } from "@/lib/fetchers/utils";

interface RmfTrack {
  order: number;
  title: string;
  author?: string;
  coverBigUrl?: string;
  coverUrl?: string;
  timestamp?: number;
  lenght?: string; // API typo: 'lenght' instead of 'length'
  length?: string;
}

/**
 * Extracts previous tracks (order < 0) from RMF API response.
 * Returns up to 5 most recent previous tracks, sorted by order ascending.
 * Pure function with no side effects.
 */
function extractPreviousTracks(
  data: RmfTrack[]
): Array<{ title: string; artist: string; cover?: string }> {
  return data
    .filter((track) => track.order < 0)
    .slice(-5) // Get last 5 (closest to current)
    .map((track) => ({
      title: track.title || "Unknown",
      artist: track.author || "Unknown",
      ...(track.coverBigUrl && { cover: track.coverBigUrl }),
      ...(track.coverUrl && !track.coverBigUrl && { cover: track.coverUrl }),
    }));
}

/**
 * Extracts next tracks (order > 0) from RMF API response.
 * Returns up to 5 upcoming tracks, sorted by order ascending.
 * Pure function with no side effects.
 */
function extractNextTracks(
  data: RmfTrack[]
): Array<{ title: string; artist: string }> {
  return data
    .filter((track) => track.order > 0)
    .slice(0, 5) // Get first 5 (closest to current)
    .map((track) => ({
      title: track.title || "Unknown",
      artist: track.author || "Unknown",
    }));
}

/**
 * Parses duration from RMF API response, handling the 'lenght' typo.
 * Returns duration in seconds or null if not available.
 * Pure function that handles both 'length' and 'lenght' fields.
 */
function parseDuration(track: RmfTrack): number | null {
  const durationStr = track.lenght || track.length;
  if (!durationStr) return null;
  const parsed = parseInt(durationStr, 10);
  return isNaN(parsed) ? null : parsed;
}

export async function fetchRmfData(
  stations: Station[]
): Promise<Record<string, SongInfo>> {
  const result: Record<string, SongInfo> = {};
  const rmfStations = stations.filter((s) => s.RmfID);

  await Promise.all(
    rmfStations.map(async (station) => {
      try {
         const response = await fetch(
           `https://api.rmfon.pl/stations/${station.RmfID}/playlist`,
           { cf: { cacheTtl: 10 } }
         ) as unknown as Response;
        const data = (await response.json()) as RmfTrack[];

        // Extract current track (order === 0)
        const currentTrack = data.find((item) => item.order === 0);
        if (currentTrack) {
          // Extract previous and next tracks
          const previousTracks = extractPreviousTracks(data);
          const nextTracks = extractNextTracks(data);

          // Normalize to SongInfo using utility function
          result[station.RmfID!] = mapToSongInfo({
            title: currentTrack.title,
            artist: currentTrack.author,
            cover: currentTrack.coverBigUrl || currentTrack.coverUrl,
            timestamp: currentTrack.timestamp
              ? currentTrack.timestamp * 1000
              : null,
            duration: parseDuration(currentTrack),
            previous: previousTracks.length > 0 ? previousTracks : undefined,
            next: nextTracks.length > 0 ? nextTracks : undefined,
          });
        }
      } catch {
        // Silently fail - errors tracked by withTimeout wrapper
      }
    })
  );

  return result;
}
