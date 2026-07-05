import { useRouter } from 'expo-router';
import { ChevronRight, Layers, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { FadeIn } from '@/components/fade-in';
import { FixedExpenseDrawer, type FixedExpenseDrawerRef } from '@/components/fixed-expense-drawer';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { formatAmount, formatCurrency, parseAmount } from '@/lib/money';
import { useLedgerStore } from '@/store/ledger-store';
import type { FixedExpense } from '@/types/ledger';

export default function SettingsView() {
  const router = useRouter();

  const settingsBudget = useLedgerStore((s) => s.settings.budget);
  const currency = useLedgerStore((s) => s.settings.currency);
  const fixedExpenses = useLedgerStore((s) => s.settings.fixedExpenses);
  const categories = useLedgerStore((s) => s.categories);
  const updateSettings = useLedgerStore((s) => s.updateSettings);

  const categoryCount = categories.filter((c) => !c.deleted).length;

  // Default budget: local buffer, committed to the store on blur (mirrors BudgetDrawer).
  const [budgetText, setBudgetText] = useState(settingsBudget ? String(settingsBudget) : '');
  useEffect(() => {
    setBudgetText(settingsBudget ? String(settingsBudget) : '');
  }, [settingsBudget]);

  const drawerRef = useRef<FixedExpenseDrawerRef>(null);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const openAdd = () => {
    setEditing(null);
    drawerRef.current?.present();
  };
  const openEdit = (expense: FixedExpense) => {
    setEditing(expense);
    drawerRef.current?.present();
  };

  const commitBudget = () => updateSettings({ budget: parseAmount(budgetText) });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}
        keyboardShouldPersistTaps="handled">
        <AppHeader title="Settings" subtitle="예산 · 카테고리 · 고정 지출" />

        {/* Default budget */}
        <FadeIn>
          <SectionHeader title="기본 예산" />
          <View className="rounded-2xl border border-line bg-white/60 px-5 py-4">
            <Text className="text-sm text-muted font-sans">매달 기본으로 적용될 예산</Text>
            <View className="mt-2 flex-row items-end justify-end gap-1">
              <TextInput
                value={budgetText ? formatAmount(parseAmount(budgetText)) : ''}
                onChangeText={(t) => {
                  const n = parseAmount(t);
                  setBudgetText(n ? String(n) : '');
                }}
                onEndEditing={commitBudget}
                onBlur={commitBudget}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Palette.line}
                className="text-3xl text-ink font-mono-semibold"
              />
              <Text className="pb-1 text-lg text-muted font-serif">원</Text>
            </View>
          </View>
        </FadeIn>

        {/* Categories */}
        <FadeIn delay={60} style={{ marginTop: 28 }}>
          <SectionHeader title="카테고리" />
          <Pressable
            onPress={() => router.push('/settings/categories')}
            className="flex-row items-center rounded-2xl border border-line bg-white/60 px-5 py-4 active:opacity-70">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-fill">
              <Layers size={18} color={Palette.ink} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] text-ink font-sans-medium">카테고리 관리</Text>
              <Text className="mt-0.5 text-xs text-muted font-sans">{categoryCount}개 분류</Text>
            </View>
            <ChevronRight size={20} color={Palette.muted} />
          </Pressable>
        </FadeIn>

        {/* Fixed expenses */}
        <FadeIn delay={120} style={{ marginTop: 28 }}>
          <SectionHeader
            title="고정 지출"
            action={
              <Pressable
                onPress={openAdd}
                hitSlop={8}
                className="flex-row items-center gap-1 rounded-full bg-fill px-3 py-1.5 active:opacity-70">
                <Plus size={14} color={Palette.ink} />
                <Text className="text-[11px] uppercase tracking-wider text-ink font-sans-bold">
                  추가
                </Text>
              </Pressable>
            }
          />
          {fixedExpenses.length === 0 ? (
            <View className="items-center rounded-2xl border border-line bg-white/60 px-5 py-8">
              <Text className="text-center text-sm leading-6 text-muted font-sans">
                아직 등록된 고정 지출이 없어요.{'\n'}매달 나가는 지출을 더해보세요.
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {fixedExpenses.map((expense) => (
                <FixedExpenseCard
                  key={expense.id}
                  expense={expense}
                  currency={currency}
                  onPress={() => openEdit(expense)}
                />
              ))}
            </View>
          )}
        </FadeIn>
      </ScrollView>

      <FixedExpenseDrawer
        ref={drawerRef}
        expense={editing}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-[11px] uppercase tracking-[2px] text-ink font-sans-bold">{title}</Text>
      {action}
    </View>
  );
}

function FixedExpenseCard({
  expense,
  currency,
  onPress,
}: {
  expense: FixedExpense;
  currency: string;
  onPress: () => void;
}) {
  const schedule = expense.date != null ? `매월 ${expense.date}일` : '결제일 미정';
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl border border-line bg-white/60 px-5 py-4 active:opacity-70">
      <View className="flex-1">
        <Text className="text-[15px] text-ink font-sans-medium" numberOfLines={1}>
          {expense.title || '이름 없음'}
        </Text>
        <Text className="mt-0.5 text-xs text-muted font-sans">
          {expense.type} · {schedule}
        </Text>
      </View>
      <Text className="text-[15px] text-expense font-mono-medium">
        {formatCurrency(expense.amount, currency)}
      </Text>
    </Pressable>
  );
}
