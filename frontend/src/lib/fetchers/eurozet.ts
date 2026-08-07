import type { SongInfo } from "@/lib/types";
import { mapToSongInfo } from "@/lib/fetchers/utils";

/**
 * Parses Eurozet API response and extracts song metadata.
 * Handles JSONP callback removal and converts API fields to SongInfo format.
 *
 * @param text - Raw API response text (may include JSONP callback)
 * @returns Parsed song data with title, artist, cover, duration, and timestamp
 */
function parseEurozetResponse(text: string): {
  title?: string;
  artist?: string;
  cover?: string;
  duration?: number;
  timestamp?: number;
} | null {
  try {
    // Remove JSONP callback wrapper if present
    const json = text.replace(/^rdsData\(/, "").replace(/\)$/, "");
    const data = JSON.parse(json);

    if (!data?.now) {
      return null;
    }

    const now = data.now;

    // Parse duration: convert string to number
    const duration = now.duration ? parseInt(now.duration, 10) : undefined;

    // Parse startDate: convert "2026-04-19 10:47:42" to Unix timestamp (ms)
    const timestamp = now.startDate ? new Date(now.startDate).getTime() : undefined;

    return {
      title: now.title,
      artist: now.artist,
      cover: now.img, // Map 'img' field to 'cover'
      duration: isNaN(duration || 0) ? undefined : duration,
      timestamp: isNaN(timestamp || 0) ? undefined : timestamp,
    };
  } catch {
    return null;
  }
}

export async function fetchEurozetData(): Promise<Record<string, SongInfo>> {
  const result: Record<string, SongInfo> = {};
  const endpoints = [
    { key: "radiozet", url: "https://rds.eurozet.pl/reader/var/radiozet.json?callback=rdsData" },
    { key: "zetdance", url: "https://rds.eurozet.pl/reader/var/zetdan_new.json" },
    { key: "meloradio", url: "https://rds.eurozet.pl/reader/var/zetgold.json?callback=rdsData" },
    { key: "antyradio", url: "https://rds.eurozet.pl/reader/var/antyradio.json?callback=rdsData" },
  ];

  await Promise.all(
    endpoints.map(async ({ key, url }) => {
       try {
         const response = await fetch(url, {
           cf: { cacheTtl: 10 },
         } as RequestInit);
        const text = await response.text();
        const parsed = parseEurozetResponse(text);

        if (parsed) {
          result[key] = mapToSongInfo({
            title: parsed.title,
            artist: parsed.artist,
            cover: parsed.cover,
            duration: parsed.duration,
            timestamp: parsed.timestamp,
          });
        }
      } catch {
        // Silently fail - failures tracked by withTimeout wrapper
      }
    })
  );

  return result;
}
