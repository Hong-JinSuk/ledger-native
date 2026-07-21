import { useFocusEffect } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { FadeIn } from '@/components/fade-in';
import { MobileSearchBar } from '@/components/mobile-search-bar';
import { SyncIndicator } from '@/components/sync-indicator';
import { FontFamily } from '@/constants/fonts';
import { Palette } from '@/constants/palette';
import { useIsWideScreen } from '@/hooks/use-responsive';

const LETTER_STAGGER = 42; // ms between letters
const LETTER_DURATION = 320;

// 헤딩은 글자별로 폰트를 고른다: 한글은 Noto Sans KR(라틴 세리프엔 한글이 없어 폴백되던 걸 교체),
// 영문·숫자·기호는 지금의 Playfair 이탤릭 그대로. → "2026. 7월"이면 "2026."은 Playfair, "월"은 한글체.
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

type Size = 'lg' | 'md' | 'sm';

/**
 * Unified editorial page header used across every tab/screen so the title + subtitle sit in
 * the SAME position everywhere (the back affordance drops BELOW the subtitle instead of pushing
 * the title down) — no vertical jump when switching Journal ↔ Settings ↔ Insights.
 *
 * The title animates in letter-by-letter (ported from the original web's staggered reveal) and
 * REPLAYS on every focus — bottom tabs keep screens mounted, so a mount-only animation wouldn't
 * re-fire on tab switches; we bump a key on focus to remount + replay.
 */
export function AppHeader({
  title,
  subtitle,
  backLabel,
  size = 'lg',
}: {
  title: string;
  subtitle: string;
  backLabel?: string;
  size?: Size;
}) {
  const [replay, setReplay] = useState(0);
  const first = useRef(true);
  // 모바일/좁은 화면에서만 헤더에 검색 진입을 둔다(와이드 웹은 WebTopNav가 검색을 소유).
  const isWide = useIsWideScreen();
  const [searchOpen, setSearchOpen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      // First focus already animates via mount; only re-trigger on subsequent focuses.
      if (first.current) {
        first.current = false;
        return;
      }
      setReplay((r) => r + 1);
    }, []),
  );

  // font family는 Letter가 글자별로(한글/라틴) 정하므로 여기선 크기·색만. (font-serif 제거)
  const titleClass =
    size === 'lg'
      ? 'text-4xl text-ink'
      : size === 'md'
        ? 'text-3xl text-ink'
        : 'text-2xl text-ink';
  const subDelay = Math.min(title.length * LETTER_STAGGER, 320) + 40;

  return (
    <View className="mb-6" key={`${replay}-${title}-${subtitle}`}>
      {/* Top-right cluster: transient sync chip + (mobile only) search entry. Pinned so it never
          shifts the title's letter reveal. On wide web the WebTopNav owns search, so it's hidden here. */}
      <View
        style={{ position: 'absolute', top: 2, right: 0, zIndex: 10 }}
        className="flex-row items-center gap-2">
        <SyncIndicator />
        {!isWide ? (
          <Pressable
            onPress={() => setSearchOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="검색"
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-60">
            <Search size={20} color={Palette.muted} />
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row flex-wrap">
        {title.split('').map((ch, i) => (
          <Letter
            key={`${i}-${ch}`}
            char={ch}
            delay={i * LETTER_STAGGER}
            textClass={titleClass}
          />
        ))}
      </View>

      <FadeIn delay={subDelay}>
        <Text className="mt-2 text-[10px] uppercase tracking-[3px] text-muted">
          {subtitle}
        </Text>
      </FadeIn>

      {backLabel ? (
        <FadeIn delay={subDelay + 70}>
          <View className="mt-3">
            <BackLink label={backLabel} />
          </View>
        </FadeIn>
      ) : null}

      {/* 모바일 검색바 — 위에서 내려오는 심플 검색(단어+Enter). 와이드 웹은 진입 자체가 없어 열리지 않음. */}
      <MobileSearchBar visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

/** One title letter: fade + rise. Animated.View carries the motion (style only), Text the styling. */
function Letter({
  char,
  delay,
  textClass,
}: {
  char: string;
  delay: number;
  textClass: string;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: LETTER_DURATION,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}
    >
      {/* Non-breaking space keeps word gaps when each glyph is its own inline box. */}
      <Text
        className={textClass}
        style={{
          fontFamily: HANGUL.test(char)
            ? FontFamily.headingKo
            : FontFamily.serif,
        }}
      >
        {char === ' ' ? ' ' : char}
      </Text>
    </Animated.View>
  );
}
