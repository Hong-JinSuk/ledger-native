import { currentYear } from '@/lib/date';
import { useLedgerStore, type NewTransactionInput } from '@/store/ledger-store';

/**
 * Dev-only sample data so screens have something to show on a fresh simulator.
 * Self-guards to an empty store; call site is gated behind __DEV__ so it never ships.
 */
export function seedDevData() {
  const store = useLedgerStore.getState();
  const hasData = Object.values(store.records).some((rows) => rows.some((r) => !r.deleted));
  if (hasData) return;

  const y = currentYear();
  store.addYear(y - 1);
  store.updateMonthlyBudget(y, 6, 1_500_000);
  store.updateMonthlyBudget(y, 7, 1_500_000);

  const samples: NewTransactionInput[] = [
    { year: y, month: 7, day: 2, type: '수입', category: '급여', merchant: '회사', amount: 3_200_000, note: '7월 급여' },
    { year: y, month: 7, day: 3, type: '지출', category: '식비', merchant: '스타벅스', amount: 6_300, note: '아메리카노' },
    { year: y, month: 7, day: 3, type: '지출', category: '식비', merchant: '김밥천국', amount: 8_500, note: '점심' },
    { year: y, month: 7, day: 5, type: '지출', category: '교통', merchant: '지하철', amount: 1_400, note: '' },
    { year: y, month: 7, day: 9, type: '지출', category: '온라인쇼핑', merchant: '쿠팡', amount: 42_000, note: '생활용품' },
    { year: y, month: 7, day: 12, type: '지출', category: '문화/여가', merchant: 'CGV', amount: 15_000, note: '영화' },
    { year: y, month: 7, day: 18, type: '이체', category: '저축', merchant: '적금', amount: 300_000, note: '' },
    { year: y, month: 6, day: 10, type: '수입', category: '급여', merchant: '회사', amount: 3_200_000, note: '6월 급여' },
    { year: y, month: 6, day: 25, type: '지출', category: '식비', merchant: '배달의민족', amount: 23_000, note: '치킨' },
    { year: y - 1, month: 12, day: 24, type: '지출', category: '경조/선물', merchant: '선물의집', amount: 55_000, note: '크리스마스' },
  ];
  for (const s of samples) store.addTransaction(s);
}
