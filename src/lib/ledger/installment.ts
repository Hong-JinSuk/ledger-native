import { daysInMonth } from '@/lib/date';
import type { Transaction } from '@/types/ledger';

/** One month's slice of an installment purchase (before it's turned into a full Transaction). */
export interface InstallmentSlice {
  year: number;
  /** 1–12. */
  month: number;
  day: number | null;
  /** Integer KRW charged this month. */
  amount: number;
  /** 1-based position within the installment. */
  seq: number;
}

/**
 * Split a total expense into `count` monthly slices starting at (year, month).
 *
 * - Rolls month/year over past December (e.g. Dec + 2 months → Dec, next Jan).
 * - Integer KRW only: each slice = floor(total / count); the leftover (total − base·count) is added to
 *   the FIRST slice, so the slices sum EXACTLY back to the total — no float, no lost 원.
 * - `day` is carried to every slice, clamped to that month's length (31 → 30/28) so it stays valid.
 *
 * Pure (no ids/timestamps) so the month-rollover + remainder math is unit-testable; the store wraps
 * each slice into a synced Transaction.
 */
export function planInstallmentSlices(
  year: number,
  month: number,
  total: number,
  count: number,
  day: number | null,
): InstallmentSlice[] {
  const n = Math.max(1, Math.trunc(count));
  const amount = Math.max(0, Math.trunc(total));
  const base = Math.floor(amount / n);
  const remainder = amount - base * n; // 0 .. n-1, all on the first slice
  const slices: InstallmentSlice[] = [];
  for (let i = 0; i < n; i += 1) {
    const offset = month - 1 + i; // 0-indexed month, may exceed 11 → next year
    const y = year + Math.floor(offset / 12);
    const m = (offset % 12) + 1;
    slices.push({
      year: y,
      month: m,
      day: day == null ? null : Math.min(day, daysInMonth(y, m)),
      amount: base + (i === 0 ? remainder : 0),
      seq: i + 1,
    });
  }
  return slices;
}

/** A whole installment, gathered from its scattered per-month slices. */
export interface InstallmentSummary {
  /** Sum of the live slices' amounts = the original total (what a re-split should divide again). */
  total: number;
  /** How many months it's split over. */
  count: number;
  /** The purchase (first) month — the anchor a re-split starts from, regardless of which slice you edit. */
  firstYear: number;
  firstMonth: number;
}

/**
 * Gather an installment's live (non-deleted) slices from every month bucket → its total + anchor month.
 * Lets the drawer edit the installment as one unit (show the total, re-split from the original start).
 * Returns null if no live slice remains. Also heals a stale/mis-split installment: the total is the SUM
 * of whatever the slices currently hold, so re-splitting redistributes it correctly.
 */
export function summarizeInstallment(
  records: Record<string, Transaction[]>,
  installmentId: string,
): InstallmentSummary | null {
  let total = 0;
  let count = 0;
  let first: Transaction | null = null;
  for (const rows of Object.values(records)) {
    for (const r of rows) {
      if (r.installmentId !== installmentId || r.deleted) continue;
      total += r.amount || 0;
      count = r.installmentCount ?? count;
      if (!first || (r.installmentSeq ?? 99) < (first.installmentSeq ?? 99)) first = r;
    }
  }
  if (!first) return null;
  return { total, count: count || 1, firstYear: first.year, firstMonth: first.month };
}
