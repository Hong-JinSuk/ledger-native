import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { AdaptiveSheet, type AdaptiveSheetRef } from '@/components/adaptive-sheet';
import { AmountInput } from '@/components/amount-input';
import { useConfirm } from '@/components/confirm-dialog';
import { SheetTextInput } from '@/components/sheet-text-input';
import { useToast } from '@/components/toast';
import { Palette } from '@/constants/palette';
import { animateNextLayout } from '@/lib/animate-next-layout';
import { daysInMonth } from '@/lib/date';
import { summarizeInstallment } from '@/lib/ledger/installment';
import { formatAmount } from '@/lib/money';
import { syncOnEditEnd } from '@/lib/sync/sync-service';
import { transactionFormSchema, type TransactionFormValues } from '@/schemas/transaction';
import { useLedgerStore } from '@/store/ledger-store';
import type { Transaction, TransactionType } from '@/types/ledger';

const TYPES: TransactionType[] = ['지출', '수입', '이체'];

export type RecordDrawerRef = {
  /** Open the sheet. Pass a transaction to edit, or nothing/null (+ optional day) to add a new one. */
  present: (transaction?: Transaction | null, defaultDay?: number | null) => void;
  dismiss: () => void;
};

type Props = {
  year: number;
  month: number;
  onClose?: () => void;
};

