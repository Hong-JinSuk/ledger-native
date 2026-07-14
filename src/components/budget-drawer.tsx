import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdaptiveSheet, type AdaptiveSheetRef } from '@/components/adaptive-sheet';
import { AmountInput } from '@/components/amount-input';
import { useToast } from '@/components/toast';
import { monthKey } from '@/lib/date';
import { isMonthConfigured } from '@/lib/ledger/budget';
import { formatAmount, parseAmount } from '@/lib/money';
import { syncOnEditEnd } from '@/lib/sync/sync-service';
import { useLedgerStore } from '@/store/ledger-store';

export type BudgetDrawerRef = { present: () => void; dismiss: () => void };

type Props = { year: number; month: number; onClose?: () => void };

type DrawerView = 'choice' | 'edit';

/**
 * Month setup drawer. On an un-configured month it offers the Settings defaults vs a custom setup vs
 * "later"; on an already-configured month (tapped from the summary card) it edits that month's budget.
 * Fixed expenses are per-month here — the Settings template is copied in only by "apply defaults".
 */
export const BudgetDrawer = forwardRef<BudgetDrawerRef, Props>(function BudgetDrawer(
  { year, month, onClose },
  ref,
) {
  const sheetRef = useRef<AdaptiveSheetRef>(null);
  const router = useRouter();
  const [view, setView] = useState<DrawerView>('choice');
  const [amount, setAmount] = useState('');
  // "직접 설정" jumps to the per-month fixed-expense editor after saving the budget (budget + fixed custom).
  const [goFixedAfter, setGoFixedAfter] = useState(false);

  const applyDefaultsToMonth = useLedgerStore((s) => s.applyDefaultsToMonth);
  const updateMonthlyBudget = useLedgerStore((s) => s.updateMonthlyBudget);
  const defaultBudget = useLedgerStore((s) => s.settings.budget);
  const fixedExpenses = useLedgerStore((s) => s.settings.fixedExpenses);
  const toast = useToast();

  const defaultFixed = useMemo(() => fixedExpenses.filter((e) => !e.deleted), [fixedExpenses]);
  const defaultFixedTotal = useMemo(
    () => defaultFixed.reduce((sum, e) => sum + (e.amount || 0), 0),
    [defaultFixed],
  );
  const defaultSpendable = defaultBudget - defaultFixedTotal;

  useImperativeHandle(ref, () => ({
    present: () => {
      const s = useLedgerStore.getState().settings;
      setGoFixedAfter(false);
      if (isMonthConfigured(s, year, month)) {
        // Already set up → edit this month's budget directly.
        const existing = s.monthlyBudgets[monthKey(year, month)] ?? 0;
        setAmount(existing ? String(existing) : '');
        setView('edit');
      } else {
        setView('choice');
      }
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const budget = parseAmount(amount);

  const onApplyDefaults = useCallback(() => {
    applyDefaultsToMonth(year, month);
    toast.success('기본값을 적용했어요');
    sheetRef.current?.dismiss();
  }, [applyDefaultsToMonth, year, month, toast]);

  const onCustom = useCallback(() => {
    // Custom setup starts blank — the user sets this month from scratch (budget 0원, fixed empty),
    // rather than inheriting the Settings default budget.
    setAmount('');
    setGoFixedAfter(true);
    setView('edit');
  }, []);

  const onLater = useCallback(() => {
    // Just close for this visit — re-entering the still-un-configured month shows the prompt again.
    sheetRef.current?.dismiss();
  }, []);

  const onSaveBudget = useCallback(() => {
    updateMonthlyBudget(year, month, budget > 0 ? budget : null);
    toast.success('예산을 저장했어요');
    const jump = goFixedAfter;
    sheetRef.current?.dismiss();
    if (jump) {
      router.push({
        pathname: '/[year]/[month]/fixed',
        params: { year: String(year), month: String(month) },
      });
    }
  }, [updateMonthlyBudget, year, month, budget, goFixedAfter, toast, router]);

  return (
    <AdaptiveSheet
      ref={sheetRef}
      snapPoints={['64%']}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      onDismiss={() => {
        onClose?.();
        syncOnEditEnd(); // write-end: push this edit to Drive (no-op if nothing changed)
      }}>
      {view === 'choice' ? (
        <>
          <Text className="mb-1 text-2xl text-ink font-serif">{month}월을 어떻게 시작할까요?</Text>
          <Text className="mb-6 text-sm leading-5 text-muted font-sans">
            설정의 기본값을 적용하거나, 이 달만 직접 설정할 수 있어요.
          </Text>

          {/* Preview of the Settings defaults being offered */}
          <View className="rounded-2xl border border-line bg-white/50 px-4 py-4">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-sm text-muted font-sans">기본 예산</Text>
              <View className="flex-row items-baseline gap-1">
                <Text className="text-lg text-ink font-mono-semibold">
                  {formatAmount(defaultBudget)}
                </Text>
                <Text className="text-xs text-muted font-serif">원</Text>
              </View>
            </View>

            <View className="mt-3">
              <Text className="mb-2 text-[11px] uppercase tracking-wider text-muted font-sans-bold">
                고정 지출 {defaultFixed.length}건
              </Text>
              {defaultFixed.length === 0 ? (
                <Text className="text-sm text-muted font-sans">설정된 고정 지출이 없어요.</Text>
              ) : (
                <View className="gap-1.5">
                  {defaultFixed.map((e) => (
                    <View key={e.id} className="flex-row items-baseline justify-between">
                      <Text className="shrink text-sm text-ink font-sans" numberOfLines={1}>
                        {e.title}
                      </Text>
                      <Text className="ml-2 text-sm text-expense font-mono-medium">
                        -{formatAmount(e.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {defaultBudget > 0 && (
              <View className="mt-3 flex-row items-baseline justify-between border-t border-line pt-3">
                <Text className="text-sm text-ink font-sans-medium">실제 쓸 수 있는 예산</Text>
                <View className="flex-row items-baseline gap-1">
                  <Text
                    className={`text-lg font-mono-semibold ${defaultSpendable < 0 ? 'text-expense' : 'text-ink'}`}>
                    {formatAmount(defaultSpendable)}
                  </Text>
                  <Text className="text-xs text-muted font-serif">원</Text>
                </View>
              </View>
            )}
          </View>

          <Pressable
            onPress={onApplyDefaults}
            className="mt-6 items-center rounded-full bg-ink py-4 active:opacity-80">
            <Text className="text-base text-paper font-sans-bold">이 기본값으로 적용</Text>
          </Pressable>
          <Pressable
            onPress={onCustom}
            className="mt-2 items-center rounded-full border border-line py-4 active:opacity-70">
            <Text className="text-base text-ink font-sans-bold">직접 설정</Text>
          </Pressable>
          <Pressable onPress={onLater} className="mt-1 items-center py-2 active:opacity-60">
            <Text className="text-sm text-muted font-sans-medium">나중에 하기</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="mb-1 text-2xl text-ink font-serif">{month}월 예산</Text>
          <Text className="mb-6 text-sm text-muted font-sans">
            {goFixedAfter ? '예산을 정하면 다음에 고정 지출을 설정해요.' : '이 달에 얼마를 쓸 계획인가요?'}
          </Text>

          <View className="flex-row items-end justify-center gap-1">
            <AmountInput
              value={budget}
              onChangeValue={(n) => setAmount(String(n))}
              onSubmitEditing={onSaveBudget}
            />
            <Text className="pb-1 text-xl text-muted font-serif">원</Text>
          </View>

          <Pressable
            onPress={onSaveBudget}
            className="mt-7 items-center rounded-full bg-ink py-4 active:opacity-80">
            <Text className="text-base text-paper font-sans-bold">
              {goFixedAfter ? '저장하고 고정 지출 설정' : '저장'}
            </Text>
          </Pressable>
          {goFixedAfter && (
            <Pressable
              onPress={() => setView('choice')}
              className="mt-2 items-center py-2 active:opacity-60">
              <Text className="text-sm text-muted font-sans-medium">뒤로</Text>
            </Pressable>
          )}
        </>
      )}
    </AdaptiveSheet>
  );
});
