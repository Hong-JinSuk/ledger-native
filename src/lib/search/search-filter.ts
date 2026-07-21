import type { Transaction } from '@/types/ledger';

/**
 * Filter transactions by a chip query's OR-of-AND groups (from {@link toQueryGroups}).
 *
 * Each group's terms must ALL appear (AND) in the transaction's 거래처(merchant) + 메모(note); a
 * transaction matches if ANY group matches (OR). Substring, case-insensitive. Tombstoned rows skipped.
 * Results are sorted newest-first (year, month, day desc). Empty query ⇒ [].
 *
 * Pure over the in-memory `records` — no file/network. Fast enough to scan the whole ledger (see the
 * search-cost benchmark: ~1만 건 < 1ms).
 */
export function searchTransactions(
  records: Record<string, Transaction[]>,
  groups: string[][],
): Transaction[] {
  if (!groups.length) return [];
  const haystack = (t: Transaction) => `${t.merchant ?? ''}\n${t.note ?? ''}`.toLowerCase();
  const out: Transaction[] = [];
  for (const rows of Object.values(records)) {
    for (const r of rows) {
      if (r.deleted) continue;
      const h = haystack(r);
      if (groups.some((g) => g.every((term) => h.includes(term.toLowerCase())))) out.push(r);
    }
  }
  out.sort((a, b) => b.year - a.year || b.month - a.month || (b.day ?? 0) - (a.day ?? 0));
  return out;
}
