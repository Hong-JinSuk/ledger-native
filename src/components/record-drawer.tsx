import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
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
import { daysInMonth, firstWeekdayOfMonth, isToday } from '@/lib/date';
import { summarizeInstallment } from '@/lib/ledger/installment';
import { categoryUsage, orderCategories } from '@/lib/ledger/selectors';
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
  // Date picker disclosure — the "M월 D일" badge toggles a calendar open right below it.
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  // The calendar's browsing month (‹ › nav) vs the record's target month (set when a day is tapped).
  // A record can be filed into another month by navigating there and picking a day — merge re-buckets.
  const [view, setView] = useState<{ year: number; month: number }>({ year, month });
  const [target, setTarget] = useState<{ year: number; month: number }>({ year, month });

  const categories = useLedgerStore((s) => s.categories);
  const records = useLedgerStore((s) => s.records);
  const addTransaction = useLedgerStore((s) => s.addTransaction);
  const addInstallment = useLedgerStore((s) => s.addInstallment);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
  const moveTransaction = useLedgerStore((s) => s.moveTransaction);
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
      setDayPickerOpen(false); // always start with the calendar collapsed
      // Calendar starts on the row's own month (edit) or this screen's month (add).
      setView({ year: tx?.year ?? year, month: tx?.month ?? month });
      setTarget({ year: tx?.year ?? year, month: tx?.month ?? month });
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
  const previewStartMonth = installmentAnchorMonth ?? target.month;

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

  // ‹ › nav moves only the browsing month; the record's month changes when a day is tapped (onSelect).
  const shiftMonth = (delta: number) => {
    const idx = view.year * 12 + (view.month - 1) + delta;
    setView({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
  };

  // Recent-weighted usage per type from the user's own history — recomputed only when records change.
  // `now` sets the recent window; the drawer stays mounted so recomputing the date here is cheap.
  const usageCounts = useMemo(() => {
    const d = new Date();
    return categoryUsage(records, { year: d.getFullYear(), month: d.getMonth() + 1 });
  }, [records]);
  // Most-used first (recent 3 months, then all-time); ties keep the seed order, so unused ones stay last.
  const visibleCategories = useMemo(
    () =>
      orderCategories(
        categories.filter((c) => !c.deleted && c.type === selectedType),
        usageCounts[selectedType],
      ),
    [categories, selectedType, usageCounts],
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
          const patch = {
            type: values.type,
            amount: values.amount,
            category: values.category ?? '',
            merchant: values.merchant ?? '',
            day: values.day,
            note: values.note ?? '',
          };
          // A changed target month moves the record to the new bucket (sync-safe re-bucketing); an
          // unchanged month is a plain in-place edit.
          if (target.year !== transaction.year || target.month !== transaction.month) {
            moveTransaction(
              transaction.year,
              transaction.month,
              transaction.id,
              target.year,
              target.month,
              patch,
            );
          } else {
            updateTransaction(transaction.year, transaction.month, transaction.id, patch);
          }
        }
      } else if (values.type === '지출' && installmentMonths > 1) {
        // 할부: split the total into one record per month (spilling into future months). Records only —
        // never Settings — so the setup of any month a slice lands in stays untouched.
        addInstallment({
          year: target.year,
          month: target.month,
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
          year: target.year,
          month: target.month,
          type: values.type,
          amount: values.amount,
          category: values.category,
          merchant: values.merchant,
          day: values.day,
          note: values.note,
        });
      }
      const installmentAdded = !isEdit && values.type === '지출' && installmentMonths > 1;
      // Filed into a different month than this screen? Say so, so the record doesn't feel "lost"
      // (it won't show in the current month's list).
      const otherMonth = target.year !== year || target.month !== month;
      toast.success(
        isEdit
          ? otherMonth
            ? `${target.month}월로 옮겼어요`
            : '수정했어요'
          : installmentAdded
            ? `${installmentMonths}개월 할부로 기록했어요`
            : otherMonth
              ? `${target.month}월에 기록했어요`
              : '기록했어요',
      );
      sheetRef.current?.dismiss();
    },
    [
      isEdit,
      transaction,
      updateTransaction,
      moveTransaction,
      updateInstallment,
      addTransaction,
      addInstallment,
      installmentMonths,
      target,
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
                  autoFocus={!isEdit}
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

        {/* Date — a "M월 D일" badge that discloses a calendar to pick the day (no long chip strip). */}
        <Field label="날짜">
          <Controller
            control={control}
            name="day"
            render={({ field }) => (
              <View style={{ position: 'relative' }}>
                <Pressable
                  onPress={() => {
                    const opening = !dayPickerOpen;
                    if (opening) setView({ ...target }); // reopening jumps back to the selected month
                    setDayPickerOpen(opening);
                  }}
                  className="flex-row items-center gap-2 self-start rounded-full bg-fill px-4 py-2.5 active:opacity-80">
                  <CalendarDays size={15} color={Palette.muted} />
                  <Text className="text-sm text-ink font-sans-medium">
                    {field.value == null
                      ? target.year !== year || target.month !== month
                        ? `${target.month}월 · 날짜 미정`
                        : '날짜 미정'
                      : `${target.year !== year ? `${target.year}년 ` : ''}${target.month}월 ${field.value}일`}
                  </Text>
                </Pressable>

                {/* True popover: absolutely positioned ABOVE the badge, so it floats over the fields
                    instead of pushing the form down. Floating up also stacks it over the
                    earlier-painted siblings (거래처 등) with no zIndex fight. */}
                {dayPickerOpen && (
                  <View
                    className="rounded-2xl border border-line bg-paper p-3"
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      marginBottom: 8,
                      zIndex: 50,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.12,
                      shadowRadius: 20,
                      elevation: 8,
                    }}>
                    <DayPickerCalendar
                      year={view.year}
                      month={view.month}
                      value={
                        view.year === target.year && view.month === target.month
                          ? field.value ?? null
                          : null
                      }
                      onSelect={(d) => {
                        const sameCell =
                          view.year === target.year &&
                          view.month === target.month &&
                          field.value === d;
                        if (sameCell) {
                          field.onChange(null); // re-tap the selected day → clear to 미정
                        } else {
                          setTarget({ ...view }); // the tapped month becomes the record's month
                          field.onChange(d);
                        }
                        setDayPickerOpen(false);
                      }}
                      onPrev={editingInstallment ? undefined : () => shiftMonth(-1)}
                      onNext={editingInstallment ? undefined : () => shiftMonth(1)}
                    />
                  </View>
                )}
              </View>
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

/**
 * Compact month calendar for the record drawer's date field — a native lookalike of the shadcn
 * calendar (fixed 36px cells, content-width, greyed inert outside days; NOT the real shadcn, which
 * is web-only). The ‹ › header navigates months so a record can be filed into another month; the
 * parent decides what a tap means (pick / re-tap to clear / move month). `value` is the selected day
 * only when the viewed month IS the selected month, so the highlight never bleeds across months.
 */
function DayPickerCalendar({
  year,
  month,
  value,
  onSelect,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  value: number | null;
  onSelect: (day: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const CELL = 36; // fixed cell size keeps the grid compact instead of stretching to full width
  const total = daysInMonth(year, month);
  const leading = firstWeekdayOfMonth(year, month);
  const prevTotal = daysInMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  // prev-month tail + this month + next-month head (to finish the last week). Outside days render
  // dimmed and inert — only this month's days are selectable in a single-month picker.
  const cells: { day: number; outside: boolean }[] = [
    ...Array.from({ length: leading }, (_, i) => ({ day: prevTotal - leading + 1 + i, outside: true })),
    ...Array.from({ length: total }, (_, i) => ({ day: i + 1, outside: false })),
  ];
  // Always fill to 6 rows (42 cells) so the calendar's height stays constant across months — the
  // popover then never grows/shrinks (and jumps) as you navigate ‹ ›. Max leading(6)+31 = 37 < 42.
  for (let nextDay = 1; cells.length < 42; nextDay++) {
    cells.push({ day: nextDay, outside: true });
  }
  return (
    <View style={{ width: CELL * 7 }}>
      {/* Month nav — arrows shift the browsing month (hidden for installment edits, which stay put). */}
      <View className="mb-1.5 h-7 flex-row items-center justify-between">
        {onPrev ? (
          <Pressable
            onPress={onPrev}
            hitSlop={6}
            className="h-7 w-7 items-center justify-center rounded-lg active:bg-fill">
            <ChevronLeft size={17} color={Palette.ink} />
          </Pressable>
        ) : (
          <View className="h-7 w-7" />
        )}
        <Text className="text-sm text-ink font-sans-semibold">
          {year}년 {month}월
        </Text>
        {onNext ? (
          <Pressable
            onPress={onNext}
            hitSlop={6}
            className="h-7 w-7 items-center justify-center rounded-lg active:bg-fill">
            <ChevronRight size={17} color={Palette.ink} />
          </Pressable>
        ) : (
          <View className="h-7 w-7" />
        )}
      </View>
      <View className="flex-row">
        {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
          <View key={w} style={{ width: CELL }} className="items-center pb-1.5">
            <Text
              className={`text-[11px] font-sans-medium ${i === 0 ? 'text-expense' : 'text-muted'}`}>
              {w}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((c, idx) =>
          c.outside ? (
            <View
              key={idx}
              style={{ width: CELL, height: CELL }}
              className="items-center justify-center">
              <Text className="text-[13px] text-muted font-mono opacity-60">{c.day}</Text>
            </View>
          ) : (
            <View
              key={idx}
              style={{ width: CELL, height: CELL }}
              className="items-center justify-center">
              <Pressable
                onPress={() => onSelect(c.day)}
                className="h-full w-full items-center justify-center active:opacity-60">
                <View
                  className={`h-8 w-8 items-center justify-center rounded-lg ${
                    value === c.day ? 'bg-ink' : isToday(year, month, c.day) ? 'bg-fill' : ''
                  }`}>
                  <Text
                    className={`text-[13px] font-mono ${value === c.day ? 'text-paper' : 'text-ink'}`}>
                    {c.day}
                  </Text>
                </View>
              </Pressable>
            </View>
          ),
        )}
      </View>
    </View>
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
