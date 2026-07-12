import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { AppHeader } from '@/components/app-header';
import { useConfirm } from '@/components/confirm-dialog';
import { BudgetDrawer, type BudgetDrawerRef } from '@/components/budget-drawer';
import { CategoryIcon } from '@/components/category-icon';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { RecordDrawer, type RecordDrawerRef } from '@/components/record-drawer';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import {
  currentMonthKey,
  daysInMonth,
  firstWeekdayOfMonth,
  isToday,
  monthKey,
  weekdayLabel,
} from '@/lib/date';
import { getMonthlyBudget, monthFixedTotal } from '@/lib/ledger/budget';
import {
  activeRows,
  groupByDay,
  monthRemainingBudget,
  monthSummary,
  netTotal,
  searchRows,
  sortRowsByDayDesc,
} from '@/lib/ledger/selectors';
import { formatCurrency, formatSignedCurrency } from '@/lib/money';
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
  const confirm = useConfirm();
  const router = useRouter();

  const [mode, setMode] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const drawerRef = useRef<RecordDrawerRef>(null);
  const budgetRef = useRef<BudgetDrawerRef>(null);
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

  // First entry of the *current* month with no budget set → gently prompt once.
  const promptedRef = useRef(false);
  useEffect(() => {
    if (promptedRef.current) return;
    const isCurrent = key === currentMonthKey();
    const noBudget = getMonthlyBudget(settings, y, m) <= 0;
    const notConfirmed = settings.lastBudgetConfirmation !== currentMonthKey();
    if (isCurrent && noBudget && notConfirmed) {
      promptedRef.current = true;
      const t = setTimeout(() => budgetRef.current?.present(), 450);
      return () => clearTimeout(t);
    }
  }, [key, settings, y, m]);

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
    <Screen>
      <View className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 96 }}
          keyboardShouldPersistTaps="handled">
          <AppHeader
            title={`${y}. ${m}월`}
            subtitle={`${m}월의 기록`}
            backLabel="Months"
            size="md"
          />

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

          {/* Edit THIS month's fixed expenses (its frozen snapshot). Settings only seeds new months. */}
          <FadeIn>
            <Pressable
              onPress={goToFixed}
              hitSlop={8}
              className="mb-5 flex-row items-center gap-1.5 self-start py-1 pr-2 active:opacity-60">
              <Pencil size={13} color={Palette.muted} strokeWidth={2} />
              <Text className="text-xs text-muted font-sans-medium">
                {fixedTotal > 0 ? '이 달 고정 지출 수정' : '이 달 고정 지출 추가'}
              </Text>
            </Pressable>
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

function TransactionRow({
  row,
  icon,
  currency,
  onPress,
}: {
  row: Transaction;
  icon: string | undefined;
  currency: string;
  onPress: () => void;
}) {
  const tone =
    row.type === '수입' ? Palette.income : row.type === '지출' ? Palette.expense : Palette.transfer;
  const amountClass =
    row.type === '수입' ? 'text-income' : row.type === '지출' ? 'text-expense' : 'text-transfer';
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center border-b border-line/60 py-3 active:opacity-60">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-fill">
        <CategoryIcon name={icon} size={16} color={tone} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-[15px] text-ink font-sans-medium" numberOfLines={1}>
          {row.merchant || row.category || '무제목'}
        </Text>
        {!!row.category && (
          <Text className="mt-0.5 text-xs text-muted font-sans">{row.category}</Text>
        )}
      </View>
      <Text className={`text-[15px] font-mono-medium ${amountClass}`}>
        {formatSignedCurrency(row.amount, row.type, currency)}
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

  const byDay = useMemo(() => {
    const map: Record<number, { income: number; expense: number }> = {};
    for (const r of rows) {
      if (r.day == null) continue;
      const bucket = (map[r.day] ??= { income: 0, expense: 0 });
      if (r.type === '수입') bucket.income += Number(r.amount) || 0;
      else if (r.type === '지출') bucket.expense += Number(r.amount) || 0;
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
      <View className="flex-row flex-wrap">
        {cells.map((day, idx) => {
          const activity = day != null ? byDay[day] : undefined;
          const today = day != null && isToday(year, month, day);
          const selected = day != null && day === selectedDay;
          return (
            <View key={idx} style={{ width: `${100 / 7}%`, height: 56 }} className="items-center">
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
                  <View className="mt-1 h-1.5 flex-row gap-0.5">
                    {!!activity?.income && <View className="h-1.5 w-1.5 rounded-full bg-income" />}
                    {!!activity?.expense && <View className="h-1.5 w-1.5 rounded-full bg-expense" />}
                  </View>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
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
