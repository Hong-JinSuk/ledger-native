import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AmountStat } from '@/components/amount-stat';
import { AppHeader } from '@/components/app-header';
import { useConfirm } from '@/components/confirm-dialog';
import { FadeIn } from '@/components/fade-in';
import { HoverReveal } from '@/components/hover-reveal';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { useClickOutside } from '@/hooks/use-click-outside';
import { useIsWideScreen } from '@/hooks/use-responsive';
import { animateNextLayout } from '@/lib/animate-next-layout';
import { yearRemainingBudget, yearSummary } from '@/lib/ledger/selectors';
import { formatCurrency } from '@/lib/money';
import { syncOnEditEnd } from '@/lib/sync/sync-service';
import { useLedgerStore } from '@/store/ledger-store';

export default function YearView() {
  const router = useRouter();
  const years = useLedgerStore((s) => s.years);
  const records = useLedgerStore((s) => s.records);
  const settings = useLedgerStore((s) => s.settings);
  const addYear = useLedgerStore((s) => s.addYear);
  const deleteYear = useLedgerStore((s) => s.deleteYear);
  const confirm = useConfirm();
  const isWide = useIsWideScreen();

  const [isAdding, setIsAdding] = useState(false);
  const [newYear, setNewYear] = useState('');
  const addRowRef = useRef<View>(null);

  const cancelAdd = useCallback(() => {
    animateNextLayout();
    setIsAdding(false);
    setNewYear('');
  }, []);

  // Web: clicking anywhere outside the input row (or pressing Escape) cancels the add. The 추가
  // button lives inside addRowRef, so its press is excluded and still commits.
  useClickOutside(addRowRef, isAdding, cancelAdd);

  const handleAddYear = () => {
    const y = parseInt(newYear, 10);
    animateNextLayout(); // soften the new card appearing + the input row collapsing
    if (!Number.isNaN(y) && y > 1900 && y < 2100) {
      addYear(y);
      syncOnEditEnd(); // write-end: push the new year up promptly
    }
    setNewYear('');
    setIsAdding(false);
  };

  const confirmDeleteYear = async (year: number) => {
    const ok = await confirm({
      title: `${year}년을 삭제할까요?`,
      message: '그 해에 기록한 내역이 모두 사라져요.',
    });
    if (ok) {
      animateNextLayout(); // gently collapse the removed year card
      deleteYear(year);
      syncOnEditEnd(); // write-end: propagate the deletion (tombstone) to Drive right away
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}>
        <AppHeader title="Ledger" subtitle="Financial Journal" />

        {/* Add year */}
        {isAdding ? (
          <View ref={addRowRef} className="mb-5 flex-row items-center gap-2">
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
            <Pressable onPress={cancelAdd} hitSlop={8} className="px-2 py-3 active:opacity-60">
              <Text className="text-sm text-muted font-sans-medium">취소</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              animateNextLayout();
              setIsAdding(true);
            }}
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
          <View className={isWide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
            {years.map((year, i) => {
              const summary = yearSummary(records, year);
              const remaining = yearRemainingBudget(records, settings, year);
              return (
                <FadeIn key={year} delay={i * 70} style={isWide ? { width: '31.5%' } : undefined}>
                  {isWide ? (
                    <WebYearCard
                      year={year}
                      income={summary.income}
                      expense={summary.expense}
                      remaining={remaining}
                      currency={settings.currency}
                      onPress={() =>
                        router.push({ pathname: '/[year]', params: { year: String(year) } })
                      }
                      onDelete={() => confirmDeleteYear(year)}
                    />
                  ) : (
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

                      {/* Always rendered ('—' when no budget) so cards keep equal height — matches web. */}
                      <Text className="mt-3 text-xs text-muted font-sans">
                        남은 예산 ·{' '}
                        {remaining !== null ? formatCurrency(remaining, settings.currency) : '—'}
                      </Text>
                    </Pressable>
                  )}
                </FadeIn>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Web-only year card with a hover-reveal CTA (ported from the original web). On mouse-over a frosted
 * overlay fades in with "이어서 기록하기" / "기록 시작하기". The trash sits above the overlay so it
 * stays clickable while hovering. Native uses the plain card (no hover on touch).
 */
function WebYearCard({
  year,
  income,
  expense,
  remaining,
  currency,
  onPress,
  onDelete,
}: {
  year: number;
  income: number;
  expense: number;
  remaining: number | null;
  currency: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hasData = income > 0 || expense > 0;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className="overflow-hidden rounded-2xl border border-line bg-white/60 px-5 py-5 active:opacity-90">
      <Text className="text-3xl text-ink font-serif">{year}</Text>

      <View className="mt-4 flex-row gap-6">
        <AmountStat label="수입" amount={income} tone="income" />
        <AmountStat label="지출" amount={expense} tone="expense" />
      </View>

      {/* Always render so every card is the same height; '—' when no budget is set (matches the
          month cards). null = 예산 미설정 (not "0 remaining"), so we don't show a misleading 0원. */}
      <Text className="mt-3 text-xs text-muted font-sans">
        남은 예산 · {remaining !== null ? formatCurrency(remaining, currency) : '—'}
      </Text>

      <HoverReveal hovered={hovered} label={hasData ? '이어서 기록하기' : '기록 시작하기'} />

      {/* Above the overlay → stays visible + clickable on hover. */}
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        className="absolute right-3 top-3 p-1.5 active:opacity-50">
        <Trash2 size={16} color={Palette.muted} />
      </Pressable>
    </Pressable>
  );
}
