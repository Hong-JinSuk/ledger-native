import { type Href, useRouter, usePathname } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { Palette } from '@/constants/palette';

/**
 * Editorial back affordance: chevron + uppercase tracked label (e.g. "Years" / "Months").
 *
 * Default: go to the PARENT route by dropping the last path segment — deep-link safe (see below).
 * Pass `backFallback` for screens reachable from ANYWHERE (e.g. search via ⌘K): those go BACK to
 * wherever they were opened from, and use that href only when there's no history to pop.
 */
export function BackLink({ label, backFallback }: { label: string; backFallback?: Href }) {
  const router = useRouter();
  const pathname = usePathname();

  const onPress = () => {
    if (backFallback) {
      if (router.canGoBack()) router.back();
      else router.replace(backFallback);
      return;
    }
    // Drop the last segment (/2026/8 → /2026, /settings/categories → /settings) instead of
    // router.back(): back() is a no-op when the screen was opened via a fresh deep link (no history
    // to pop), so the link would do nothing.
    const parent = pathname.replace(/\/[^/]+$/, '') || '/';
    router.replace(parent as Href);
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="flex-row items-center gap-1 active:opacity-60">
      <ChevronLeft size={16} color={Palette.muted} strokeWidth={2.5} />
      <Text className="mt-[1px] text-[10px] uppercase tracking-[2px] text-muted font-sans-semibold">
        {label}
      </Text>
    </Pressable>
  );
}
