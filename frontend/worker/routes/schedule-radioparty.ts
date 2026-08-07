export interface RadioPartyScheduleResult {
  schedule: Array<{ time: string; timeEnd?: string; presenter: string; show?: string }>;
  currentShow: { presenter: string; show: string } | null;
}

export type FetchRadioPartySchedule = (day: number) => Promise<RadioPartyScheduleResult | null>;

function isTimeInRange(current: string, start: string, end?: string): boolean {
  if (!end) return current >= start;
  if (end <= start) return current >= start || current < end;
  return current >= start && current < end;
}

async function fetchRadioPartyScheduleForDay(day: number): Promise<RadioPartyScheduleResult | null> {
  try {
    const response = await fetch(
      `https://radioparty.pl/get_ramowka.php?kanal=glowny&day=${day}`,
      { cf: { cacheTtl: 600 } } as RequestInit,
    );
    if (!response.ok) return null;

    const schedule = parseScheduleHTML(await response.text(), {
      items: "pozycja",
      time: "godz",
      presenter: "dj",
      show: "audycja",
    });
    if (schedule.length === 0) return null;

    let currentShow: RadioPartyScheduleResult["currentShow"] = null;
    const warsaw = getWarsawDateTime();
    if (day === warsaw.day) {
      const item = schedule.find((entry) =>
        isTimeInRange(warsaw.time, entry.time, entry.timeEnd));
      if (item) {
        currentShow = {
          presenter: item.presenter,
          show: item.show || "Unknown Show",
        };
      }
    }

    return { schedule, currentShow };
  } catch {
    return null;
  }
}

export async function getRadioPartySchedule(
  request: Request,
  fetchSchedule: FetchRadioPartySchedule = fetchRadioPartyScheduleForDay,
): Promise<Response> {
  try {
    const dayParam = new URL(request.url).searchParams.get("day");
    let day = getWarsawDateTime().day;
    if (dayParam !== null) {
      const parsed = Number.parseInt(dayParam, 10);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 6) {
        return corsResponse(JSON.stringify({
          error: "Invalid day parameter. Must be 0-6 (0=Sunday)",
        }), 400);
      }
      day = parsed;
    }

    const data = await fetchSchedule(day);
    if (!data) {
      return corsResponse(JSON.stringify({ error: "Failed to fetch schedule" }), 500);
    }

    return corsResponse(JSON.stringify({
      success: true,
      day,
      schedule: data.schedule,
      currentShow: data.currentShow,
    }), 200, { "Cache-Control": "public, max-age=600" });
  } catch (error) {
    console.error("RadioParty schedule endpoint error:", error);
    return corsResponse(JSON.stringify({ error: "Internal server error" }), 500);
  }
}
import { corsResponse } from "@/lib/cors";
import { parseScheduleHTML } from "@/lib/fetchers/utils";
import { getWarsawDateTime } from "@/lib/warsawTime";
