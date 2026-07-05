import { Plus } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { CategoryDrawer, type CategoryDrawerRef } from '@/components/category-drawer';
import { CategoryIcon } from '@/components/category-icon';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { useLedgerStore } from '@/store/ledger-store';
import type { CategoryItem, TransactionType } from '@/types/ledger';

const TABS: TransactionType[] = ['지출', '수입', '이체'];

const TONE: Record<TransactionType, string> = {
  수입: Palette.income,
  지출: Palette.ink,
  이체: Palette.transfer,
};

export default function CategoryManager() {
  const categories = useLedgerStore((s) => s.categories);
  const [activeTab, setActiveTab] = useState<TransactionType>('지출');

  const filtered = useMemo(
    () => categories.filter((c) => !c.deleted && c.type === activeTab),
    [categories, activeTab],
  );

  const drawerRef = useRef<CategoryDrawerRef>(null);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const openAdd = () => {
    setEditing(null);
    drawerRef.current?.present();
  };
  const openEdit = (category: CategoryItem) => {
    setEditing(category);
    drawerRef.current?.present();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 96 }}>
        <BackLink label="Settings" />

        <View className="mb-6 mt-4">
          <Text className="text-3xl text-ink font-serif">카테고리</Text>
          <Text className="mt-2 text-[10px] uppercase tracking-[3px] text-muted font-sans-semibold">
            분류를 더하고 다듬어요
          </Text>
        </View>

        {/* Type tabs */}
        <View className="mb-6 flex-row rounded-full bg-fill p-1">
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

        {/* Grid */}
        <FadeIn key={activeTab}>
          <View className="flex-row flex-wrap">
            {filtered.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => openEdit(category)}
                style={{ width: '25%' }}
                className="mb-6 items-center px-1 active:opacity-60">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-fill">
                  <CategoryIcon name={category.icon} size={22} color={TONE[category.type]} />
                </View>
                <Text
                  className="mt-2 text-center text-[11px] text-ink font-sans-medium"
                  numberOfLines={1}>
                  {category.name}
                </Text>
                {category.subcategories.length > 0 && (
                  <Text className="mt-0.5 text-center text-[9px] text-muted font-sans">
                    소분류 {category.subcategories.length}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </FadeIn>

        {/* Add */}
        <Pressable
          onPress={openAdd}
          className="mt-2 flex-row items-center justify-center gap-1.5 rounded-full bg-ink py-4 active:opacity-80">
          <Plus size={18} color={Palette.paper} />
          <Text className="text-base text-paper font-sans-bold">새 카테고리 추가</Text>
        </Pressable>
      </ScrollView>

      <CategoryDrawer
        ref={drawerRef}
        category={editing}
        defaultType={activeTab}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}
