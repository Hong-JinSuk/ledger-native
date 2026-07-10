import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SheetTextInput } from '@/components/sheet-text-input';
import { useToast } from '@/components/toast';
import { Palette } from '@/constants/palette';
import { monoAmountWidth } from '@/lib/amount-width';
import { formatAmount, parseAmount } from '@/lib/money';
import { syncOnEditEnd } from '@/lib/sync/sync-service';
import { useLedgerStore } from '@/store/ledger-store';

export type DefaultBudgetDrawerRef = { present: () => void; dismiss: () => void };

/**
 * Bottom-sheet editor for the app-wide default monthly budget (settings.budget). Mirrors the month
 * {@link BudgetDrawer} tone with a single amount field, so setting the default matches every other
 * edit in the app (tap → sheet) instead of an inline form field.
 */
export const DefaultBudgetDrawer = forwardRef<DefaultBudgetDrawerRef>(
  function DefaultBudgetDrawer(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const [amount, setAmount] = useState('');
    const updateSettings = useLedgerStore((s) => s.updateSettings);
    const toast = useToast();

    useImperativeHandle(ref, () => ({
      present: () => {
        // Seed from the current default budget on every open.
        const budget = useLedgerStore.getState().settings.budget;
        setAmount(budget ? String(budget) : '');
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const onSave = useCallback(() => {
      updateSettings({ budget: parseAmount(amount) });
      toast('기본 예산을 저장했어요');
      sheetRef.current?.dismiss();
    }, [amount, updateSettings, toast]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
      ),
      [],
    );

    const display = amount ? formatAmount(parseAmount(amount)) : '';

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['42%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        keyboardBehavior="interactive"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: Palette.paper }}
        handleIndicatorStyle={{ backgroundColor: Palette.line }}
        onDismiss={() => syncOnEditEnd()}>
        <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <Text className="mb-1 text-2xl text-ink font-serif">기본 예산</Text>
          <Text className="mb-6 text-sm text-muted font-sans">매달 기본으로 적용될 예산이에요.</Text>

          <View className="flex-row items-end justify-center gap-1">
            <SheetTextInput
              value={display}
              onChangeText={(t) => setAmount(String(parseAmount(t)))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Palette.line}
              // Size to content on web so the centered [number] 원 stays tight and never overflows.
              style={monoAmountWidth(display, 36)}
              className="text-center text-4xl text-ink font-mono-semibold"
            />
            <Text className="pb-1 text-xl text-muted font-serif">원</Text>
          </View>

          <Pressable
            onPress={onSave}
            className="mt-7 items-center rounded-full bg-ink py-4 active:opacity-80">
            <Text className="text-base text-paper font-sans-bold">저장</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
