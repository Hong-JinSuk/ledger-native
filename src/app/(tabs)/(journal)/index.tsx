import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { yearRemainingBudget, yearSummary } from '@/lib/ledger/selectors';
import { formatCurrency } from '@/lib/money';
import { useLedgerStore } from '@/store/ledger-store';

export default function YearView() {
  const router = useRouter();
  const years = useLedgerStore((s) => s.years);
  const records = useLedgerStore((s) => s.records);
  const settings = useLedgerStore((s) => s.settings);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}>
        <View className="mb-8">
          <Text className="text-4xl text-ink font-serif">Ledger</Text>
          <Text className="mt-2 text-[10px] uppercase tracking-[3px] text-muted font-sans-semibold">
            Financial Journal
          </Text>
        </View>

        <View className="gap-4">
          {years.map((year, i) => {
            const summary = yearSummary(records, year);
            const remaining = yearRemainingBudget(records, settings, year);
            return (
              <FadeIn key={year} delay={i * 70}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/[year]', params: { year: String(year) } })
                  }
                  className="rounded-2xl border border-line bg-white/60 px-5 py-5 active:opacity-60">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-3xl text-ink font-serif">{year}</Text>
                    <ChevronRight size={20} color={Palette.muted} />
                  </View>

                  <View className="mt-4 flex-row gap-6">
                    <AmountStat label="수입" amount={summary.income} tone="income" />
                    <AmountStat label="지출" amount={summary.expense} tone="expense" />
                  </View>

                  {remaining !== null && (
                    <Text className="mt-3 text-xs text-muted font-sans">
                      남은 예산 · {formatCurrency(remaining, settings.currency)}
                    </Text>
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
