import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdaptiveSheet, type AdaptiveSheetRef } from '@/components/adaptive-sheet';
import { AmountInput } from '@/components/amount-input';
import { useToast } from '@/components/toast';
import { parseAmount } from '@/lib/money';
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
    const sheetRef = useRef<AdaptiveSheetRef>(null);
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
      toast.success('기본 예산을 저장했어요');
      sheetRef.current?.dismiss();
    }, [amount, updateSettings, toast]);

    return (
      <AdaptiveSheet
        ref={sheetRef}
        snapPoints={['42%']}
        scroll={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        onDismiss={() => syncOnEditEnd()}>
          <Text className="mb-1 text-2xl text-ink font-serif">기본 예산</Text>
          <Text className="mb-6 text-sm text-muted font-sans">매달 기본으로 적용될 예산이에요.</Text>

          <View className="flex-row items-end justify-center gap-1">
            <AmountInput
              value={parseAmount(amount)}
              onChangeValue={(n) => setAmount(String(n))}
              onSubmitEditing={onSave}
            />
            <Text className="pb-1 text-xl text-muted font-serif">원</Text>
          </View>

          <Pressable
            onPress={onSave}
            className="mt-7 items-center rounded-full bg-ink py-4 active:opacity-80">
            <Text className="text-base text-paper font-sans-bold">저장</Text>
          </Pressable>
      </AdaptiveSheet>
    );
  },
);
