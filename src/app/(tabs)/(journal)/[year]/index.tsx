import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { AppHeader } from '@/components/app-header';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { monthKey } from '@/lib/date';
import { monthRemainingBudget, monthSummary, yearSummary } from '@/lib/ledger/selectors';
import { formatAmount } from '@/lib/money';
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
        <AppHeader
          title={`${y} Ledger`}
          subtitle="연간 요약 및 월별 상세"
          backLabel="Years"
          size="md"
        />

        <View className="mb-6 flex-row gap-6">
          <AmountStat label="수입" amount={totals.income} tone="income" size="sm" />
          <AmountStat label="지출" amount={totals.expense} tone="expense" size="sm" />
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-3">
          {MONTH_ABBR.map((abbr, i) => {
            const month = i + 1;
            const rows = records[monthKey(y, month)];
            const summary = monthSummary(rows);
            const remaining = monthRemainingBudget(rows, settings, y, month);
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
                  {/* Always two rows so every card is the same height (budget or not). */}
                  <View className="mt-3 gap-1.5">
                    <MonthStatRow
                      label="남은"
                      value={remaining !== null ? formatAmount(remaining) : '—'}
                      toneClass={remaining !== null && remaining < 0 ? 'text-expense' : 'text-ink'}
                    />
                    <MonthStatRow
                      label="지출"
                      value={formatAmount(summary.expense)}
                      toneClass={summary.expense > 0 ? 'text-expense' : 'text-muted'}
                    />
                  </View>
                </Pressable>
              </FadeIn>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

function MonthStatRow({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text className="text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
        {label}
      </Text>
      <Text numberOfLines={1} className={`ml-2 shrink text-sm font-mono-medium ${toneClass}`}>
        {value}
      </Text>
    </View>
  );
}
