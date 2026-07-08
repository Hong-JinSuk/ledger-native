import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { AppHeader } from '@/components/app-header';
import { useConfirm } from '@/components/confirm-dialog';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { yearRemainingBudget, yearSummary } from '@/lib/ledger/selectors';
import { formatCurrency } from '@/lib/money';
import { useLedgerStore } from '@/store/ledger-store';

export default function YearView() {
  const router = useRouter();
  const years = useLedgerStore((s) => s.years);
  const records = useLedgerStore((s) => s.records);
  const settings = useLedgerStore((s) => s.settings);
  const addYear = useLedgerStore((s) => s.addYear);
  const deleteYear = useLedgerStore((s) => s.deleteYear);
  const confirm = useConfirm();
  const isWeb = Platform.OS === 'web';

  const [isAdding, setIsAdding] = useState(false);
  const [newYear, setNewYear] = useState('');

  const handleAddYear = () => {
    const y = parseInt(newYear, 10);
    if (!Number.isNaN(y) && y > 1900 && y < 2100) addYear(y);
    setNewYear('');
    setIsAdding(false);
  };

  const confirmDeleteYear = async (year: number) => {
    const ok = await confirm({
      title: `${year}년을 삭제할까요?`,
      message: '그 해에 기록한 내역이 모두 사라져요.',
    });
    if (ok) deleteYear(year);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}>
        <AppHeader title="Ledger" subtitle="Financial Journal" />

        {/* Add year */}
        {isAdding ? (
          <View className="mb-5 flex-row items-center gap-2">
            <TextInput
              value={newYear}
              onChangeText={(t) => setNewYear(t.replace(/[^0-9]/g, ''))}
              onSubmitEditing={handleAddYear}
              keyboardType="number-pad"
              placeholder="연도 (예: 2027)"
              placeholderTextColor={Palette.muted}
              maxLength={4}
              autoFocus
              className="flex-1 rounded-2xl bg-fill px-4 py-3 text-base text-ink font-mono"
            />
            <Pressable
              onPress={handleAddYear}
              className="rounded-full bg-ink px-5 py-3 active:opacity-80">
              <Text className="text-sm text-paper font-sans-bold">추가</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setIsAdding(false);
                setNewYear('');
              }}
              hitSlop={8}
              className="px-2 py-3 active:opacity-60">
              <Text className="text-sm text-muted font-sans-medium">취소</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setIsAdding(true)}
            hitSlop={6}
            className="mb-5 flex-row items-center gap-1.5 active:opacity-60">
            <Plus size={15} color={Palette.ink} />
            <Text className="text-xs uppercase tracking-[1.5px] text-ink font-sans-bold">
              새 연도 추가
            </Text>
          </Pressable>
        )}

        {years.length === 0 ? (
          <Text className="mt-10 text-center text-sm leading-6 text-muted font-sans">
            아직 연도가 없어요.{'\n'}위에서 기록할 연도를 더해보세요.
          </Text>
        ) : (
          <View className={isWeb ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
            {years.map((year, i) => {
              const summary = yearSummary(records, year);
              const remaining = yearRemainingBudget(records, settings, year);
              return (
                <FadeIn key={year} delay={i * 70} style={isWeb ? { width: '31.5%' } : undefined}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/[year]', params: { year: String(year) } })
                    }
                    className="rounded-2xl border border-line bg-white/60 px-5 py-5 active:opacity-60">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-3xl text-ink font-serif">{year}</Text>
                      <View className="flex-row items-center gap-1">
                        <Pressable
                          onPress={() => confirmDeleteYear(year)}
                          hitSlop={8}
                          className="p-1.5 active:opacity-50">
                          <Trash2 size={16} color={Palette.muted} />
                        </Pressable>
                        <ChevronRight size={20} color={Palette.muted} />
                      </View>
                    </View>

                    <View className="mt-4 flex-row gap-6">
                      <AmountStat label="수입" amount={summary.income} tone="income" />
                      <AmountStat label="지출" amount={summary.expense} tone="expense" />
                    </View>

                    {remaining !== null && (
                      <Text className="mt-3 text-xs text-muted font-sans">
                        남은 예산 · {formatCurrency(remaining, settings.currency)}
                      </Text>
                    )}
                  </Pressable>
                </FadeIn>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
