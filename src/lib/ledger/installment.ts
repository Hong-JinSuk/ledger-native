import { daysInMonth } from '@/lib/date';
import type { Transaction } from '@/types/ledger';

/** One month's slice of an installment purchase (before it's turned into a full Transaction). */
export interface InstallmentSlice {
  year: number;
  /** 1–12. */
  month: number;
  day: number | null;
  /** Principal (원금) portion for this month, integer KRW. */
  principal: number;
  /** Interest (이자) for this month on the declining balance, integer KRW. 0 when no rate. */
  interest: number;
  /** Integer KRW actually charged/recorded this month = principal + interest. */
  amount: number;
  /** 1-based position within the installment. */
  seq: number;
}

/**
 * Split a `total` PRINCIPAL (원금) into `count` monthly slices starting at (year, month), optionally
 * adding manual interest on the declining balance (원금균등 — Korean card 할부수수료 method).
 *
 * - Rolls month/year over past December (e.g. Dec + 2 months → Dec, next Jan).
 * - Principal: integer KRW, each slice = floor(total / count); the leftover (total − base·count) rides
 *   the FIRST slice, so the principal portions sum EXACTLY back to the total — no float, no lost 원.
 * - Interest (`apr` = annual %, e.g. 10): each month is charged monthlyRate = apr/100/12 on the balance
 *   OUTSTANDING that month (before paying its principal), so it shrinks every month and the last slice is
 *   the smallest. Rounded to the nearest 원 per slice. apr ≤ 0 or a single slice ⇒ 0 interest (일시불/무이자).
 * - `day` is carried to every slice, clamped to that month's length (31 → 30/28) so it stays valid.
 *
 * Pure (no ids/timestamps) so the rollover + remainder + interest math is unit-testable; the store wraps
 * each slice into a synced Transaction.
 */
export function planInstallmentSlices(
  year: number,
  month: number,
  total: number,
  count: number,
  day: number | null,
  apr = 0,
): InstallmentSlice[] {
  const n = Math.max(1, Math.trunc(count));
  const principalTotal = Math.max(0, Math.trunc(total));
  const base = Math.floor(principalTotal / n);
  const remainder = principalTotal - base * n; // 0 .. n-1, all on the first slice
  // Interest only makes sense for a real (multi-month) installment; a lone slice is 일시불 → no interest.
  const monthlyRate = apr > 0 && n >= 2 ? apr / 100 / 12 : 0;
  const slices: InstallmentSlice[] = [];
  let balance = principalTotal; // principal still owed at the START of the current month
  for (let i = 0; i < n; i += 1) {
    const offset = month - 1 + i; // 0-indexed month, may exceed 11 → next year
    const y = year + Math.floor(offset / 12);
    const m = (offset % 12) + 1;
    const principal = base + (i === 0 ? remainder : 0);
    const interest = monthlyRate > 0 ? Math.round(balance * monthlyRate) : 0;
    balance -= principal; // pay this month's principal down for next month's interest
    slices.push({
      year: y,
      month: m,
      day: day == null ? null : Math.min(day, daysInMonth(y, m)),
      principal,
      interest,
      amount: principal + interest,
      seq: i + 1,
    });
  }
  return slices;
}

/** Rolled-up figures for an installment schedule — for the drawer's preview line. */
export interface InstallmentTotals {
  /** Total principal (원금) = sum of slice principals. */
  principal: number;
  /** Total interest (이자) = sum of slice interests. */
  interest: number;
  /** principal + interest = what the whole installment costs. */
  total: number;
  /** First month's charge (the largest, since interest declines). */
  first: number;
  /** Last month's charge (the smallest). */
  last: number;
}

/** Sum a schedule's slices into {@link InstallmentTotals}. Empty ⇒ all zero. */
export function installmentTotals(slices: InstallmentSlice[]): InstallmentTotals {
  let principal = 0;
  let interest = 0;
  for (const s of slices) {
    principal += s.principal;
    interest += s.interest;
  }
  return {
    principal,
    interest,
    total: principal + interest,
    first: slices[0]?.amount ?? 0,
    last: slices[slices.length - 1]?.amount ?? 0,
  };
}

