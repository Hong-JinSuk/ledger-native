import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { AppHeader } from '@/components/app-header';
import { useConfirm } from '@/components/confirm-dialog';
import { BudgetDrawer, type BudgetDrawerRef } from '@/components/budget-drawer';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { RecordDrawer, type RecordDrawerRef } from '@/components/record-drawer';
import { Screen } from '@/components/screen';
import { TransactionRow } from '@/components/transaction-row';
import { webScrollContent } from '@/constants/layout';
import { Palette } from '@/constants/palette';
import { useIsWideScreen } from '@/hooks/use-responsive';
import {
  currentMonthKey,
  daysInMonth,
  firstWeekdayOfMonth,
  isToday,
  monthKey,
  weekdayLabel,
} from '@/lib/date';
import { isMonthConfigured, monthFixedTotal } from '@/lib/ledger/budget';
import {
  activeRows,
  groupByDay,
  monthRemainingBudget,
  monthSummary,
  netTotal,
  searchRows,
  sortRowsByDayDesc,
} from '@/lib/ledger/selectors';
import { formatAmount, formatCurrency, formatSignedCurrency } from '@/lib/money';
import { useLedgerStore } from '@/store/ledger-store';
import type { Transaction } from '@/types/ledger';

type ViewMode = 'list' | 'calendar';

