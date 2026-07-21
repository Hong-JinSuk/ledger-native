import { Image } from 'expo-image';
import { Link, useRouter, usePathname } from 'expo-router';
import { BarChart2, BookOpen, Search, Settings } from 'lucide-react-native';
import { type ComponentType, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { SearchOverlay } from '@/components/search-overlay';
import { WEB_MAX_WIDTH } from '@/constants/layout';
import { Palette } from '@/constants/palette';
import { useSearchStore } from '@/store/search-store';

import ledgerLogo from '@/assets/images/logo.png';

type IconType = ComponentType<{ size?: number; color?: string }>;

/** Brand logo (assets/images/logo.png, trimmed to 1050×420); left-aligned in the top nav. */
const LOGO_ASPECT = 1050 / 420;
const LOGO_HEIGHT = 52;

type NavItem = {
  href: '/' | '/insights' | '/settings';
  label: string;
  Icon: IconType;
  isActive: (pathname: string) => boolean;
};

// Journal is the default group (its routes are '/', '/[year]', '/[year]/[month]'), so it's active
// whenever we're NOT under insights/settings.
const NAV: NavItem[] = [
  {
    href: '/',
    label: 'Journal',
    Icon: BookOpen,
    isActive: (p) => !p.startsWith('/insights') && !p.startsWith('/settings'),
  },
  {
    href: '/insights',
    label: 'Insights',
    Icon: BarChart2,
    isActive: (p) => p.startsWith('/insights'),
  },
  {
    href: '/settings',
    label: 'Settings',
    Icon: Settings,
    isActive: (p) => p.startsWith('/settings'),
  },
];

/**
 * Web-only top navigation bar (replaces the mobile bottom tabs). Full-width paper bar with a bottom
 * rule; its inner content aligns to {@link WEB_MAX_WIDTH} so the wordmark + pills line up with the
 * body's left/right margins. Rendered by (tabs)/_layout on web; never mounted on native.
 */
export function WebTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K(mac) / Ctrl+K(win) 전역 단축키로 검색 열기 · Esc로 닫기. 브라우저 기본(주소창 포커스 등)은 preventDefault로 가로챈다.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: any) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <View className="border-b border-line bg-paper">
      <View
        style={{ maxWidth: WEB_MAX_WIDTH, width: '100%', alignSelf: 'center' }}
        className="flex-row items-center justify-between px-5 py-4"
      >
        {/* 왼쪽: 로고 + 헤어라인 + 전역 검색 필 (프로토타입 — 위치·모양만, 아직 동작 없음). */}
        <View className="flex-row items-center gap-4">
          <Image
            source={ledgerLogo}
            style={{ height: LOGO_HEIGHT, aspectRatio: LOGO_ASPECT }}
            contentFit="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Ledger"
          />
          <View style={{ width: 1, height: 24, backgroundColor: Palette.line }} />
          {/* Apple/Toss 톤: 테두리 대신 은은한 fill pill · 넉넉한 너비 · placeholder 왼쪽, ⌘K는 오른쪽 끝 kbd 배지. */}
          <Pressable
            onPress={() => setSearchOpen(true)}
            className="flex-row items-center gap-2.5 rounded-full bg-fill px-4 active:opacity-80"
            style={{ height: 44, minWidth: 300 }}>
            <Search size={17} color={Palette.muted} />
            <Text className="flex-1 text-[15px] text-muted font-sans">검색</Text>
            <View
              className="rounded-lg bg-paper px-2 py-1"
              style={{ borderWidth: 1, borderColor: Palette.line }}>
              <Text
                className="text-[11px] text-muted font-sans-medium"
                style={{ letterSpacing: 0.5 }}>
                ⌘K
              </Text>
            </View>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-1 rounded-full bg-fill p-1">
          {NAV.map(({ href, label, Icon, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link key={href} href={href} asChild>
                <Pressable
                  className={`flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-70 ${
                    active ? 'bg-white' : ''
                  }`}
                >
                  <Icon
                    size={15}
                    color={active ? Palette.ink : Palette.muted}
                  />
                  <Text
                    className={`text-xs uppercase tracking-wider ${
                      active
                        ? 'text-ink font-sans-bold'
                        : 'text-muted font-sans-semibold'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>
      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSubmit={(groups, label) => {
          useSearchStore.getState().setQuery(groups, label);
          setSearchOpen(false);
          router.push('/search');
        }}
      />
    </View>
  );
}
