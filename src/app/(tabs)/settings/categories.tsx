import { Plus } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';

import { BackLink } from '@/components/back-link';
import { CategoryDrawer, type CategoryDrawerRef } from '@/components/category-drawer';
import { CategoryIcon } from '@/components/category-icon';
import { EmptyState } from '@/components/empty-state';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { webScrollContent } from '@/constants/layout';
import { Palette } from '@/constants/palette';
import { orderCategories } from '@/lib/ledger/selectors';
import { syncOnEditEnd } from '@/lib/sync/sync-service';
import { useLedgerStore } from '@/store/ledger-store';
import type { CategoryItem, TransactionType } from '@/types/ledger';

const TABS: TransactionType[] = ['지출', '수입', '이체'];

const TONE: Record<TransactionType, string> = {
  수입: Palette.income,
  지출: Palette.ink,
  이체: Palette.transfer,
};

const keyExtractor = (c: CategoryItem) => c.id;

export default function CategoryManager() {
  const categories = useLedgerStore((s) => s.categories);
  const reorderCategories = useLedgerStore((s) => s.reorderCategories);
  const [activeTab, setActiveTab] = useState<TransactionType>('지출');

  // Manual drag order if the user has arranged this type, else the seed order. (No usage context on
  // this screen; usage-ranking is the picker's job — here the fallback is just the input order.)
  const ordered = useMemo(
    () => orderCategories(categories.filter((c) => !c.deleted && c.type === activeTab), {}),
    [categories, activeTab],
  );

  const drawerRef = useRef<CategoryDrawerRef>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // On web a drag release also fires a click on the tile, which would pop its edit modal. This guards
  // the tap-to-edit: set while dragging, consumed by the first onPress after (the drag's own release).
  const justDraggedRef = useRef(false);
  const insets = useSafeAreaInsets();

  const openEdit = useCallback((category: CategoryItem) => drawerRef.current?.present(category), []);
  const openAdd = useCallback(() => drawerRef.current?.present(null, activeTab), [activeTab]);

  const renderTile = useCallback(
    ({ item }: { item: CategoryItem }) => (
      <Pressable
        onPress={() => {
          if (justDraggedRef.current) {
            justDraggedRef.current = false; // this "press" is the drag's release, not a tap → ignore
            return;
          }
          openEdit(item);
        }}
        className="w-full items-center py-1 active:opacity-60">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-fill">
          <CategoryIcon name={item.icon} size={22} color={TONE[item.type]} />
        </View>
        <Text
          className="mt-2 text-center text-[11px] text-ink font-sans-medium"
          numberOfLines={1}>
          {item.name}
        </Text>
        {item.subcategories.length > 0 && (
          <Text className="mt-0.5 text-center text-[9px] text-muted font-sans">
            소분류 {item.subcategories.length}
          </Text>
        )}
      </Pressable>
    ),
    [openEdit],
  );

  return (
    <Screen webFull>
      <View style={{ flex: 1 }}>
        {/* Fixed header — stays put; only the category grid below scrolls. */}
        <View style={{ backgroundColor: Palette.paper }}>
          <View style={[{ paddingHorizontal: 20, paddingTop: 16 }, webScrollContent]}>
            <BackLink label="Settings" />

            <FadeIn>
              <View className="mb-6 mt-4">
                <Text className="text-3xl text-ink font-serif">카테고리</Text>
                <Text className="mt-2 text-[10px] uppercase tracking-[3px] text-muted font-sans-semibold">
                  분류를 더하고 다듬어요
                </Text>
              </View>
            </FadeIn>

            {/* Type tabs */}
            <View className="flex-row rounded-full bg-fill p-1">
              {TABS.map((tab) => {
                const active = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    className={`flex-1 items-center rounded-full py-2 ${active ? 'bg-white' : ''} active:opacity-70`}>
                    <Text className={`text-sm font-sans-semibold ${active ? 'text-ink' : 'text-muted'}`}>
                      {tab}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Scrollable grid — long-press a tile to drag-reorder; a tap opens it for editing. */}
        <Animated.ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
            webScrollContent,
          ]}>
          <FadeIn key={activeTab}>
            {ordered.length === 0 ? (
              <EmptyState message={'이 분류엔 아직 카테고리가 없어요.\n아래에서 새 카테고리를 더해보세요.'} />
            ) : (
              <>
                <Text className="mb-4 text-center text-[11px] text-muted font-sans">
                  길게 눌러 드래그하면 순서를 바꿀 수 있어요
                </Text>
                <Sortable.Grid
                  columns={4}
                  data={ordered}
                  keyExtractor={keyExtractor}
                  renderItem={renderTile}
                  rowGap={20}
                  columnGap={4}
                  scrollableRef={scrollRef}
                  onDragStart={() => {
                    justDraggedRef.current = true; // suppress the release-click that follows on web
                  }}
                  onDragEnd={({ data }) => {
                    reorderCategories(
                      activeTab,
                      data.map((c) => c.id),
                    );
                    syncOnEditEnd(); // push the new order to Drive right away (dirty-flag guarded)
                    // Fallback: clear the guard if no release-click arrives (e.g. on native).
                    setTimeout(() => {
                      justDraggedRef.current = false;
                    }, 300);
                  }}
                />
              </>
            )}
          </FadeIn>
        </Animated.ScrollView>

        {/* Fixed footer — the add button is always reachable, never scrolls away. */}
        <View
          style={[
            { paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 16 },
            webScrollContent,
          ]}>
          <Pressable
            onPress={openAdd}
            className="flex-row items-center justify-center gap-1.5 rounded-full bg-ink py-4 active:opacity-80">
            <Plus size={18} color={Palette.paper} />
            <Text className="text-base text-paper font-sans-bold">새 카테고리 추가</Text>
          </Pressable>
        </View>
      </View>

      <CategoryDrawer ref={drawerRef} />
    </Screen>
  );
}
