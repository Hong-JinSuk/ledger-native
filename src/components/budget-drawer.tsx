import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SheetTextInput } from '@/components/sheet-text-input';
import { useToast } from '@/components/toast';
import { Palette } from '@/constants/palette';
import { monoAmountWidth } from '@/lib/amount-width';
import { currentMonthKey, monthKey } from '@/lib/date';
import { formatAmount, parseAmount } from '@/lib/money';
import { syncOnEditEnd } from '@/lib/sync/sync-service';
import { useLedgerStore } from '@/store/ledger-store';

export type BudgetDrawerRef = { present: () => void; dismiss: () => void };

type Props = { year: number; month: number; onClose?: () => void };

export const BudgetDrawer = forwardRef<BudgetDrawerRef, Props>(function BudgetDrawer(
  { year, month, onClose },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [amount, setAmount] = useState('');
  const [useDefault, setUseDefault] = useState(false);

  const updateMonthlyBudget = useLedgerStore((s) => s.updateMonthlyBudget);
  const updateSettings = useLedgerStore((s) => s.updateSettings);
  const confirmBudget = useLedgerStore((s) => s.confirmBudget);
  const toast = useToast();

  const monthK = monthKey(year, month);
  const isCurrentMonth = monthK === currentMonthKey();

  useImperativeHandle(ref, () => ({
    present: () => {
      // Seed the input from the current budget (month override → default → empty).
      const s = useLedgerStore.getState().settings;
      const existing = s.monthlyBudgets[monthK] ?? s.budget ?? 0;
      setAmount(existing ? String(existing) : '');
      setUseDefault(false);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const onSave = useCallback(() => {
    const value = parseAmount(amount);
    updateMonthlyBudget(year, month, value > 0 ? value : null);
    if (useDefault && value > 0) updateSettings({ budget: value });
    if (isCurrentMonth) confirmBudget(currentMonthKey());
    toast('예산을 저장했어요');
    sheetRef.current?.dismiss();
  }, [amount, useDefault, isCurrentMonth, year, month, updateMonthlyBudget, updateSettings, confirmBudget, toast]);

  const onSkip = useCallback(() => {
    // Mark the month confirmed so the first-entry prompt doesn't nag again.
    if (isCurrentMonth) confirmBudget(currentMonthKey());
    sheetRef.current?.dismiss();
  }, [isCurrentMonth, confirmBudget]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['46%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: Palette.paper }}
      handleIndicatorStyle={{ backgroundColor: Palette.line }}
      onDismiss={() => {
        onClose?.();
        syncOnEditEnd(); // write-end: push this edit to Drive (no-op if nothing changed)
      }}>
      <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <Text className="mb-1 text-2xl text-ink font-serif">
          {month}월 예산
        </Text>
        <Text className="mb-6 text-sm text-muted font-sans">
          이 달에 얼마를 쓸 계획인가요?
        </Text>

        <View className="flex-row items-end justify-center gap-1">
          <SheetTextInput
            value={amount ? formatAmount(parseAmount(amount)) : ''}
            onChangeText={(t) => setAmount(String(parseAmount(t)))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Palette.line}
            // Size the field to its content on web so the centered [number] 원 stays tight and never
            // overflows (RNW gives an unconstrained <input> a wide default). Native auto-sizes.
            style={monoAmountWidth(amount ? formatAmount(parseAmount(amount)) : '', 36)}
            className="text-center text-4xl text-ink font-mono-semibold"
          />
          <Text className="pb-1 text-xl text-muted font-serif">원</Text>
        </View>

        <Pressable
          onPress={() => setUseDefault((v) => !v)}
          className="mt-6 flex-row items-center justify-center gap-2 active:opacity-70">
          <View
            className={`h-5 w-5 items-center justify-center rounded-md border ${useDefault ? 'border-ink bg-ink' : 'border-line'}`}>
            {useDefault && <Check size={13} color={Palette.paper} strokeWidth={3} />}
          </View>
          <Text className="text-sm text-muted font-sans">매달 기본 예산으로 사용</Text>
        </Pressable>

        <Pressable
          onPress={onSave}
          className="mt-7 items-center rounded-full bg-ink py-4 active:opacity-80">
          <Text className="text-base text-paper font-sans-bold">예산 설정</Text>
        </Pressable>
        <Pressable onPress={onSkip} className="mt-2 items-center py-2 active:opacity-60">
          <Text className="text-sm text-muted font-sans-medium">나중에 하기</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
