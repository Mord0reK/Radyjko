import type { SongInfo } from "@/lib/types";
import { extractTimeRange } from "@/lib/fetchers/utils";
import { getWarsawDateTime } from "@/lib/warsawTime";

interface RadioCmpScheduleItem {
  time: string;
  timeEnd?: string;
  presenter: string;
  show?: string;
  avatar?: string;
}

interface RadioCmpScheduleResult {
  schedule: RadioCmpScheduleItem[];
  notice?: string;
  currentShow: { presenter: string; show: string; avatar?: string } | null;
}

const DAY_NAMES = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getCurrentTimeString(): string {
  return getWarsawDateTime().time;
}

function timeToMinutes(timeStr: string): number | null {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return null;

  const hours = Number.parseInt(parts[0], 10);
  const minutes = Number.parseInt(parts[1], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

function isTimeInRange(currentTime: string, startTime: string, endTime?: string): boolean {
  const currentMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = endTime ? timeToMinutes(endTime) : null;

  if (currentMinutes === null || startMinutes === null) return false;
  if (endMinutes === null) return currentMinutes >= startMinutes;

  const normalizedEnd = endMinutes <= startMinutes ? 24 * 60 : endMinutes;
  return currentMinutes >= startMinutes && currentMinutes < normalizedEnd;
}

function findCurrentShow(schedule: RadioCmpScheduleItem[], currentTime: string): RadioCmpScheduleItem | null {
  for (const item of schedule) {
    if (isTimeInRange(currentTime, item.time, item.timeEnd)) return item;
  }

  return null;
}

function parseTitle(titleText: string): { presenter: string; show?: string } {
  const match = titleText.match(/^(.*?)\s+[–-]\s+(.*)$/);
  if (!match) return { presenter: titleText };

  return {
    presenter: normalizeWhitespace(match[1]),
    show: normalizeWhitespace(match[2]),
  };
}

function extractDaySection(html: string, dayName: string): string | null {
  const marker = `id="${dayName}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const afterMarker = html.slice(markerIndex);
  const nextPaneIndex = afterMarker.indexOf('<div class="tab-pane');
  const section = nextPaneIndex > 0 ? afterMarker.slice(0, nextPaneIndex) : afterMarker;
  return section;
}

function parseScheduleSection(section: string): { schedule: RadioCmpScheduleItem[]; notice?: string } {
  const schedule: RadioCmpScheduleItem[] = [];
  const items = section.match(/<div class="srodek ramowka">[\s\S]*?<\/div>\s*<\/div>/g) || [];

  for (const item of items) {
    const timeMatch = item.match(/<b class="icon-clock">([\s\S]*?)<\/b>/);
    const titleMatch = item.match(/<div class="ramowka-title">([\s\S]*?)<\/div>/);
    const avatarMatch = item.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/);

    const timeText = normalizeWhitespace(stripTags(timeMatch?.[1] ?? "")).replace(/\s*[–-]\s*/g, "-");
    const titleText = normalizeWhitespace(stripTags(titleMatch?.[1] ?? ""));
    if (!timeText || !titleText) continue;

    const timeRange = extractTimeRange(timeText);
    if (!timeRange) continue;

    const parsedTitle = parseTitle(titleText);
    schedule.push({
      ...timeRange,
      presenter: parsedTitle.presenter,
      ...(parsedTitle.show ? { show: parsedTitle.show } : {}),
      ...(avatarMatch?.[1] ? { avatar: avatarMatch[1] } : {}),
    });
  }

  if (schedule.length > 0) return { schedule };

  const noticeMatch = section.match(/<div class="news-box icon-clock">([\s\S]*?)<\/div>/);
  const notice = normalizeWhitespace(stripTags(noticeMatch?.[1] ?? ""));
  return { schedule, ...(notice ? { notice } : {}) };
}

function parseRadioCmpSchedule(html: string, day: number): RadioCmpScheduleResult | null {
  const dayName = DAY_NAMES[day];
  if (!dayName) return null;

  const section = extractDaySection(html, dayName);
  if (!section) {
    const fallbackNoticeMatch = html.match(/autopilot gra najlepsze klubowe brzmienia/i);
    return fallbackNoticeMatch ? { schedule: [], notice: fallbackNoticeMatch[0], currentShow: null } : null;
  }

  const { schedule, notice } = parseScheduleSection(section);
  let currentShow: { presenter: string; show: string; avatar?: string } | null = null;

  if (day === getWarsawDateTime().day && schedule.length > 0) {
    const currentItem = findCurrentShow(schedule, getCurrentTimeString());
    if (currentItem) {
      currentShow = {
        presenter: currentItem.presenter,
        show: currentItem.show || "Radio CMP",
        ...(currentItem.avatar ? { avatar: currentItem.avatar } : {}),
      };
    }
  }

  return { schedule, notice, currentShow };
}

export async function fetchRadioCmpScheduleForDay(day: number): Promise<RadioCmpScheduleResult | null> {
  try {
    const response = await fetch("https://radiocmp3.eu/_spa?site=ramowka", {
      cf: { cacheTtl: 600 },
    } as RequestInit);

    if (!response.ok) return null;

    const html = await response.text();
    return parseRadioCmpSchedule(html, day);
  } catch {
    return null;
  }
}

export async function fetchRadioCmpData(): Promise<Record<string, SongInfo> | null> {
  try {
    const data = await fetchRadioCmpScheduleForDay(getWarsawDateTime().day);
    if (!data) return null;

    const songInfo: SongInfo = data.currentShow
      ? {
          title: data.currentShow.show,
          artist: data.currentShow.presenter,
          presenter: data.currentShow.presenter,
          cover: data.currentShow.avatar,
          schedule: data.schedule,
          timestamp: Date.now(),
        }
      : {
          title: "",
          artist: "",
          schedule: data.schedule,
          timestamp: Date.now(),
        };

    return {
      "radio-cmp": songInfo,
    };
  } catch {
    return null;
  }
}
