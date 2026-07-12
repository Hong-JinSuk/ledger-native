import { Pressable, Text, View } from 'react-native';

import { formatCurrency } from '@/lib/money';
import type { FixedExpense } from '@/types/ledger';

/** A single fixed-expense row (name + type · schedule + amount). Tap to edit. Shared by Settings
 *  (the live template) and the per-month editor (a month's frozen snapshot). */
export function FixedExpenseCard({
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
