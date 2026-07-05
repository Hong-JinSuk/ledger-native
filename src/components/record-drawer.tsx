import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Palette } from '@/constants/palette';
import { daysInMonth } from '@/lib/date';
import { formatAmount, parseAmount } from '@/lib/money';
import { transactionFormSchema, type TransactionFormValues } from '@/schemas/transaction';
import { useLedgerStore } from '@/store/ledger-store';
import type { Transaction, TransactionType } from '@/types/ledger';

const TYPES: TransactionType[] = ['지출', '수입', '이체'];

export type RecordDrawerRef = { present: () => void; dismiss: () => void };

type Props = {
  year: number;
  month: number;
  /** The row being edited, or null to add a new one. */
  transaction: Transaction | null;
  onClose?: () => void;
};

function toDefaults(tx: Transaction | null): TransactionFormValues {
  if (!tx) {
    return { type: '지출', amount: 0, category: undefined, merchant: '', day: null, note: '' };
  }
  return {
    type: (tx.type || '지출') as TransactionType,
    amount: tx.amount,
    category: tx.category || undefined,
    merchant: tx.merchant || '',
    day: tx.day,
    note: tx.note || '',
  };
}

export const RecordDrawer = forwardRef<RecordDrawerRef, Props>(function RecordDrawer(
  { year, month, transaction, onClose },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const categories = useLedgerStore((s) => s.categories);
  const addTransaction = useLedgerStore((s) => s.addTransaction);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
  const deleteTransaction = useLedgerStore((s) => s.deleteTransaction);

  const isEdit = transaction != null;
  const { control, handleSubmit, reset, watch, setValue } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: toDefaults(transaction),
  });

  useEffect(() => {
    reset(toDefaults(transaction));
  }, [transaction, reset]);

  const selectedType = watch('type');
  const visibleCategories = useMemo(
    () => categories.filter((c) => !c.deleted && c.type === selectedType),
    [categories, selectedType],
  );

  const days = useMemo(
    () => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
    [year, month],
  );

  const onSubmit = useCallback(
    (values: TransactionFormValues) => {
      if (isEdit && transaction) {
        updateTransaction(year, month, transaction.id, {
          type: values.type,
          amount: values.amount,
          category: values.category ?? '',
          merchant: values.merchant ?? '',
          day: values.day,
          note: values.note ?? '',
        });
      } else {
        addTransaction({
          year,
          month,
          type: values.type,
          amount: values.amount,
          category: values.category,
          merchant: values.merchant,
          day: values.day,
          note: values.note,
        });
      }
      sheetRef.current?.dismiss();
    },
    [isEdit, transaction, updateTransaction, addTransaction, year, month],
  );

  const onDelete = useCallback(() => {
    if (!transaction) return;
    Alert.alert('이 기록을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(year, month, transaction.id);
          sheetRef.current?.dismiss();
        },
      },
    ]);
  }, [transaction, deleteTransaction, year, month]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['88%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: Palette.paper }}
      handleIndicatorStyle={{ backgroundColor: Palette.line }}
      onDismiss={onClose}>
      <BottomSheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="mb-6 text-2xl text-ink font-serif">
          {isEdit ? '기록 수정' : '새 기록'}
        </Text>

        {/* Amount */}
        <View className="mb-6 flex-row items-end justify-center gap-1">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <BottomSheetTextInput
                value={field.value ? formatAmount(field.value) : ''}
                onChangeText={(t) => field.onChange(parseAmount(t))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Palette.line}
                className="text-4xl text-ink font-mono-semibold"
              />
            )}
          />
          <Text className="pb-1 text-xl text-muted font-serif">원</Text>
        </View>

        {/* Type */}
        <Field label="종류">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <View className="flex-row gap-2">
                {TYPES.map((t) => {
                  const active = field.value === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => {
                        field.onChange(t);
                        setValue('category', undefined);
                      }}
                      className={`flex-1 items-center rounded-full py-2.5 ${active ? 'bg-ink' : 'bg-fill'}`}>
                      <Text
                        className={`text-sm font-sans-semibold ${active ? 'text-paper' : 'text-muted'}`}>
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </Field>

        {/* Category */}
        <Field label="카테고리">
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {visibleCategories.map((c) => {
                    const active = field.value === c.name;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => field.onChange(active ? undefined : c.name)}
                        className={`items-center rounded-2xl border px-3 py-2 ${active ? 'border-ink bg-ink' : 'border-line bg-white/60'}`}>
                        <CategoryIcon
                          name={c.icon}
                          size={18}
                          color={active ? Palette.paper : Palette.ink}
                        />
                        <Text
                          className={`mt-1 text-[11px] font-sans-medium ${active ? 'text-paper' : 'text-muted'}`}>
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          />
        </Field>

        {/* Merchant */}
        <Field label="거래처">
          <Controller
            control={control}
            name="merchant"
            render={({ field }) => (
              <BottomSheetTextInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder="어디에 썼나요?"
                placeholderTextColor={Palette.muted}
                className="rounded-2xl bg-fill px-4 py-3 text-base text-ink font-sans"
              />
            )}
          />
        </Field>

        {/* Day */}
        <Field label="날짜">
          <Controller
            control={control}
            name="day"
            render={({ field }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-1.5">
                  <DayChip label="미정" active={field.value == null} onPress={() => field.onChange(null)} />
                  {days.map((d) => (
                    <DayChip
                      key={d}
                      label={String(d)}
                      active={field.value === d}
                      onPress={() => field.onChange(d)}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          />
        </Field>

        {/* Note */}
        <Field label="메모">
          <Controller
            control={control}
            name="note"
            render={({ field }) => (
              <BottomSheetTextInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder="메모를 남겨보세요"
                placeholderTextColor={Palette.muted}
                multiline
                className="min-h-[64px] rounded-2xl bg-fill px-4 py-3 text-base text-ink font-sans"
              />
            )}
          />
        </Field>

        {/* Actions */}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          className="mt-4 items-center rounded-full bg-ink py-4 active:opacity-80">
          <Text className="text-base text-paper font-sans-bold">
            {isEdit ? '수정 완료' : '저장'}
          </Text>
        </Pressable>

        {isEdit && (
          <Pressable
            onPress={onDelete}
            className="mt-3 flex-row items-center justify-center gap-1.5 py-2 active:opacity-60">
            <Trash2 size={15} color={Palette.expense} />
            <Text className="text-sm text-expense font-sans-medium">삭제</Text>
          </Pressable>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-[11px] uppercase tracking-wider text-muted font-sans-semibold">
        {label}
      </Text>
      {children}
    </View>
  );
}

function DayChip({
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
      className={`min-w-[40px] items-center rounded-full px-3 py-2 ${active ? 'bg-ink' : 'bg-fill'}`}>
      <Text className={`text-sm font-mono-medium ${active ? 'text-paper' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
