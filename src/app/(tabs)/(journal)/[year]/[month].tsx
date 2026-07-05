import { useLocalSearchParams } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { BackLink } from '@/components/back-link';
import { BudgetDrawer, type BudgetDrawerRef } from '@/components/budget-drawer';
import { CategoryIcon } from '@/components/category-icon';
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
import { getMonthlyBudget } from '@/lib/ledger/budget';
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

  const records = useLedgerStore((s) => s.records);
  const categories = useLedgerStore((s) => s.categories);
  const settings = useLedgerStore((s) => s.settings);

  const [mode, setMode] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');

  const drawerRef = useRef<RecordDrawerRef>(null);
  const budgetRef = useRef<BudgetDrawerRef>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const openAdd = () => {
    setEditing(null);
    drawerRef.current?.present();
  };
  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    drawerRef.current?.present();
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

  const rows = useMemo(() => activeRows(records[key]), [records, key]);
  const iconByCategory = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.name, c.icon])),
    [categories],
  );

  const summary = monthSummary(records[key]);
  const remaining = monthRemainingBudget(records[key], settings, y, m);

  const filtered = useMemo(() => sortRowsByDayDesc(searchRows(rows, query)), [rows, query]);
  const dayGroups = useMemo(() => {
    const groups = groupByDay(filtered);
    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a)
      .map((day) => ({ day, rows: groups[day] }));
  }, [filtered]);

  return (
    <Screen>
      <View className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 96 }}
          keyboardShouldPersistTaps="handled">
          <BackLink label="Months" />

          <View className="mb-5 mt-4">
            <Text className="text-3xl text-ink font-serif">
              {y}. {m}월
            </Text>
            <Text className="mt-2 text-[10px] uppercase tracking-[3px] text-muted font-sans-semibold">
              {m}월의 기록
            </Text>
          </View>

          {/* Summary — tap to set/edit this month's budget */}
          <FadeIn>
            <Pressable
              onPress={() => budgetRef.current?.present()}
              className="mb-5 rounded-2xl border border-line bg-white/60 px-5 py-5 active:opacity-70">
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
              </View>
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
              <EmptyState onAdd={openAdd} />
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
            <MonthCalendar year={y} month={m} rows={rows} />
          )}
        </ScrollView>

        {/* Add FAB */}
        <Pressable
          onPress={openAdd}
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

      <RecordDrawer
        ref={drawerRef}
        year={y}
        month={m}
        transaction={editing}
        onClose={() => setEditing(null)}
      />
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
}: {
  year: number;
  month: number;
  rows: Transaction[];
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
          return (
            <View
              key={idx}
              style={{ width: `${100 / 7}%`, height: 56 }}
              className="items-center justify-start pt-1.5">
              {day != null && (
                <>
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full ${today ? 'bg-ink' : ''}`}>
                    <Text className={`text-xs font-mono ${today ? 'text-paper' : 'text-ink'}`}>
                      {day}
                    </Text>
                  </View>
                  <View className="mt-1 h-1.5 flex-row gap-0.5">
                    {!!activity?.income && <View className="h-1.5 w-1.5 rounded-full bg-income" />}
                    {!!activity?.expense && <View className="h-1.5 w-1.5 rounded-full bg-expense" />}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
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
