import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useConfirm } from '@/components/confirm-dialog';
import { SheetTextInput } from '@/components/sheet-text-input';
import { Palette } from '@/constants/palette';
import { newId } from '@/lib/id';
import { formatAmount, parseAmount } from '@/lib/money';
import { fixedExpenseFormSchema, type FixedExpenseFormValues } from '@/schemas/fixed-expense';
import { useLedgerStore } from '@/store/ledger-store';
import type { FixedExpense } from '@/types/ledger';

export type FixedExpenseDrawerRef = { present: () => void; dismiss: () => void };

type Props = {
  /** The fixed expense being edited, or null to add a new one. */
  expense: FixedExpense | null;
  onClose?: () => void;
};

function toDefaults(expense: FixedExpense | null, types: string[]): FixedExpenseFormValues {
  if (!expense) {
    return { title: '', type: types[0] ?? '기타', amount: 0, date: null, note: '' };
  }
  return {
    title: expense.title,
    type: expense.type,
    amount: expense.amount,
    date: expense.date,
    note: expense.note || '',
  };
}

export const FixedExpenseDrawer = forwardRef<FixedExpenseDrawerRef, Props>(
  function FixedExpenseDrawer({ expense, onClose }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const types = useLedgerStore((s) => s.settings.fixedExpenseTypes);
    const updateSettings = useLedgerStore((s) => s.updateSettings);
    const confirm = useConfirm();

    const isEdit = expense != null;
    const { control, handleSubmit, reset } = useForm<FixedExpenseFormValues>({
      resolver: zodResolver(fixedExpenseFormSchema),
      defaultValues: toDefaults(expense, types),
    });

    useEffect(() => {
      reset(toDefaults(expense, types));
    }, [expense, types, reset]);

    const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

    const onSubmit = useCallback(
      (values: FixedExpenseFormValues) => {
        // Read the freshest array so concurrent edits don't clobber each other.
        const current = useLedgerStore.getState().settings.fixedExpenses;
        if (isEdit && expense) {
          const next = current.map((e) =>
            e.id === expense.id ? { ...e, ...values, note: values.note ?? '' } : e,
          );
          updateSettings({ fixedExpenses: next });
        } else {
          const created: FixedExpense = { id: newId(), ...values, note: values.note ?? '' };
          updateSettings({ fixedExpenses: [...current, created] });
        }
        sheetRef.current?.dismiss();
      },
      [isEdit, expense, updateSettings],
    );

    const onDelete = useCallback(async () => {
      if (!expense) return;
      const ok = await confirm({
        title: '이 고정 지출을 삭제할까요?',
        message: '삭제하면 되돌릴 수 없어요.',
      });
      if (!ok) return;
      const current = useLedgerStore.getState().settings.fixedExpenses;
      updateSettings({ fixedExpenses: current.filter((e) => e.id !== expense.id) });
      sheetRef.current?.dismiss();
    }, [expense, updateSettings, confirm]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['82%']}
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
            {isEdit ? '고정 지출 수정' : '새 고정 지출'}
          </Text>

          {/* Amount */}
          <View className="mb-6 flex-row items-end justify-center gap-1">
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <SheetTextInput
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

          {/* Title */}
          <Field label="이름">
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <SheetTextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="예: 넷플릭스, 월세"
                  placeholderTextColor={Palette.muted}
                  className="rounded-2xl bg-fill px-4 py-3 text-base text-ink font-sans"
                />
              )}
            />
          </Field>

          {/* Type */}
          <Field label="유형">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {types.map((t) => {
                      const active = field.value === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => field.onChange(t)}
                          className={`rounded-full px-4 py-2.5 ${active ? 'bg-ink' : 'bg-fill'}`}>
                          <Text
                            className={`text-sm font-sans-semibold ${active ? 'text-paper' : 'text-muted'}`}>
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            />
          </Field>

          {/* Date (day of month) */}
          <Field label="결제일">
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1.5">
                    <DayChip
                      label="미정"
                      active={field.value == null}
                      onPress={() => field.onChange(null)}
                    />
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
                <SheetTextInput
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
  },
);

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

function DayChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