export default function SpreadsheetView() {
  const { year, month } = useLocalSearchParams<{ year: string; month: string }>();
  const y = Number(year);
  const m = Number(month);
  const key = monthKey(y, m);
  // A new record defaults to today's date when viewing the current month (else 미정/null).
  const defaultAddDay = key === currentMonthKey() ? new Date().getDate() : null;

  const records = useLedgerStore((s) => s.records);
  const categories = useLedgerStore((s) => s.categories);
  const settings = useLedgerStore((s) => s.settings);
  const deleteMonth = useLedgerStore((s) => s.deleteMonth);
  const resetMonthSetup = useLedgerStore((s) => s.resetMonthSetup);
  const confirm = useConfirm();
  const router = useRouter();

  const [mode, setMode] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const drawerRef = useRef<RecordDrawerRef>(null);
  const budgetRef = useRef<BudgetDrawerRef>(null);

  // Scroll-reveal summary bar: once scrolled past the budget card, a compact "남은 예산" bar animates in at
  // the top (mirrors the welcome page header's scroll-reveal). The ref gates redundant state churn so the
  // handler only re-renders on the actual show↔hide flip, not every scroll frame.
  const [stickyShown, setStickyShown] = useState(false);
  const [headerH, setHeaderH] = useState(0); // 고정 헤더 높이 — sticky 요약바를 그 아래에 띄우려고 잰다

  const stickyAnim = useRef(new Animated.Value(0)).current;
  const stickyShownRef = useRef(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const shouldShow = e.nativeEvent.contentOffset.y > 180;
    if (shouldShow === stickyShownRef.current) return;
    stickyShownRef.current = shouldShow;
    setStickyShown(shouldShow);
    Animated.timing(stickyAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  // `day` is optional; the `typeof` guard drops any GestureResponderEvent when wired to onPress.
  const openAdd = (day?: number | null) =>
    drawerRef.current?.present(null, typeof day === 'number' ? day : null);
  const openEdit = (tx: Transaction) => drawerRef.current?.present(tx);
  const goToFixed = () =>
    router.push({ pathname: '/[year]/[month]/fixed', params: { year: String(y), month: String(m) } });

  const onDeleteMonth = async () => {
    const ok = await confirm({
      title: `${m}월 기록을 전부 삭제할까요?`,
      message: '이 달의 모든 기록이 사라져요. 되돌릴 수 없어요.',
      confirmLabel: '전체 삭제',
    });
    if (ok) deleteMonth(y, m);
  };

  const onResetMonthSetup = async () => {
    const ok = await confirm({
      title: `${m}월 설정을 초기화할까요?`,
      message: '이 달의 예산·고정 지출 설정이 지워지고 "설정 안 됨"으로 돌아가요. 기록은 지워지지 않아요.',
      confirmLabel: '초기화',
    });
    if (ok) resetMonthSetup(y, m);
  };

  // Entering a month that isn't set up yet → gently prompt to apply the Settings defaults or set it up.
  // Once per visit (promptedRef). "나중에 하기" just closes it, so re-entering shows it again like the
  // first time — until the month is actually configured.
  // ⚠️ Gate ONLY on isMonthConfigured (settings). NEVER add a records/rows.length condition here: an
  // installment slice (e.g. a July 3-month 할부 spilling into Aug/Sep) — or any record — that lands in an
  // un-configured month must STILL show this Settings-based setup prompt. Records must not suppress it.
  const promptedRef = useRef(false);
  useEffect(() => {
    if (promptedRef.current) return;
    if (!isMonthConfigured(settings, y, m)) {
      promptedRef.current = true;
      const t = setTimeout(() => budgetRef.current?.present(), 450);
      return () => clearTimeout(t);
    }
  }, [settings, y, m]);

  // Calendar starts on today (when viewing the current month) or the 1st.
  useEffect(() => {
    const now = new Date();
    setSelectedDay(now.getFullYear() === y && now.getMonth() === m - 1 ? now.getDate() : 1);
  }, [y, m]);

  const rows = useMemo(() => activeRows(records[key]), [records, key]);
  const iconByCategory = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.name, c.icon])),
    [categories],
  );

  const summary = monthSummary(records[key]);
  const remaining = monthRemainingBudget(records[key], settings, y, m);
  const fixedTotal = monthFixedTotal(settings, y, m);

  const filtered = useMemo(() => sortRowsByDayDesc(searchRows(rows, query)), [rows, query]);
  const dayGroups = useMemo(() => {
    const groups = groupByDay(filtered);
    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a)
      .map((day) => ({ day, rows: groups[day] }));
  }, [filtered]);
  // Records on the calendar-selected day (undated rows never match a calendar day).
  const selectedRows = useMemo(
    () => rows.filter((r) => r.day === selectedDay).sort((a, b) => a.id.localeCompare(b.id)),
    [rows, selectedDay],
  );

  return (
    <Screen webFull>
      <View className="flex-1">
        {/* 헤더 고정 — 아래만 스크롤 (Settings와 동일 패턴). 높이를 재서 sticky 요약바를 이 아래에 띄운다. */}
        <View
          onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
          style={{ backgroundColor: Palette.paper }}>
          <View style={[{ paddingHorizontal: 20, paddingTop: 16 }, webScrollContent]}>
            <AppHeader
              title={`${y}. ${m}월`}
              subtitle={`${m}월의 기록`}
              backLabel="Months"
              size="md"
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            { paddingHorizontal: 20, paddingBottom: 96 },
            webScrollContent,
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled">
          {/* Summary — tap to set/edit this month's budget */}
          <FadeIn>
            <Pressable
              onPress={() => budgetRef.current?.present()}
              className="mb-3 rounded-2xl border border-line bg-white/60 px-5 py-5 active:opacity-70">
              {remaining !== null ? (
                <>
                  <Text className="text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
                    남은 예산
                  </Text>
                  <Text
                    className={`mt-1 text-3xl font-mono-semibold ${remaining < 0 ? 'text-expense' : 'text-ink'}`}>
                    {formatCurrency(remaining, settings.currency)}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
                    이번 달 합계
                  </Text>
                  <Text className="mt-1 text-3xl text-ink font-mono-semibold">
                    {formatCurrency(summary.balance, settings.currency)}
                  </Text>
                  <Text className="mt-1 text-[11px] text-muted font-sans">
                    탭하여 예산을 설정하세요
                  </Text>
                </>
              )}
              <View className="mt-4 flex-row gap-6">
                <AmountStat label="수입" amount={summary.income} tone="income" size="sm" />
                <AmountStat label="지출" amount={summary.expense} tone="expense" size="sm" />
                {fixedTotal > 0 && (
                  <AmountStat label="고정지출" amount={fixedTotal} tone="expense" size="sm" />
                )}
              </View>
            </Pressable>
          </FadeIn>

          {/* Edit THIS month's fixed expenses + (once set up) reset the month back to "not set up". */}
          <FadeIn>
            <View className="mb-5 flex-row items-center justify-between">
              <Pressable
                onPress={goToFixed}
                hitSlop={8}
                className="flex-row items-center gap-1.5 py-1 pr-2 active:opacity-60">
                <Pencil size={13} color={Palette.muted} strokeWidth={2} />
                <Text className="text-xs text-muted font-sans-medium">
                  {fixedTotal > 0 ? '이 달 고정 지출 수정' : '이 달 고정 지출 추가'}
                </Text>
              </Pressable>
              {isMonthConfigured(settings, y, m) && (
                <Pressable
                  onPress={onResetMonthSetup}
                  hitSlop={8}
                  className="flex-row items-center gap-1 py-1 pl-2 active:opacity-60">
                  <RotateCcw size={12} color={Palette.muted} strokeWidth={2} />
                  <Text className="text-xs text-muted font-sans-medium">설정 초기화</Text>
                </Pressable>
              )}
            </View>
          </FadeIn>

          {/* View toggle */}
          <View className="mb-4 flex-row self-start rounded-full bg-fill p-1">
            <SegmentButton label="리스트" active={mode === 'list'} onPress={() => setMode('list')} />
            <SegmentButton
              label="캘린더"
              active={mode === 'calendar'}
              onPress={() => setMode('calendar')}
            />
          </View>

          {/* Search (list mode) */}
          {mode === 'list' && (
            <View className="mb-4 flex-row items-center gap-2 rounded-full bg-fill px-4 py-2.5">
              <Search size={16} color={Palette.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="거래처 · 카테고리 · 메모 검색"
                placeholderTextColor={Palette.muted}
                className="flex-1 text-sm text-ink font-sans"
              />
            </View>
          )}

          {mode === 'list' ? (
            rows.length === 0 ? (
              <FirstRecordEmpty onAdd={() => openAdd(defaultAddDay)} />
            ) : dayGroups.length === 0 ? (
              <Text className="mt-8 text-center text-sm text-muted font-sans">
                검색 결과가 없어요.
              </Text>
            ) : (
              dayGroups.map(({ day, rows: dayRows }, gi) => (
                <FadeIn key={day} delay={gi * 40}>
                  <View className="mb-5">
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="text-xs text-muted font-sans-semibold">
                        {day === 0 ? '날짜 미정' : `${day}일 ${weekdayLabel(y, m, day)}`}
                      </Text>
                      <Text className="text-xs text-muted font-mono">
                        {formatSignedCurrency(
                          Math.abs(netTotal(dayRows)),
                          netTotal(dayRows) < 0 ? '지출' : '수입',
                          settings.currency,
                        )}
                      </Text>
                    </View>
                    {dayRows.map((row) => (
                      <TransactionRow
                        key={row.id}
                        row={row}
                        icon={iconByCategory[row.category ?? '']}
                        currency={settings.currency}
                        onPress={() => openEdit(row)}
                      />
                    ))}
                  </View>
                </FadeIn>
              ))
            )
          ) : (
            <>
              <MonthCalendar
                year={y}
                month={m}
                rows={rows}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
              <SelectedDayDetail
                year={y}
                month={m}
                day={selectedDay}
                rows={selectedRows}
                iconByCategory={iconByCategory}
                currency={settings.currency}
                onAdd={() => openAdd(selectedDay)}
                onEditRow={openEdit}
              />
            </>
          )}

          {rows.length > 0 && (
            <Pressable
              onPress={onDeleteMonth}
              className="mt-10 flex-row items-center justify-center gap-1.5 py-3 active:opacity-60">
              <Trash2 size={14} color={Palette.expense} />
              <Text className="text-xs text-expense font-sans-medium">이 달 기록 전체 삭제</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Scroll-reveal summary bar — slides/fades in at the top once you scroll past the budget card
            (mirrors the welcome header's scroll-reveal), so the remaining budget stays in view while
            browsing rows. Full-width paper bg; inner row aligns to the content column (webScrollContent).
            Tap to edit the budget, like the card. pointerEvents off while hidden so it can't eat taps. */}
        <Animated.View
          pointerEvents={stickyShown ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            // 헤더 높이(소수점)가 반올림되며 헤더와 이 바 사이에 1px 틈이 생겨 내용이 새 보인다 → 1px 겹쳐 메운다.
            top: headerH - 1,
            left: 0,
            right: 0,
            zIndex: 20,
            opacity: stickyAnim,
            transform: [
              { translateY: stickyAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
            ],
          }}>
          <Pressable onPress={() => budgetRef.current?.present()}>
            <View className="border-b border-line" style={{ backgroundColor: Palette.paper }}>
              <View
                className="flex-row items-center justify-between px-5 py-3"
                style={webScrollContent}>
                <Text className="text-[11px] uppercase tracking-wider text-muted font-sans-semibold">
                  {m}월 · {remaining !== null ? '남은 예산' : '합계'}
                </Text>
                <Text
                  className={`text-base font-mono-semibold ${
                    remaining !== null && remaining < 0 ? 'text-expense' : 'text-ink'
                  }`}>
                  {formatCurrency(remaining ?? summary.balance, settings.currency)}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Add FAB */}
        <Pressable
          onPress={() => openAdd(mode === 'calendar' ? selectedDay : defaultAddDay)}
          className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-ink active:opacity-80"
          style={{
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          }}>
          <Plus size={26} color={Palette.paper} />
        </Pressable>
      </View>

      <RecordDrawer ref={drawerRef} year={y} month={m} />
      <BudgetDrawer ref={budgetRef} year={y} month={m} />
    </Screen>
  );
}

function SegmentButton({
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

function MonthCalendar({
  year,
  month,
  rows,
  selectedDay,
  onSelectDay,
}: {
  year: number;
  month: number;
  rows: Transaction[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
}) {
  const totalDays = daysInMonth(year, month);
  const leading = firstWeekdayOfMonth(year, month);
  const wide = useIsWideScreen();
  // Taller cells on wide (web) fit merchant+amount rows; mobile fits amount-only rows.
  const cellHeight = wide ? 88 : 84;

  const byDay = useMemo(() => {
    const map: Record<number, Transaction[]> = {};
    for (const r of rows) {
      if (r.day == null) continue;
      (map[r.day] ??= []).push(r);
    }
    // Largest magnitude first — the 3 shown are the day's most significant entries.
    for (const key of Object.keys(map)) {
      map[Number(key)].sort(
        (a, b) => (Math.abs(Number(b.amount)) || 0) - (Math.abs(Number(a.amount)) || 0),
      );
    }
    return map;
  }, [rows]);

  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  return (
    <View>
      <View className="flex-row">
        {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
          <View key={w} style={{ width: `${100 / 7}%` }} className="items-center pb-2">
            <Text
              className={`text-[11px] font-sans-semibold ${i === 0 ? 'text-expense' : 'text-muted'}`}>
              {w}
            </Text>
          </View>
        ))}
      </View>
      {/* Horizontal ledger rules only (no verticals → no crosshairs): cells carry the top rule,
          the container closes the bottom. Warm paper-ledger feel; still distinguishes weeks. */}
      <View className={`flex-row flex-wrap ${wide ? 'border-b border-line' : ''}`}>
        {cells.map((day, idx) => {
          const items = day != null ? byDay[day] : undefined;
          const today = day != null && isToday(year, month, day);
          const selected = day != null && day === selectedDay;
          return (
            <View
              key={idx}
              style={{ width: `${100 / 7}%`, height: cellHeight }}
              className={`items-center ${wide ? 'border-t border-line' : ''}`}>
              {day != null && (
                <Pressable
                  onPress={() => onSelectDay(day)}
                  className={`h-full w-full items-center justify-start rounded-2xl pt-1.5 ${selected ? 'bg-fill' : ''} active:opacity-60`}>
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full ${
                      today ? 'bg-ink' : selected ? 'border border-ink' : ''
                    }`}>
                    <Text className={`text-xs font-mono ${today ? 'text-paper' : 'text-ink'}`}>
                      {day}
                    </Text>
                  </View>
                  {items && items.length > 0 && <DayItemsPreview items={items} wide={wide} />}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Compact in-cell preview of a day's transactions (up to 3, largest first, "+N 더" for the rest).
 * Wide (web): merchant + colored amount rows. Narrow (mobile): amount-only, centered — the cell is
 * ~1/7 of the width, so merchant names wouldn't fit. Sign/color derive from type (지출 red -, 수입
 * green +, 이체 blue).
 */
function DayItemsPreview({ items, wide }: { items: Transaction[]; wide: boolean }) {
  const shown = items.slice(0, 3);
  const extra = items.length - shown.length;
  return (
    <View className="mt-1 w-full px-1" style={wide ? { maxWidth: 116 } : undefined}>
      {shown.map((t) => {
        const isExpense = t.type === '지출';
        const isIncome = t.type === '수입';
        const color = isExpense ? 'text-expense' : isIncome ? 'text-income' : 'text-transfer';
        const amount = `${isExpense ? '-' : isIncome ? '+' : ''}${formatAmount(
          Math.abs(Number(t.amount) || 0),
        )}`;
        if (wide) {
          const name = t.merchant || t.category || '기록';
          const short = name.length > 6 ? `${name.slice(0, 6)}…` : name;
          // Merchant recedes (taupe); amount keeps its semantic color — 지출 red, 수입 green,
          // 이체 muted. Merchant flex-1 keeps the amount right-aligned (justify-between); the
          // narrow maxWidth (not a big gap) is what pulls the two columns close together.
          const amountColor = isExpense ? 'text-expense' : isIncome ? 'text-income' : 'text-muted';
          return (
            <View key={t.id} className="flex-row items-baseline gap-0.5">
              <Text
                numberOfLines={1}
                className="flex-1 text-[10px] leading-[13px] text-muted font-sans">
                {short}
              </Text>
              <Text
                numberOfLines={1}
                className={`text-[10px] leading-[13px] font-mono ${amountColor}`}>
                {amount}
              </Text>
            </View>
          );
        }
        return (
          <Text
            key={t.id}
            numberOfLines={1}
            className={`text-center text-[9px] leading-[12px] font-mono ${color}`}>
            {amount}
          </Text>
        );
      })}
      {extra > 0 && (
        <Text
          className={`text-[9px] text-muted font-sans ${wide ? 'leading-[13px]' : 'text-center leading-[12px]'}`}>
          +{extra} 더
        </Text>
      )}
    </View>
  );
}

function FirstRecordEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="mt-10 items-center px-6">
      <Text className="text-center text-base leading-6 text-muted font-sans">
        아직 기록이 없어요.{'\n'}이번 달의 첫 기록을 남겨보세요.
      </Text>
      <Pressable onPress={onAdd} className="mt-5 rounded-full bg-ink px-6 py-3 active:opacity-80">
        <Text className="text-sm text-paper font-sans-bold">기록 남기기</Text>
      </Pressable>
    </View>
  );
}

function SelectedDayDetail({
  year,
  month,
  day,
  rows,
  iconByCategory,
  currency,
  onAdd,
  onEditRow,
}: {
  year: number;
  month: number;
  day: number;
  rows: Transaction[];
  iconByCategory: Record<string, string>;
  currency: string;
  onAdd: () => void;
  onEditRow: (tx: Transaction) => void;
}) {
  return (
    <View className="mt-6">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs text-muted font-sans-semibold">
          {month}월 {day}일 {weekdayLabel(year, month, day)}
        </Text>
        <Pressable
          onPress={onAdd}
          hitSlop={8}
          className="flex-row items-center gap-1 active:opacity-60">
          <Plus size={14} color={Palette.muted} />
          <Text className="text-xs text-muted font-sans-semibold">추가</Text>
        </Pressable>
      </View>
      {rows.length === 0 ? (
        <View className="mt-2">
          <EmptyState message="이 날은 아직 기록이 없어요." />
        </View>
      ) : (
        rows.map((row) => (
          <TransactionRow
            key={row.id}
            row={row}
            icon={iconByCategory[row.category ?? '']}
            currency={currency}
            onPress={() => onEditRow(row)}
          />
        ))
      )}
    </View>
  );
}
