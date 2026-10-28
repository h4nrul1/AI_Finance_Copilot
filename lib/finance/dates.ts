import type { Frequency } from "@/types/finance";

export function asDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

/** Today's date in the user's own time zone, as YYYY-MM-DD. */
export function localToday(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function daysBetween(start: string, end: string) {
  const ms = asDate(end).getTime() - asDate(start).getTime();
  // Round, not ceil: a daylight-saving change makes a span of whole days an hour longer or shorter.
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function weeksBetween(start: string, end: string) {
  return Math.max(1, daysBetween(start, end) / 7);
}

export function eachWeek(start: string, end: string) {
  const dates: string[] = [];
  let cursor = asDate(start);
  const finish = asDate(end);

  while (cursor <= finish) {
    dates.push(toISODate(cursor));
    cursor = addDays(cursor, 7);
  }

  if (dates[dates.length - 1] !== end) {
    dates.push(end);
  }

  return dates;
}

export function expandRecurringDates(start: string, end: string, frequency: Frequency, windowStart: string, windowEnd: string) {
  const dates: string[] = [];
  let cursor = asDate(start);
  const finish = asDate(end);
  const min = asDate(windowStart);
  const max = asDate(windowEnd);

  while (cursor <= finish && cursor <= max) {
    if (cursor >= min) {
      dates.push(toISODate(cursor));
    }
    if (frequency === "weekly") cursor = addDays(cursor, 7);
    if (frequency === "biweekly") cursor = addDays(cursor, 14);
    if (frequency === "monthly") cursor = addMonths(cursor, 1);
  }

  return dates;
}