function toDefaults(tx: Transaction | null, defaultDay: number | null): TransactionFormValues {
  if (!tx) {
    return { type: '지출', amount: 0, category: undefined, merchant: '', day: defaultDay, note: '' };
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
  { year, month, onClose },
  ref,
) {
  const sheetRef = useRef<AdaptiveSheetRef>(null);
  // The drawer owns "which row" (set at present time), so a fresh add always opens blank instead of
  // reusing the previous entry — decoupled from the parent's async state.
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  // 할부 개월 수 (1 = 일시불). Drawer-local, reset on every open. Used both when adding a new expense and
  // when editing an existing installment (edit re-splits the whole thing). `anchorMonth` is the
  // installment's original first month, so the preview says "N월부터" correctly even when editing a later slice.
  // `monthsText` is the raw text of the "직접 입력" field (any number of months, e.g. 7/32) — kept separate
  // from the derived count so typing "1"→"12" isn't clobbered mid-keystroke.
  const [installmentMonths, setInstallmentMonths] = useState(1);
  const [monthsText, setMonthsText] = useState('');
  const [installmentAnchorMonth, setInstallmentAnchorMonth] = useState<number | null>(null);

  const categories = useLedgerStore((s) => s.categories);
  const addTransaction = useLedgerStore((s) => s.addTransaction);
  const addInstallment = useLedgerStore((s) => s.addInstallment);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
  const updateInstallment = useLedgerStore((s) => s.updateInstallment);
  const deleteTransaction = useLedgerStore((s) => s.deleteTransaction);
  const deleteInstallment = useLedgerStore((s) => s.deleteInstallment);
  const confirm = useConfirm();
  const toast = useToast();

  const isEdit = transaction != null;
  const { control, handleSubmit, reset, watch, setValue } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: toDefaults(null, null),
  });

  useImperativeHandle(ref, () => ({
    present: (tx = null, defaultDay = null) => {
      setTransaction(tx);
      // Reset on every open so a fresh add never carries over the previous entry.
      reset(toDefaults(tx, defaultDay));
      if (tx?.installmentId) {
        // Editing an installment → treat it as ONE unit: prefill the TOTAL (sum of its slices) and its
        // month count, anchored to the original first month. Re-saving re-splits — which also heals a
        // stale/mis-split installment (e.g. one that has the whole amount on the first month).
        const sum = summarizeInstallment(useLedgerStore.getState().records, tx.installmentId);
        const m = sum?.count ?? tx.installmentCount ?? 1;
        setInstallmentMonths(m);
        setMonthsText(m > 1 ? String(m) : '');
        setInstallmentAnchorMonth(sum?.firstMonth ?? tx.month);
        if (sum) setValue('amount', sum.total);
      } else {
        setInstallmentMonths(1);
        setMonthsText('');
        setInstallmentAnchorMonth(null);
      }
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const selectedType = watch('type');
  const amountValue = watch('amount');
  // 할부 control shows for a new expense OR when editing an existing installment (edit the whole unit).
  // Per-month = floor(total / months); the leftover rides the first month (mirrors the store's split) so
  // the preview matches what actually gets recorded.
  const editingInstallment = isEdit && !!transaction?.installmentId;
  const showInstallment = selectedType === '지출' && (!isEdit || editingInstallment);
  const perMonth = installmentMonths > 1 ? Math.floor(amountValue / installmentMonths) : 0;
  const firstMonthExtra = installmentMonths > 1 ? amountValue - perMonth * installmentMonths : 0;
  // The month the split starts from: the installment's original first month when editing, else this screen's.
  const previewStartMonth = installmentAnchorMonth ?? month;

  // Pick a preset (일시불 / 2·3·6·12개월) — mirror the choice into the "직접 입력" field so both stay in sync.
  const pickInstallmentMonths = (months: number) => {
    setInstallmentMonths(months);
    setMonthsText(months > 1 ? String(months) : '');
  };
  // Typing an arbitrary month count. Keep the raw digits as the field's text (so "1"→"12" isn't clobbered);
  // derive the count from it, where empty/0/1 all mean 일시불.
  const onChangeMonthsText = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setMonthsText(digits);
    const n = digits ? parseInt(digits, 10) : 1;
    setInstallmentMonths(n < 1 ? 1 : n);
  };

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
      animateNextLayout(); // gently settle the list when a row is added / its height changes
      if (isEdit && transaction) {
        if (transaction.installmentId) {
          // Edit the WHOLE installment: re-split the total over the chosen months from its original start.
          // installmentMonths === 1 collapses it back to a single 일시불 record (other months tombstoned).
          updateInstallment(transaction.installmentId, {
            total: values.amount,
            count: Math.max(1, installmentMonths),
            day: values.day,
            type: values.type,
            category: values.category,
            merchant: values.merchant,
            note: values.note,
          });
        } else {
          updateTransaction(year, month, transaction.id, {
            type: values.type,
            amount: values.amount,
            category: values.category ?? '',
            merchant: values.merchant ?? '',
            day: values.day,
            note: values.note ?? '',
          });
        }
      } else if (values.type === '지출' && installmentMonths > 1) {
        // 할부: split the total into one record per month (spilling into future months). Records only —
        // never Settings — so the setup of any month a slice lands in stays untouched.
        addInstallment({
          year,
          month,
          type: values.type,
          amount: values.amount,
          category: values.category,
          merchant: values.merchant,
          day: values.day,
          note: values.note,
          count: installmentMonths,
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
      const installmentAdded = !isEdit && values.type === '지출' && installmentMonths > 1;
      toast.success(
        isEdit ? '수정했어요' : installmentAdded ? `${installmentMonths}개월 할부로 기록했어요` : '기록했어요',
      );
      sheetRef.current?.dismiss();
    },
    [
      isEdit,
      transaction,
      updateTransaction,
      updateInstallment,
      addTransaction,
      addInstallment,
      installmentMonths,
      year,
      month,
      toast,
    ],
  );

  const onDelete = useCallback(async () => {
    if (!transaction) return;
    const { installmentId, installmentCount = 0 } = transaction;
    if (installmentId && installmentCount > 1) {
      // Deleting one slice removes the WHOLE installment (every month) — otherwise the other months
      // would be orphaned. The confirm spells that out.
      const ok = await confirm({
        title: '할부 전체를 삭제할까요?',
        message: `${installmentCount}개월 할부 ${installmentCount}건이 모두 삭제돼요. 되돌릴 수 없어요.`,
      });
      if (!ok) return;
      animateNextLayout();
      deleteInstallment(installmentId);
      sheetRef.current?.dismiss();
      return;
    }
    const ok = await confirm({ title: '이 기록을 삭제할까요?', message: '삭제하면 되돌릴 수 없어요.' });
    if (!ok) return;
    animateNextLayout(); // gently collapse the removed row
    deleteTransaction(year, month, transaction.id);
    sheetRef.current?.dismiss();
  }, [transaction, deleteTransaction, deleteInstallment, year, month, confirm]);

  return (
    <AdaptiveSheet
      ref={sheetRef}
      snapPoints={['88%']}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      onDismiss={() => {
        onClose?.();
        syncOnEditEnd(); // write-end: push this edit to Drive (no-op if nothing changed)
      }}>
        <View className="mb-6">
          <Text className="text-2xl text-ink font-serif">{isEdit ? '기록 수정' : '새 기록'}</Text>
          {editingInstallment && (
            <View className="mt-1.5 self-start rounded-full bg-fill px-3 py-1">
              <Text className="text-xs text-muted font-sans-medium">할부 전체를 함께 수정해요</Text>
            </View>
          )}
        </View>

        {/* Amount — for an installment this is the TOTAL, split over the months (labeled so the big
            number never reads as a single month's charge). */}
        <View className="mb-6">
          {showInstallment && installmentMonths > 1 && (
            <Text className="mb-1 text-center text-xs text-muted font-sans-medium">
              할부 총액 · {installmentMonths}개월
            </Text>
          )}
          <View className="flex-row items-end justify-center gap-1">
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <AmountInput
                  value={field.value}
                  onChangeValue={field.onChange}
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
            />
            <Text className="pb-1 text-xl text-muted font-serif">원</Text>
          </View>
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
                        if (t !== '지출') pickInstallmentMonths(1); // 할부 is expense-only
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

        {/* Installment (할부) — 일시불 toggle OR a free numeric month count (7/8/32개월 etc.). */}
        {showInstallment && (
          <Field label="할부">
            <View className="flex-row items-center gap-2.5">
              <InstallmentChip
                label="일시불"
                active={installmentMonths === 1}
                onPress={() => pickInstallmentMonths(1)}
              />
              <Text className="text-sm text-muted font-sans">또는</Text>
              <View className="flex-row items-center rounded-full bg-fill px-3.5 py-2">
                <SheetTextInput
                  value={monthsText}
                  onChangeText={onChangeMonthsText}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Palette.line}
                  maxLength={2}
                  className="min-w-[32px] text-center text-sm text-ink font-mono-medium"
                />
                <Text className="ml-0.5 text-sm text-muted font-sans-medium">개월</Text>
              </View>
            </View>

            {installmentMonths > 1 && (
              <View className="mt-2.5 rounded-2xl bg-fill px-4 py-3">
                {amountValue > 0 && (
                  <Text className="text-sm text-ink font-sans-medium">
                    {firstMonthExtra > 0
                      ? `첫 달 ${formatAmount(perMonth + firstMonthExtra)}원, 이후 매달 ${formatAmount(perMonth)}원`
                      : `매달 ${formatAmount(perMonth)}원`}
                  </Text>
                )}
                <Text className={`text-xs text-muted font-sans ${amountValue > 0 ? 'mt-0.5' : ''}`}>
                  {previewStartMonth}월부터 {installmentMonths}개월 동안 나눠서 기록돼요.
                </Text>
              </View>
            )}
          </Field>
        )}

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
              <SheetTextInput
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
    </AdaptiveSheet>
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

function InstallmentChip({
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
      className={`items-center rounded-full px-3.5 py-2 ${active ? 'bg-ink' : 'bg-fill'}`}>
      <Text className={`text-sm font-sans-medium ${active ? 'text-paper' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
