import type { SongInfo } from "@/lib/types";

/**
 * Normalizes raw API response data into a standardized SongInfo object.
 * Pure function that handles null/undefined values gracefully.
 *
 * @param data - Raw data object with optional song metadata fields
 * @returns Normalized SongInfo object with required fields and optional metadata
 *
 * @example
 * mapToSongInfo({
 *   title: "Song Title",
 *   artist: "Artist Name",
 *   cover: "https://example.com/cover.jpg",
 *   duration: 180
 * })
 * // Returns: { title: "Song Title", artist: "Artist Name", cover: "...", duration: 180 }
 */
export function mapToSongInfo(data: {
  title?: string | null;
  artist?: string | null;
  cover?: string | null;
  duration?: number | string | null;
  timestamp?: number | null;
  presenter?: string | null;
  next?: Array<{ title: string; artist: string }>;
  previous?: Array<{ title: string; artist: string; cover?: string }>;
  schedule?: Array<{
    time: string;
    timeEnd?: string;
    presenter: string;
    show?: string;
    isBreak?: boolean;
  }>;
}): SongInfo {
  // Normalize duration: convert string to number if needed
  const normalizedDuration =
    typeof data.duration === "string" ? parseInt(data.duration, 10) : data.duration;

  return {
    title: data.title || "Unknown",
    artist: data.artist || "Unknown",
    ...(data.cover && { cover: data.cover }),
    ...(normalizedDuration && { duration: normalizedDuration }),
    ...(data.timestamp && { timestamp: data.timestamp }),
    ...(data.presenter && { presenter: data.presenter }),
    ...(data.next && data.next.length > 0 && { next: data.next }),
    ...(data.previous && data.previous.length > 0 && { previous: data.previous }),
    ...(data.schedule && data.schedule.length > 0 && { schedule: data.schedule }),
  };
}

/**
 * Parses time range strings in various formats into structured time objects.
 * Handles formats like "09:30-10:45", "09:30", and returns null for invalid input.
 *
 * @param timeStr - Time string to parse (e.g., "09:30-10:45" or "09:30")
 * @returns Object with time and optional timeEnd, or null if parsing fails
 *
 * @example
 * extractTimeRange("09:30-10:45")
 * // Returns: { time: "09:30", timeEnd: "10:45" }
 *
 * extractTimeRange("09:30")
 * // Returns: { time: "09:30" }
 *
 * extractTimeRange("invalid")
 * // Returns: null
 */
export function extractTimeRange(
  timeStr: string
): { time: string; timeEnd?: string } | null {
  if (!timeStr || typeof timeStr !== "string") {
    return null;
  }

  const trimmed = timeStr.trim();

  // Match pattern: HH:mm or HH:mm-HH:mm
  const timePattern = /^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?$/;
  const match = trimmed.match(timePattern);

  if (!match) {
    return null;
  }

  const startHour = match[1].padStart(2, "0");
  const startMin = match[2];
  const time = `${startHour}:${startMin}`;

  // If end time is present
  if (match[3] && match[4]) {
    const endHour = match[3].padStart(2, "0");
    const endMin = match[4];
    const timeEnd = `${endHour}:${endMin}`;
    return { time, timeEnd };
  }

  return { time };
}

/**
 * Generic HTML parser for extracting schedule data using regex patterns.
 * Pure function that safely parses HTML and extracts structured schedule information.
 * Searches for all nested elements with matching class selectors rather than
 * trying to extract item blocks first (handles nested HTML better).
 *
 * @param html - HTML string to parse
 * @param selectors - Object containing CSS class selectors for items, time, presenter, and show
 * @returns Array of schedule objects with time, presenter, and optional show information
 *
 * @example
 * parseScheduleHTML(htmlString, {
 *   items: "schedule-item",
 *   time: "time",
 *   presenter: "presenter",
 *   show: "show-name"
 * })
 * // Returns: [{ time: "09:30", timeEnd: "10:45", presenter: "John Doe", show: "Morning Show" }, ...]
 */
export function parseScheduleHTML(
  html: string,
  selectors: {
    items: string;
    time: string;
    presenter: string;
    show: string;
  }
): Array<{
  time: string;
  timeEnd?: string;
  presenter: string;
  show?: string;
}> {
  if (!html || typeof html !== "string") {
    return [];
  }

  try {
    const schedule: Array<{
      time: string;
      timeEnd?: string;
      presenter: string;
      show?: string;
    }> = [];

    // Strategy: Find all item elements, extract their innerHTML, then search for nested elements
    // This avoids complex nested element regex patterns

    // Find all items - match opening tag with items class
    const itemOpenPattern = new RegExp(
      `<[^>]*class=['"]\\s*[^'"]*\\b${selectors.items}\\b[^'"]*['"]\\s*[^>]*>`,
      "g"
    );

    let itemOpenMatch;
    const itemMatches: Array<{ startIndex: number; text: string }> = [];

    while ((itemOpenMatch = itemOpenPattern.exec(html)) !== null) {
      itemMatches.push({
        startIndex: itemOpenMatch.index,
        text: itemOpenMatch[0],
      });
    }

    // For each item opening tag, find its corresponding closing tag
    for (let i = 0; i < itemMatches.length; i++) {
      const startIndex = itemMatches[i].startIndex;
      const nextItemIndex =
        i + 1 < itemMatches.length ? itemMatches[i + 1].startIndex : html.length;

      // Extract content between item opening and next item or end
      const itemContent = html.substring(startIndex, nextItemIndex);

      // Extract time, presenter, and show from this item block
      const timePattern = new RegExp(
        `<[^>]*class=['"]\\s*[^'"]*\\b${selectors.time}\\b[^'"]*['"]\\s*[^>]*>([^<]+)<\\/[^>]+>`
      );
      const presenterPattern = new RegExp(
        `<[^>]*class=['"]\\s*[^'"]*\\b${selectors.presenter}\\b[^'"]*['"]\\s*[^>]*>([^<]+)<\\/[^>]+>`
      );
      const showPattern = new RegExp(
        `<[^>]*class=['"]\\s*[^'"]*\\b${selectors.show}\\b[^'"]*['"]\\s*[^>]*>([^<]+)<\\/[^>]+>`
      );

      const timeMatch = itemContent.match(timePattern);
      const presenterMatch = itemContent.match(presenterPattern);
      const showMatch = itemContent.match(showPattern);

      const timeText = timeMatch?.[1]?.trim();
      const presenterText = presenterMatch?.[1]?.trim();
      const showText = showMatch?.[1]?.trim();

      // Only add if we have at least time and presenter
      if (timeText && presenterText) {
        const timeRange = extractTimeRange(timeText);
        if (timeRange) {
          schedule.push({
            ...timeRange,
            presenter: presenterText,
            ...(showText && { show: showText }),
          });
        }
      }
    }

    return schedule;
  } catch {
    // Return empty array on parsing errors
    return [];
  }
}
