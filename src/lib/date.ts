/**
 * Centralised date/period helpers. All month math lives here so screens never
 * compute "this month" boundaries differently (a CLAUDE.md rule). Months are 1-indexed.
 */

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'YYYY-MM' month key used throughout storage, records buckets and budgets. */
export function monthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

/** Days in a 1-indexed month (leap-year aware). `new Date(y, month, 0)` = last day of prev month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Weekday (0=Sun .. 6=Sat) of the 1st — for calendar-grid leading offset. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** Short Korean weekday label, e.g. '월'. */
export function weekdayLabel(year: number, month: number, day: number): string {
  return WEEKDAYS_KO[new Date(year, month - 1, day).getDay()];
}

/** Long Korean weekday label, e.g. '월요일'. */
export function weekdayLabelLong(year: number, month: number, day: number): string {
  return `${weekdayLabel(year, month, day)}요일`;
}

export function currentYear(now: Date = new Date()): number {
  return now.getFullYear();
}

export function currentMonth(now: Date = new Date()): number {
  return now.getMonth() + 1;
}

/** 'YYYY-MM' for the current month — drives the "first entry of the month" budget prompt. */
export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(now.getFullYear(), now.getMonth() + 1);
}

export function isToday(
  year: number,
  month: number,
  day: number,
  now: Date = new Date(),
): boolean {
  return year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();
}
