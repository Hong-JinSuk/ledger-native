import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { BackLink } from '@/components/back-link';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { monthKey } from '@/lib/date';
import { monthRemainingBudget, monthSummary, yearSummary } from '@/lib/ledger/selectors';
import { formatCurrency } from '@/lib/money';
import { useLedgerStore } from '@/store/ledger-store';

const MONTH_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export default function MonthView() {
  const router = useRouter();
  const { year } = useLocalSearchParams<{ year: string }>();
  const y = Number(year);
  const records = useLedgerStore((s) => s.records);
  const settings = useLedgerStore((s) => s.settings);
  const totals = yearSummary(records, y);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}>
        <BackLink label="Years" />

        <View className="mb-6 mt-4">
          <Text className="text-3xl text-ink font-serif">{y} Ledger</Text>
          <Text className="mt-2 text-[10px] uppercase tracking-[3px] text-muted font-sans-semibold">
            연간 요약 및 월별 상세
          </Text>
          <View className="mt-4 flex-row gap-6">
            <AmountStat label="수입" amount={totals.income} tone="income" size="sm" />
            <AmountStat label="지출" amount={totals.expense} tone="expense" size="sm" />
          </View>
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-3">
          {MONTH_ABBR.map((abbr, i) => {
            const month = i + 1;
            const rows = records[monthKey(y, month)];
            const summary = monthSummary(rows);
            const remaining = monthRemainingBudget(rows, settings, y, month);
            const hasData = summary.income !== 0 || summary.expense !== 0;
            return (
              <FadeIn key={month} style={{ width: '48%' }} delay={i * 30}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/[year]/[month]',
                      params: { year: String(y), month: String(month) },
                    })
                  }
                  className="w-full rounded-2xl border border-line bg-white/60 px-4 py-4 active:opacity-60">
                  <Text className="text-[11px] uppercase tracking-[2px] text-muted font-sans-bold">
                    {abbr}
                  </Text>
                  {hasData ? (
                    <View className="mt-3 gap-2">
                      <AmountStat label="수입" amount={summary.income} tone="income" size="sm" />
                      <AmountStat label="지출" amount={summary.expense} tone="expense" size="sm" />
                      {remaining !== null && (
                        <Text className="mt-1 text-[11px] text-muted font-sans">
                          남은 {formatCurrency(remaining, settings.currency)}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text className="mt-3 text-xs text-muted font-sans">기록 없음</Text>
                  )}
                </Pressable>
              </FadeIn>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
