import { describe, expect, it } from 'vitest';

import {
  currentMonthKey,
  daysInMonth,
  firstWeekdayOfMonth,
  isToday,
  monthKey,
  parseMonthKey,
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
