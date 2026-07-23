import { describe, expect, it } from 'vitest';

import {
  formatAmount,
  formatCompactAmount,
  formatCurrency,
  formatSignedCurrency,
  parseAmount,
} from '@/lib/money';

describe('money', () => {
  it('groups thousands', () => {
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(1000)).toBe('1,000');
    expect(formatAmount(1234567)).toBe('1,234,567');
  });

  it('truncates floats (money is never a float)', () => {
    expect(formatAmount(1234.99)).toBe('1,234');
  });

  it('handles negatives', () => {
    expect(formatAmount(-1234567)).toBe('-1,234,567');
  });

  it('formatCurrency appends the currency suffix', () => {
    expect(formatCurrency(5000)).toBe('5,000원');
    expect(formatCurrency(5000, '$')).toBe('5,000$');
  });

  it('formatSignedCurrency signs only 지출', () => {
    expect(formatSignedCurrency(5000, '지출')).toBe('-5,000원');
    expect(formatSignedCurrency(5000, '수입')).toBe('5,000원');
    expect(formatSignedCurrency(5000, '이체')).toBe('5,000원');
    expect(formatSignedCurrency(0, '')).toBe('0원');
  });

  it('formatCompactAmount collapses to 만/억 units for tight spaces', () => {
    expect(formatCompactAmount(0)).toBe('0');
    expect(formatCompactAmount(8500)).toBe('8,500'); // under 1만 → plain grouping
    expect(formatCompactAmount(9999)).toBe('9,999');
    expect(formatCompactAmount(10000)).toBe('1만');
    expect(formatCompactAmount(15000)).toBe('1.5만');
    expect(formatCompactAmount(1234567)).toBe('123만'); // rounds; full precision stays elsewhere
    expect(formatCompactAmount(100000000)).toBe('1억');
    expect(formatCompactAmount(234567890)).toBe('2.3억');
    expect(formatCompactAmount(-12345)).toBe('-1.2만'); // sign preserved
  });

  it('parseAmount strips commas, currency and other non-digits', () => {
    expect(parseAmount('1,234,567')).toBe(1234567);
    expect(parseAmount('5000원')).toBe(5000);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});
