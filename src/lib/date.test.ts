import { describe, expect, it } from 'vitest';

import {
  currentMonthKey,
  daysInMonth,
  firstWeekdayOfMonth,
  isToday,
  monthKey,
  parseMonthKey,
  toKst,
  weekdayLabel,
} from '@/lib/date';

describe('date', () => {
  it('monthKey zero-pads the month', () => {
    expect(monthKey(2026, 7)).toBe('2026-07');
    expect(monthKey(2026, 12)).toBe('2026-12');
  });

  it('parseMonthKey round-trips', () => {
    expect(parseMonthKey('2026-07')).toEqual({ year: 2026, month: 7 });
  });

  it('daysInMonth is leap-year aware', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 7)).toBe(31);
  });

  it('firstWeekdayOfMonth / weekdayLabel (2000-01-01 was a Saturday)', () => {
    expect(firstWeekdayOfMonth(2000, 1)).toBe(6);
    expect(weekdayLabel(2000, 1, 1)).toBe('토');
  });

  it('currentMonthKey / isToday use the injected clock', () => {
    const now = new Date(2026, 6, 5); // 2026-07-05 (month is 0-indexed in Date)
    expect(currentMonthKey(now)).toBe('2026-07');
    expect(isToday(2026, 7, 5, now)).toBe(true);
    expect(isToday(2026, 7, 6, now)).toBe(false);
  });
});

describe('toKst (KST = UTC+9, no DST)', () => {
  it('renders a UTC instant as KST wall-clock with a +09:00 suffix', () => {
    expect(toKst('2026-07-16T00:00:00.000Z')).toBe('2026-07-16 09:00:00+09:00');
  });

  it('rolls the date forward when +9h crosses midnight', () => {
    expect(toKst('2026-07-16T20:30:00.000Z')).toBe('2026-07-17 05:30:00+09:00');
  });

  it('accepts epoch ms and Date; returns empty string on an unparseable input', () => {
    expect(toKst(Date.UTC(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01 09:00:00+09:00');
    expect(toKst(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01 09:00:00+09:00');
    expect(toKst('not-a-date')).toBe('');
  });
});
