import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Palette } from '@/constants/palette';
import { formatSignedCurrency } from '@/lib/money';
import type { Transaction } from '@/types/ledger';

/**
 * One transaction line — a category-icon disc + 거래처/분류 (with a 할부 N/M badge on installment
 * slices) + the signed amount. Shared so a transaction reads identically wherever it appears: the
 * month spreadsheet list, the calendar day detail, and the search results. Extracted from the month
 * screen (was a file-local helper) when search adopted the same row design.
 */
export function TransactionRow({
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
  const isInstallment = (row.installmentCount ?? 0) > 1;
  // Secondary line: 할부 badge · category · subcategory — whichever are present, joined by " · ".
  const subtitle = [
    isInstallment ? `할부 ${row.installmentSeq}/${row.installmentCount}` : null,
    row.category || null,
    row.subcategory || null,
  ]
    .filter(Boolean)
    .join(' · ');
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
        {!!subtitle && (
          <Text className="mt-0.5 text-xs text-muted font-sans" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Text className={`text-[15px] font-mono-medium ${amountClass}`}>
        {formatSignedCurrency(row.amount, row.type, currency)}
      </Text>
    </Pressable>
  );
}
