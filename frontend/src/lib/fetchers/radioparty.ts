import type { SongInfo } from "@/lib/types";
import { parseScheduleHTML, mapToSongInfo } from "@/lib/fetchers/utils";

/**
 * Determines today's day parameter for RadioParty API (0-6, where 0=Sunday).
 * Matches JavaScript's Date.getDay() format.
 *
 * @returns Day number 0-6
 */
function getCurrentDayParam(): number {
  const now = new Date();
  return now.getDay();
}

/**
 * Formats current time as HH:MM string for comparison with schedule times.
 *
 * @returns Current time in HH:MM format
 */
function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Checks if a given time falls within a schedule item's time range.
 * Compares time strings in HH:MM format.
 *
 * @param currentTime - Current time in HH:MM format
 * @param scheduleTime - Schedule start time in HH:MM format
 * @param scheduleTimeEnd - Schedule end time in HH:MM format (optional)
 * @returns true if currentTime is within the range
 */
function isTimeInRange(
  currentTime: string,
  scheduleTime: string,
  scheduleTimeEnd?: string
): boolean {
  // Simple string comparison works for HH:MM format
  if (currentTime < scheduleTime) return false;
  if (scheduleTimeEnd && currentTime >= scheduleTimeEnd) return false;
  return true;
}

/**
 * Finds the currently playing show from the schedule array.
 * Matches current time against schedule time ranges.
 *
 * @param schedule - Array of schedule items with time and timeEnd
 * @param currentTime - Current time in HH:MM format
 * @returns The current show item or null if no match found
 */
function findCurrentShow(
  schedule: Array<{
    time: string;
    timeEnd?: string;
    presenter: string;
    show?: string;
  }>,
  currentTime: string
): (typeof schedule)[number] | null {
  for (const item of schedule) {
    if (isTimeInRange(currentTime, item.time, item.timeEnd)) {
      return item;
    }
  }
  return null;
}

/**
 * Fetches RadioParty schedule and current show information.
 * Parses HTML schedule from get_ramowka.php API and identifies the currently playing show.
 *
 * @returns Record with station key "rp-kanalglowny" mapped to SongInfo, or null on failure
 */
export async function fetchRadioPartyData(): Promise<Record<string, SongInfo> | null> {
  try {
    const dayParam = getCurrentDayParam();

     const response = await fetch(
       `https://radioparty.pl/get_ramowka.php?kanal=glowny&day=${dayParam}`,
       {
         cf: { cacheTtl: 600 }, // Cache for 10 minutes
       } as RequestInit
     );

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Parse schedule using utility function
    // HTML structure: <div class="pozycja"> with nested divs for time, presenter, show
    const schedule = parseScheduleHTML(html, {
      items: "pozycja",
      time: "godz",
      presenter: "dj",
      show: "audycja",
    });

    if (schedule.length === 0) {
      return null;
    }

    // Find current show
    const currentTime = getCurrentTimeString();
    const currentShow = findCurrentShow(schedule, currentTime);

    // Build SongInfo with current show or fallback
    const songInfo = mapToSongInfo({
      title: currentShow?.show || "RadioParty",
      artist: currentShow?.presenter || "RadioParty.pl",
      presenter: currentShow?.presenter,
      schedule,
      timestamp: Date.now(),
    });

    return {
      "rp-kanalglowny": songInfo,
    };
  } catch {
    return null;
  }
}
