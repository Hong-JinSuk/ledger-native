import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { AppHeader } from '@/components/app-header';
import { BackLink } from '@/components/back-link';
import { FadeIn } from '@/components/fade-in';
import { HoverReveal } from '@/components/hover-reveal';
import { Screen } from '@/components/screen';
import { useIsWideScreen } from '@/hooks/use-responsive';
import { monthKey } from '@/lib/date';
import { activeRows, monthRemainingBudget, monthSummary, yearSummary } from '@/lib/ledger/selectors';
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
  const isWide = useIsWideScreen();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}>
        {isWide ? (
          <View>
            <AppHeader title={`${y} Ledger`} subtitle="연간 요약 및 월별 상세" size="md" />
            {/* "< YEARS" (left) and the year totals (right) sit on the SAME row. */}
            <View className="flex-row items-end justify-between">
              <BackLink label="Years" />
              <View className="flex-row gap-8">
                <AmountStat label="수입" amount={totals.income} tone="income" size="lg" align="right" />
                <AmountStat label="지출" amount={-totals.expense} tone="expense" size="lg" align="right" />
              </View>
            </View>
          </View>
        ) : (
          <>
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
          </>
        )}

        {/* Full-width hairline under the header + "< YEARS" (web only). */}
        {isWide ? <View className="mb-6 mt-5 h-px bg-line" /> : null}

        {/* Same rich card on both platforms — only the grid density differs: web 4-up (grows to
            fill the full width, aligning with the header totals), native 2-up for the narrow phone. */}
        <View className={isWide ? 'flex-row flex-wrap gap-3.5' : 'flex-row flex-wrap justify-between gap-y-3'}>
          {MONTH_ABBR.map((abbr, i) => {
            const month = i + 1;
            const rows = records[monthKey(y, month)];
            const summary = monthSummary(rows);
            const remaining = monthRemainingBudget(rows, settings, y, month);
            const goToMonth = () =>
              router.push({
                pathname: '/[year]/[month]',
                params: { year: String(y), month: String(month) },
              });
            return (
              <FadeIn
                key={month}
                style={isWide ? { flexGrow: 1, flexBasis: '22%' } : { width: '48%' }}
                delay={i * 30}>
                <MonthCard
                  abbr={abbr}
                  month={month}
                  hasData={activeRows(rows).length > 0}
                  income={summary.income}
                  expense={summary.expense}
                  remaining={remaining}
                  onPress={goToMonth}
                />
              </FadeIn>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Rich month card, shared by web and native (ported from the original web): serif month name +
 * faint "N월" badge, and 수입 / 지출 / 잔여 예산 for months with records — otherwise a soft
 * "아직 기록이 없습니다". A fixed minHeight keeps every card the same size. HoverReveal only shows
 * on web: touch has no hover, so `hovered` stays false on native and the overlay never appears.
 */
function MonthCard({
  abbr,
  month,
  hasData,
  income,
  expense,
  remaining,
  onPress,
}: {
  abbr: string;
  month: number;
  hasData: boolean;
  income: number;
  expense: number;
  remaining: number | null;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{ minHeight: 186 }}
      className="w-full overflow-hidden rounded-2xl border border-line bg-white/60 px-5 py-5 active:opacity-60">
      <View className="flex-row items-start justify-between">
        <Text className="text-3xl text-ink font-serif">{abbr}</Text>
        <Text
          style={{ opacity: 0.5 }}
          className="text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
          {month}월
        </Text>
      </View>

      {hasData ? (
        <View className="mt-5">
          {/* 수입 · 지출 grouped, then a hairline before the derived 잔여 예산 (matches the web original). */}
          <View className="gap-2.5">
            <MonthRow label="수입" value={formatAmount(income)} toneClass="text-income" />
            <MonthRow label="지출" value={formatAmount(-expense)} toneClass="text-expense" />
          </View>
          <View className="my-3.5 h-px bg-line" />
          <MonthRow
            label="잔여 예산"
            value={remaining !== null ? formatAmount(remaining) : '—'}
            toneClass={remaining !== null && remaining < 0 ? 'text-expense' : 'text-ink'}
          />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center pt-2">
          <Text className="text-sm text-muted font-sans">아직 기록이 없습니다</Text>
        </View>
      )}

      <HoverReveal hovered={hovered} label={hasData ? '이어서 기록하기' : '기록 시작하기'} />
    </Pressable>
  );
}

function MonthRow({
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
      <Text className="text-[13px] text-muted font-sans">{label}</Text>
      <Text numberOfLines={1} className={`ml-2 shrink text-[15px] font-mono-medium ${toneClass}`}>
        {value}
      </Text>
    </View>
  );
}
