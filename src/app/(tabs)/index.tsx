import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';
import { currentYear } from '@/lib/date';
import { yearSummary } from '@/lib/ledger/selectors';
import { formatCurrency } from '@/lib/money';
import { useLedgerStore } from '@/store/ledger-store';

// Placeholder — the real Journal (Year → Month → Spreadsheet) lands in Phase 2.
// Already wired to the live store to prove the data layer end-to-end.
export default function JournalScreen() {
  const records = useLedgerStore((s) => s.records);
  const year = currentYear();
  const summary = yearSummary(records, year);
  const hasRecords = summary.income !== 0 || summary.expense !== 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.paper }} edges={['top']}>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-4xl text-ink font-serif">{year} Ledger</Text>
        <Text className="text-[10px] uppercase tracking-[3px] text-muted font-sans-semibold">
          Financial Journal
        </Text>
        {hasRecords ? (
          <Text className="mt-6 text-2xl text-ink font-mono">
            {formatCurrency(summary.balance)}
          </Text>
        ) : (
          <Text className="mt-4 text-center text-base leading-6 text-muted font-sans">
            아직 기록이 없어요.{'\n'}곧 여기에 당신의 하루가 쌓일 거예요.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