/** A whole installment, gathered from its scattered per-month slices. */
export interface InstallmentSummary {
  /** Sum of the live slices' PRINCIPAL (원금, interest excluded) = what a re-split should divide again. */
  principal: number;
  /** How many months it's split over. */
  count: number;
  /** Annual interest rate (연이율, %); 0 for 무이자/legacy installments. */
  apr: number;
  /** The purchase (first) month — the anchor a re-split starts from, regardless of which slice you edit. */
  firstYear: number;
  firstMonth: number;
}

/**
 * Gather an installment's live (non-deleted) slices from every month bucket → its 원금 + rate + anchor.
 * Lets the drawer edit the installment as one unit (show the principal, re-split from the original start).
 * Returns null if no live slice remains.
 *
 * The principal is summed from each slice's `installmentPrincipal` (falling back to `amount` for 0%/legacy
 * slices that never stored one) — NOT from `amount`, which folds in interest and would inflate on every
 * edit. Summing the stored principal also heals a stale/mis-split installment, so re-splitting redistributes
 * it correctly.
 */
export function summarizeInstallment(
  records: Record<string, Transaction[]>,
  installmentId: string,
): InstallmentSummary | null {
  let principal = 0;
  let count = 0;
  let apr = 0;
  let first: Transaction | null = null;
  for (const rows of Object.values(records)) {
    for (const r of rows) {
      if (r.installmentId !== installmentId || r.deleted) continue;
      principal += r.installmentPrincipal ?? r.amount ?? 0;
      count = r.installmentCount ?? count;
      apr = r.installmentApr ?? apr;
      if (!first || (r.installmentSeq ?? 99) < (first.installmentSeq ?? 99)) first = r;
    }
  }
  if (!first) return null;
  return { principal, count: count || 1, apr, firstYear: first.year, firstMonth: first.month };
}

/** The plan for settling an installment early in a chosen month — what that month records + what's dropped. */
export interface InstallmentPayoffPlan {
  /** 1-based position of the payoff month within the installment. */
  payoffSeq: number;
  /** New month count after payoff (= payoffSeq): the earlier months plus the payoff month. */
  count: number;
  /** Lump sum recorded in the payoff month = remaining principal + that month's own interest. */
  payoffAmount: number;
  /** The payoff month's principal portion (= ALL remaining principal), stored so a later edit re-derives 원금. */
  payoffPrincipal: number;
  /** Annual rate carried over (0 = 무이자). */
  apr: number;
  /** How many future months get dropped (tombstoned). */
  removedCount: number;
}

/**
 * Plan an early payoff (조기완납): settle the whole installment in the month at (payoffYear, payoffMonth).
 * That month absorbs ALL remaining principal (its slice + every later slice) plus its OWN interest; every
 * LATER month is dropped. Earlier (already-paid) months are untouched.
 *
 * Future interest is waived — the point of paying off early — while the payoff month's interest still stands
 * (it covers that month). Because the lump is `remaining principal + this month's interest`, the kept slices'
 * principals still sum to the original 원금, so re-opening/editing the (now shorter) installment stays sound.
 *
 * Returns null if the installment has no live slice, or none falls in the given month (nothing to settle on).
 */
export function planInstallmentPayoff(
  records: Record<string, Transaction[]>,
  installmentId: string,
  payoffYear: number,
  payoffMonth: number,
): InstallmentPayoffPlan | null {
  const live: Transaction[] = [];
  for (const rows of Object.values(records)) {
    for (const r of rows) {
      if (r.installmentId === installmentId && !r.deleted) live.push(r);
    }
  }
  const payoff = live.find((r) => r.year === payoffYear && r.month === payoffMonth);
  if (!payoff) return null;
  const payoffSeq = payoff.installmentSeq ?? 1;
  const apr = payoff.installmentApr ?? 0;
  let remainingPrincipal = 0;
  let removedCount = 0;
  for (const r of live) {
    const seq = r.installmentSeq ?? 1;
    if (seq < payoffSeq) continue; // earlier months are already paid — leave them be
    remainingPrincipal += r.installmentPrincipal ?? r.amount ?? 0;
    if (seq > payoffSeq) removedCount += 1;
  }
  // The payoff month's own interest is still due; only the LATER months' interest is waived.
  const payoffInterest = (payoff.amount ?? 0) - (payoff.installmentPrincipal ?? payoff.amount ?? 0);
  return {
    payoffSeq,
    count: payoffSeq,
    payoffAmount: remainingPrincipal + payoffInterest,
    payoffPrincipal: remainingPrincipal,
    apr,
    removedCount,
  };
}
