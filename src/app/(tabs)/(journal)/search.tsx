import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { TransactionRow } from '@/components/transaction-row';
import { Palette } from '@/constants/palette';
import { weekdayLabel } from '@/lib/date';
import { searchTransactions } from '@/lib/search/search-filter';
import { useLedgerStore } from '@/store/ledger-store';
import { useSearchStore } from '@/store/search-store';
import type { Transaction } from '@/types/ledger';

/** 한 페이지에 보여줄 결과 수. 이보다 많으면 아래 페이지네이션으로 넘긴다. */
const PAGE_SIZE = 10;

export default function SearchResults() {
  const router = useRouter();
  const groups = useSearchStore((s) => s.groups);
  const label = useSearchStore((s) => s.label);
  const records = useLedgerStore((s) => s.records);
  const results = useMemo(() => searchTransactions(records, groups), [records, groups]);

  const [page, setPage] = useState(0);
  // 새 검색이 실행되면(groups 교체) 첫 페이지로 되돌린다.
  useEffect(() => setPage(0), [groups]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  const categories = useLedgerStore((s) => s.categories);
  const currency = useLedgerStore((s) => s.settings.currency);
  const iconByCategory = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.name, c.icon])),
    [categories],
  );

  // 이 페이지에 보이는 결과를 날짜별로 묶는다. 결과는 이미 최신순이라 같은 날짜가 연속으로 모여 Map이 그대로
  // 날짜 그룹이 된다. 월 상세와 달리 검색은 여러 달을 넘나드니 헤더에 연·월·일을 모두 적어 날짜를 모호하지 않게
  // 하고, 일별 합계는 '이 페이지에 보이는 행'만 기준으로 해 화면과 항상 일치시킨다(경계에서 잘린 날은 보이는 만큼만).
  const dayGroups = useMemo(() => {
    const slice = results.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const map = new Map<string, { year: number; month: number; day: number; rows: Transaction[] }>();
    for (const t of slice) {
      const day = t.day ?? 0;
      const key = `${t.year}.${t.month}.${day}`;
      const g = map.get(key);
      if (g) g.rows.push(t);
      else map.set(key, { year: t.year, month: t.month, day, rows: [t] });
    }
    return [...map.values()];
  }, [results, safePage]);

  return (
    <Screen>
      {/* 고정 헤더 — 스크롤 밖에 둬서 결과 리스트만 스크롤된다. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <AppHeader
          title="Search Results"
          subtitle={label ? `“${label}” · ${results.length}건` : '검색어가 없어요'}
          backLabel="Journal"
          backFallback="/"
          size="sm"
        />
      </View>

      {results.length === 0 ? (
        <View className="px-5">
          <EmptyState
            message={
              label ? `‘${label}’에 맞는 기록이 없어요.` : '위 검색창에서 메모·거래처로 찾아보세요.'
            }
          />
        </View>
      ) : (
        <>
          {/* 결과 리스트만 스크롤. 페이지가 바뀌면 key로 remount → 맨 위로 리셋 + stagger 재생. */}
          <ScrollView
            key={safePage}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            {dayGroups.map(({ year, month, day, rows }, gi) => {
              return (
                // 페이지당 10개뿐이라 .map + stagger(8개까지 캡)로 충분 (CLAUDE.md 규칙).
                <FadeIn key={`${year}.${month}.${day}`} delay={Math.min(gi, 8) * 40}>
                  <View className="mb-5">
                    {/* 날짜 헤더 (합산 없이 날짜만) */}
                    <Text className="mb-1 text-xs text-muted font-sans-semibold">
                      {day === 0
                        ? '날짜 미정'
                        : `${year}.${month}.${day} ${weekdayLabel(year, month, day)}`}
                    </Text>
                    {rows.map((t) => (
                      <TransactionRow
                        key={t.id}
                        row={t}
                        icon={iconByCategory[t.category ?? '']}
                        currency={currency}
                        onPress={() =>
                          router.push({
                            pathname: '/[year]/[month]',
                            params: { year: String(t.year), month: String(t.month) },
                          })
                        }
                      />
                    ))}
                  </View>
                </FadeIn>
              );
            })}
          </ScrollView>

          {pageCount > 1 ? (
            <Pager
              page={safePage}
              pageCount={pageCount}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              onJump={setPage}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

type IconType = ComponentType<{ size?: number; color?: string }>;

/**
 * 하단 고정 페이지네이션 (‹ [1] / N ›). 쉬는 상태는 숫자를 그냥 Text로 보여줘서 옆 "/ N"과 항상 같은 줄에
 * 정렬된다(TextInput은 네이티브에서 Text와 세로 기준이 달라 어긋남). 숫자를 탭하면 입력창으로 바뀌고 Enter로 점프.
 */
function Pager({
  page,
  pageCount,
  onPrev,
  onNext,
  onJump,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (page: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const openEdit = () => {
    setDraft(String(page + 1)); // 현재 페이지를 채워 열고, selectTextOnFocus로 바로 덮어쓰기 가능
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n)) return; // 빈/잘못된 입력 → 그대로
    const target = Math.min(Math.max(n, 1), pageCount) - 1; // 1..pageCount → 0-based로 클램프
    if (target !== page) onJump(target);
  };

  return (
    <View className="flex-row items-center justify-center gap-4 border-t border-line py-3">
      <PagerButton disabled={page === 0} onPress={onPrev} Icon={ChevronLeft} label="이전 페이지" />
      <View className="flex-row items-center gap-1.5">
        {editing ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ''))} // 숫자만
            onSubmitEditing={commit} // Enter → 점프
            onBlur={() => setEditing(false)} // 벗어나면 취소 (점프는 Enter로만)
            keyboardType="number-pad"
            returnKeyType="go"
            selectTextOnFocus
            accessibilityLabel="페이지 번호 입력"
            className="w-11 rounded-md bg-fill px-2 py-1 text-center text-sm text-ink font-sans-semibold"
          />
        ) : (
          <Pressable
            onPress={openEdit}
            accessibilityLabel="페이지 번호 입력"
            className="rounded-md bg-fill px-2.5 py-1 active:opacity-70">
            <Text className="text-sm text-ink font-sans-semibold">{page + 1}</Text>
          </Pressable>
        )}
        <Text className="text-sm text-muted font-sans-semibold">/ {pageCount}</Text>
      </View>
      <PagerButton
        disabled={page === pageCount - 1}
        onPress={onNext}
        Icon={ChevronRight}
        label="다음 페이지"
      />
    </View>
  );
}

function PagerButton({
  disabled,
  onPress,
  Icon,
  label,
}: {
  disabled: boolean;
  onPress: () => void;
  Icon: IconType;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
      style={{ opacity: disabled ? 0.3 : 1 }}>
      <Icon size={20} color={Palette.ink} />
    </Pressable>
  );
}
