const WARSAW_TIME_ZONE = "Europe/Warsaw";

const WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface WarsawDateTime {
  day: number;
  time: string;
}

export function getWarsawDateTime(date = new Date()): WarsawDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WARSAW_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = WEEKDAY_TO_NUMBER[values.weekday];

  if (day === undefined || !values.hour || !values.minute) {
    throw new Error("Failed to determine current time in Europe/Warsaw");
  }

  return {
    day,
    time: `${values.hour}:${values.minute}`,
  };
}
