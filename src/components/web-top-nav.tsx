import { Image } from 'expo-image';
import { Link, usePathname } from 'expo-router';
import { BarChart2, BookOpen, Settings } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

import { WEB_MAX_WIDTH } from '@/constants/layout';
import { Palette } from '@/constants/palette';

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

  return (
    <View className="border-b border-line bg-paper">
      <View
        style={{ maxWidth: WEB_MAX_WIDTH, width: '100%', alignSelf: 'center' }}
        className="flex-row items-center justify-between px-5 py-4"
      >
        <Image
          source={ledgerLogo}
          style={{ height: LOGO_HEIGHT, aspectRatio: LOGO_ASPECT }}
          contentFit="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Ledger"
        />

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
    </View>
  );
}
