import { corsResponse } from "@/lib/cors";
import { fetchRadioCmpScheduleForDay } from "@/lib/fetchers/radiocmp";
import { getWarsawDateTime } from "@/lib/warsawTime";

export async function getRadioCmpSchedule(
  request: Request,
  fetchSchedule: typeof fetchRadioCmpScheduleForDay = fetchRadioCmpScheduleForDay,
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
      notice: data.notice,
      currentShow: data.currentShow,
    }), 200, { "Cache-Control": "public, max-age=600" });
  } catch (error) {
    console.error("Radio CMP schedule endpoint error:", error);
    return corsResponse(JSON.stringify({ error: "Internal server error" }), 500);
  }
}
