import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Plus, Trash2 } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
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

export type FixedExpenseDrawerRef = {
  /** Open the sheet. Pass an expense to edit, or nothing/null to add a new one. */
  present: (expense?: FixedExpense | null) => void;
  dismiss: () => void;
};

type Props = { onClose?: () => void };

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
  function FixedExpenseDrawer({ onClose }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    // The drawer owns "which expense" (set at present time) — decoupled from parent async state so a
    // fresh +추가 always opens blank instead of leaking the previous entry.
    const [expense, setExpense] = useState<FixedExpense | null>(null);

    const types = useLedgerStore((s) => s.settings.fixedExpenseTypes);
    const updateSettings = useLedgerStore((s) => s.updateSettings);
    const confirm = useConfirm();

    const { control, handleSubmit, reset } = useForm<FixedExpenseFormValues>({
      resolver: zodResolver(fixedExpenseFormSchema),
      defaultValues: toDefaults(null, types),
    });

    useImperativeHandle(ref, () => ({
      present: (e = null) => {
        setExpense(e);
        // Reset on every open, reading the freshest types — never carries over the last entry.
        reset(toDefaults(e, useLedgerStore.getState().settings.fixedExpenseTypes));
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const isEdit = expense != null;
    const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

    // Type (유형) inline add / delete.
    const [addingType, setAddingType] = useState(false);
    const [newType, setNewType] = useState('');

    const commitNewType = useCallback(
      (select: (t: string) => void) => {
        const name = newType.trim();
        if (name) {
          if (!types.includes(name)) updateSettings({ fixedExpenseTypes: [...types, name] });
          select(name);
        }
        setNewType('');
        setAddingType(false);
      },
      [newType, types, updateSettings],
    );

    const deleteType = useCallback(
      async (t: string) => {
        const ok = await confirm({
          title: `'${t}' 유형을 삭제할까요?`,
          message: '이 유형이 목록에서 사라져요. (기존 기록은 그대로예요.)',
        });
        if (ok) updateSettings({ fixedExpenseTypes: types.filter((x) => x !== t) });
      },
      [types, updateSettings, confirm],
    );

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

          {/* Type — tap to select, long-press to delete, "+ 유형" to add a new one */}
          <Field label="유형">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row items-center gap-2">
                      {types.map((t) => {
                        const active = field.value === t;
                        return (
                          <Pressable
                            key={t}
                            onPress={() => field.onChange(t)}
                            onLongPress={() => deleteType(t)}
                            delayLongPress={350}
                            className={`rounded-full px-4 py-2.5 ${active ? 'bg-ink' : 'bg-fill'}`}>
                            <Text
                              className={`text-sm font-sans-semibold ${active ? 'text-paper' : 'text-muted'}`}>
                              {t}
                            </Text>
                          </Pressable>
                        );
                      })}

                      {addingType ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-fill py-1 pl-3.5 pr-1">
                          <SheetTextInput
                            value={newType}
                            onChangeText={setNewType}
                            onSubmitEditing={() => commitNewType(field.onChange)}
                            autoFocus
                            placeholder="새 유형"
                            placeholderTextColor={Palette.muted}
                            className="min-w-[56px] text-sm text-ink font-sans-semibold"
                          />
                          <Pressable
                            onPress={() => commitNewType(field.onChange)}
                            hitSlop={6}
                            className="h-7 w-7 items-center justify-center rounded-full bg-ink active:opacity-80">
                            <Check size={14} color={Palette.paper} strokeWidth={3} />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => setAddingType(true)}
                          className="flex-row items-center gap-1 rounded-full border border-dashed border-line px-3.5 py-2.5 active:opacity-70">
                          <Plus size={13} color={Palette.muted} />
                          <Text className="text-sm text-muted font-sans-semibold">유형</Text>
                        </Pressable>
                      )}
                    </View>
                  </ScrollView>
                  <Text className="mt-2 text-[11px] text-muted font-sans">
                    유형을 길게 누르면 삭제할 수 있어요.
                  </Text>
                </View>
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
