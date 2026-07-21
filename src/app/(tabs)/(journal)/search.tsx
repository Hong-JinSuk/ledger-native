import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { formatAmount } from '@/lib/money';
import { searchTransactions } from '@/lib/search/search-filter';
import { useLedgerStore } from '@/store/ledger-store';
import { useSearchStore } from '@/store/search-store';

export default function SearchResults() {
  const router = useRouter();
  const groups = useSearchStore((s) => s.groups);
  const label = useSearchStore((s) => s.label);
  const records = useLedgerStore((s) => s.records);
  const results = useMemo(
    () => searchTransactions(records, groups),
    [records, groups],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 64,
        }}
      >
        <AppHeader
          title="Search Results"
          subtitle={
            label ? `“${label}” · ${results.length}건` : '검색어가 없어요'
          }
          backLabel="Journal"
          size="sm"
        />

        {results.length === 0 ? (
          <View className="mt-6">
            <EmptyState
              message={
                label
                  ? `‘${label}’에 맞는 기록이 없어요.`
                  : '위 검색창에서 메모·거래처로 찾아보세요.'
              }
            />
          </View>
        ) : (
          <View className="gap-2.5">
            {results.map((t, i) => (
              // 긴 목록도 총 지연이 늘어지지 않게 stagger를 8개까지만 캡 (CLAUDE.md 규칙).
              <FadeIn key={t.id} delay={Math.min(i, 8) * 40}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/[year]/[month]',
                      params: { year: String(t.year), month: String(t.month) },
                    })
                  }
                  className="flex-row items-center justify-between rounded-2xl border border-line bg-white/60 px-4 py-3.5 active:opacity-60"
                >
                  <View className="flex-1 pr-3">
                    <Text
                      className="text-[15px] text-ink font-sans-medium"
                      numberOfLines={1}
                    >
                      {t.merchant || t.note || '(내용 없음)'}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs text-muted font-sans"
                      numberOfLines={1}
                    >
                      {t.year}.{t.month}.{t.day ?? '—'} ·{' '}
                      {t.category || '미분류'}
                      {t.merchant && t.note ? ` · ${t.note}` : ''}
                    </Text>
                  </View>
                  <Text
                    className={`shrink-0 text-[15px] font-mono-medium ${t.type === '수입' ? 'text-income' : 'text-ink'}`}
                  >
                    {t.type === '지출' ? '-' : ''}
                    {formatAmount(t.amount)}
                  </Text>
                </Pressable>
              </FadeIn>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
