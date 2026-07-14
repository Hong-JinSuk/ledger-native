import { useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { FixedExpenseCard } from '@/components/fixed-expense-card';
import { FixedExpenseDrawer, type FixedExpenseDrawerRef } from '@/components/fixed-expense-drawer';
import { Screen } from '@/components/screen';
import { webScrollContent } from '@/constants/layout';
import { Palette } from '@/constants/palette';
import { monthFixedExpenses } from '@/lib/ledger/budget';
import { useLedgerStore } from '@/store/ledger-store';
import type { FixedExpense } from '@/types/ledger';

/**
 * Per-month fixed-expense editor. Edits THIS month's own fixed expenses, independent of Settings. A
 * month starts empty unless the user applied the Settings defaults; anything added here stays on this
 * month only. The Settings list is just the default offered when a month is first set up.
 */
export default function MonthFixedExpensesView() {
  const { year, month } = useLocalSearchParams<{ year: string; month: string }>();
  const y = Number(year);
  const m = Number(month);

  const settings = useLedgerStore((s) => s.settings);
  // The list in effect for this month: its snapshot if frozen, else the live template (tombstones dropped).
  const expenses = useMemo(() => monthFixedExpenses(settings, y, m), [settings, y, m]);

  const drawerRef = useRef<FixedExpenseDrawerRef>(null);
  const openAdd = () => drawerRef.current?.present();
  const openEdit = (expense: FixedExpense) => drawerRef.current?.present(expense);

  return (
    <Screen webFull>
      <View className="flex-1">
        <ScrollView
          contentContainerStyle={[
            { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 },
            webScrollContent,
          ]}
          keyboardShouldPersistTaps="handled">
          <AppHeader
            title={`${m}월 고정 지출`}
            subtitle="이 달에만 적용돼요"
            backLabel={`${m}월`}
            size="md"
          />

          <FadeIn>
            <Text className="mb-4 text-xs leading-5 text-muted font-sans">
              여기서 바꾸면 이 달에만 반영돼요. 매달 기본값은 설정에서 관리해요.
            </Text>

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[11px] uppercase tracking-[2px] text-ink font-sans-bold">
                고정 지출
              </Text>
              <Pressable
                onPress={openAdd}
                hitSlop={8}
                className="flex-row items-center gap-1 rounded-full bg-fill px-3 py-1.5 active:opacity-70">
                <Plus size={14} color={Palette.ink} />
                <Text className="text-[11px] uppercase tracking-wider text-ink font-sans-bold">
                  추가
                </Text>
              </Pressable>
            </View>

            {expenses.length === 0 ? (
              <EmptyState message={'이 달에 적용할 고정 지출이 없어요.\n추가하면 이 달에만 반영돼요.'} />
            ) : (
              <View className="gap-2.5">
                {expenses.map((expense) => (
                  <FixedExpenseCard
                    key={expense.id}
                    expense={expense}
                    currency={settings.currency}
                    onPress={() => openEdit(expense)}
                  />
                ))}
              </View>
            )}
          </FadeIn>
        </ScrollView>
      </View>

      <FixedExpenseDrawer ref={drawerRef} month={{ year: y, month: m }} />
    </Screen>
  );
}
