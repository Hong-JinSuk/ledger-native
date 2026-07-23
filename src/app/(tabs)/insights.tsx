import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { DonutChart } from '@/components/charts/donut-chart';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { CATEGORY_CHART_COLORS, CHART_OTHER_COLOR, MAX_CATEGORY_SLICES } from '@/constants/chart';
import { Palette } from '@/constants/palette';
import {
  type CategorySlice,
  categoryTotals,
  foldTopCategories,
  type InsightPeriod,
  OTHER_SLICE_LABEL,
  periodDayRange,
  periodExpenseRows,
  sumAmount,
  type WeekendWeekdaySplit,
  weekdayTotals,
  weekendWeekdaySplit,
} from '@/lib/ledger/insights';
import { formatAmount, formatCompactAmount } from '@/lib/money';
import { useLedgerStore } from '@/store/ledger-store';

type Mode = 'month' | 'year';

/**
 * Insights — spending(지출) analysis for the current month or year. Local-first data only (reads the
 * ledger store; no Drive/network here). All aggregation lives in `lib/ledger/insights` (unit-tested);
 * this screen is layout + the three charts: category donut, weekday bars, weekend/weekday daily average.
 */
export default function InsightsScreen() {
  const [mode, setMode] = useState<Mode>('month');
  const records = useLedgerStore((s) => s.records);
  const currency = useLedgerStore((s) => s.settings.currency);

  // One reference "now" per mount — keeps the derived period/range stable across re-renders.
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const period = useMemo<InsightPeriod>(
    () => (mode === 'month' ? { kind: 'month', year, month } : { kind: 'year', year }),
    [mode, year, month],
  );

  const rows = useMemo(() => periodExpenseRows(records, period), [records, period]);
  const total = useMemo(() => sumAmount(rows), [rows]);
  const slices = useMemo(() => foldTopCategories(categoryTotals(rows), MAX_CATEGORY_SLICES), [rows]);
  const weekday = useMemo(() => weekdayTotals(rows), [rows]);
  const split = useMemo(
    () => weekendWeekdaySplit(rows, periodDayRange(period, now)),
    [rows, period, now],
  );

  const periodLabel = mode === 'month' ? `${year}. ${month}월` : `${year}`;

  return (
    <Screen>
      {/* 헤더 고정 — 아래만 스크롤 (Journal/Settings와 동일 패턴). */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <AppHeader title="Insights" subtitle="Financial Analytics" />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 64 }}>
        {/* Period toggle + the concrete period it resolves to. */}
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-row self-start rounded-full bg-fill p-1">
            <Segment label="이번 달" active={mode === 'month'} onPress={() => setMode('month')} />
            <Segment label="올해" active={mode === 'year'} onPress={() => setMode('year')} />
          </View>
          <Text className="text-sm text-muted font-mono">{periodLabel}</Text>
        </View>

        {total <= 0 ? (
          <FadeIn>
            <EmptyState
              message={
                mode === 'month'
                  ? '이번 달은 아직 소비 기록이 없어요.\n첫 기록을 남기면 여기 담아둘게요.'
                  : '올해는 아직 소비 기록이 없어요.\n기록이 쌓이면 이곳에 담아둘게요.'
              }
            />
          </FadeIn>
        ) : (
          <View className="gap-4">
            <FadeIn delay={0}>
              <CategoryCard slices={slices} total={total} currency={currency} periodKey={mode} />
            </FadeIn>
            <FadeIn delay={70}>
              <WeekdayCard totals={weekday} />
            </FadeIn>
            <FadeIn delay={140}>
              <WeekendCard split={split} currency={currency} />
            </FadeIn>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Pill segment for the month/year toggle (same treatment as the Journal month view's list/calendar). */
function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-1.5 ${active ? 'bg-white' : ''} active:opacity-70`}>
      <Text className={`text-xs font-sans-semibold ${active ? 'text-ink' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Shared card shell: soft card + a small uppercase section label with an optional right-aligned caption. */
function SectionCard({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <View className="rounded-2xl border border-line bg-white/60 px-5 py-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
          {label}
        </Text>
        {caption ? <Text className="text-[11px] text-muted font-sans">{caption}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Fixed categorical colour by slot index; the folded "그 외" slice takes the neutral. */
function categoryColor(name: string, index: number): string {
  if (name === OTHER_SLICE_LABEL) return CHART_OTHER_COLOR;
  return CATEGORY_CHART_COLORS[index] ?? CHART_OTHER_COLOR;
}

function CategoryCard({
  slices,
  total,
  currency,
  periodKey,
}: {
  slices: CategorySlice[];
  total: number;
  currency: string;
  /** Changes when the period toggles → the donut dips-and-restores its opacity to mask the arc swap
   *  (a soft dissolve instead of a hard cut). */
  periodKey: string;
}) {
  return (
    <SectionCard label="카테고리별 소비">
      <View className="mt-4 items-center">
        <DonutChart
          pulseKey={periodKey}
          size={184}
          thickness={30}
          data={slices.map((s, i) => ({ value: s.amount, color: categoryColor(s.name, i) }))}>
          <Text className="text-2xl text-ink font-mono-semibold">{formatCompactAmount(total)}</Text>
          <Text className="mt-0.5 text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
            총 지출
          </Text>
        </DonutChart>
      </View>

      <View className="mt-6 gap-2.5">
        {slices.map((s, i) => (
          <View key={s.name} className="flex-row items-center">
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: categoryColor(s.name, i),
              }}
            />
            <Text numberOfLines={1} className="ml-2.5 flex-1 text-sm text-ink font-sans">
              {s.name}
            </Text>
            <Text className="ml-2 text-sm text-ink font-mono-medium">
              {formatAmount(s.amount)}
              <Text className="text-muted font-sans"> {currency}</Text>
            </Text>
            <Text className="ml-2 w-9 text-right text-xs text-muted font-mono">
              {Math.round((s.amount / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

// 월~일 display order (JS getDay is 0=Sun; Korean lists start Monday). Sunday tinted like the calendar.
const WEEKDAY_VIEW = [
  { dow: 1, label: '월' },
  { dow: 2, label: '화' },
  { dow: 3, label: '수' },
  { dow: 4, label: '목' },
  { dow: 5, label: '금' },
  { dow: 6, label: '토' },
  { dow: 0, label: '일' },
] as const;

const WEEKDAY_BAR_AREA = 108; // px of vertical space the tallest bar fills

function WeekdayCard({ totals }: { totals: number[] }) {
  const values = WEEKDAY_VIEW.map((d) => totals[d.dow]);
  const max = Math.max(...values, 1);
  const peak = values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
  const hasData = values.some((v) => v > 0);

  return (
    <SectionCard label="요일별 소비">
      {hasData ? (
        <View className="mt-6 flex-row items-end justify-between">
          {WEEKDAY_VIEW.map((d, i) => (
            <WeekdayColumn
              key={d.dow}
              label={d.label}
              value={values[i]}
              fraction={values[i] / max}
              isPeak={i === peak && values[i] > 0}
              isSunday={d.dow === 0}
            />
          ))}
        </View>
      ) : (
        <Text className="mt-4 text-sm leading-6 text-muted font-sans">
          날짜가 있는 소비가 아직 없어, 요일 분석은 잠시 후에 담아둘게요.
        </Text>
      )}
    </SectionCard>
  );
}

/** One weekday column: peak bar in ink (with its value labelled), the rest a soft wash — dataviz
 *  "emphasis": highlight the one day that's the point, recede the context. */
function WeekdayColumn({
  label,
  value,
  fraction,
  isPeak,
  isSunday,
}: {
  label: string;
  value: number;
  fraction: number;
  isPeak: boolean;
  isSunday: boolean;
}) {
  const target = value > 0 ? Math.max(fraction * WEEKDAY_BAR_AREA, 3) : 0;
  // Grow to `target` on mount, then tween whenever it changes (period switch) so bars glide to their
  // new height instead of snapping. JS-driven (height can't use the native driver) — fine at 7 bars.
  const [height] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(height, {
      toValue: target,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [height, target]);

  return (
    <View className="flex-1 items-center">
      <View style={{ height: WEEKDAY_BAR_AREA }} className="w-full items-center justify-end">
        {isPeak ? (
          <Text className="mb-1 text-[10px] text-ink font-mono-medium">
            {formatCompactAmount(value)}
          </Text>
        ) : null}
        <Animated.View
          style={{
            height,
            width: '58%',
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            backgroundColor: isPeak ? Palette.ink : 'rgba(26,26,26,0.12)',
          }}
        />
      </View>
      <Text
        className={`mt-2 text-[11px] font-sans-medium ${isSunday ? 'text-expense' : 'text-muted'}`}>
        {label}
      </Text>
    </View>
  );
}

function WeekendCard({ split, currency }: { split: WeekendWeekdaySplit; currency: string }) {
  const { weekdayAvg, weekendAvg, weekdayDays, weekendDays } = split;
  const hasData = weekdayDays + weekendDays > 0 && (weekdayAvg > 0 || weekendAvg > 0);
  const max = Math.max(weekdayAvg, weekendAvg, 1);
  const diff = Math.abs(weekendAvg - weekdayAvg);

  // "Similar" if within 5% of the larger average — avoids a breathless takeaway over rounding noise.
  const takeaway = !hasData
    ? null
    : diff < Math.max(max * 0.05, 1)
      ? '평일과 주말 소비가 비슷해요.'
      : weekendAvg > weekdayAvg
        ? `주말엔 하루 평균 ${formatCompactAmount(diff)}${currency}쯤 더 쓰고 있어요.`
        : `평일엔 하루 평균 ${formatCompactAmount(diff)}${currency}쯤 더 쓰고 있어요.`;

  return (
    <SectionCard
      label="주말 · 평일"
      caption={hasData ? `${weekdayDays + weekendDays}일 기준 · 하루 평균` : undefined}>
      {hasData ? (
        <>
          <View className="mt-5 gap-3.5">
            <AvgBar
              label="평일"
              value={weekdayAvg}
              fraction={weekdayAvg / max}
              color={Palette.transfer}
              currency={currency}
            />
            <AvgBar
              label="주말"
              value={weekendAvg}
              fraction={weekendAvg / max}
              color="#C15F3C"
              currency={currency}
            />
          </View>
          {takeaway ? (
            <Text className="mt-4 text-[13px] leading-5 text-muted font-sans">{takeaway}</Text>
          ) : null}
        </>
      ) : (
        <Text className="mt-4 text-sm leading-6 text-muted font-sans">
          아직 평균을 낼 소비가 없어요.
        </Text>
      )}
    </SectionCard>
  );
}

/** One horizontal average bar (평일/주말), scaled to the larger of the two so the comparison is direct. */
function AvgBar({
  label,
  value,
  fraction,
  color,
  currency,
}: {
  label: string;
  value: number;
  fraction: number;
  color: string;
  currency: string;
}) {
  const target = value > 0 ? Math.max(fraction * 100, 3) : 0;
  // Slide the fill out to `target`% on mount / period change instead of snapping to the new width.
  const [pct] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(pct, {
      toValue: target,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [pct, target]);
  const width = pct.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View className="flex-row items-center">
      <Text className="w-8 text-xs text-muted font-sans-medium">{label}</Text>
      <View className="mx-3 h-7 flex-1 justify-center overflow-hidden rounded-full bg-fill">
        <Animated.View
          style={{ width, height: '100%', borderRadius: 999, backgroundColor: color }}
        />
      </View>
      <Text className="w-24 text-right text-sm text-ink font-mono-medium">
        {formatAmount(value)}
        <Text className="text-muted font-sans"> {currency}</Text>
      </Text>
    </View>
  );
}
