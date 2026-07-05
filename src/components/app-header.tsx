import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { FadeIn } from '@/components/fade-in';

const LETTER_STAGGER = 42; // ms between letters
const LETTER_DURATION = 320;

type Size = 'lg' | 'md';

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

  const titleClass = size === 'lg' ? 'text-4xl text-ink font-serif' : 'text-3xl text-ink font-serif';
  const subDelay = Math.min(title.length * LETTER_STAGGER, 320) + 40;

  return (
    <View className="mb-6" key={`${replay}-${title}-${subtitle}`}>
      <View className="flex-row flex-wrap">
        {title.split('').map((ch, i) => (
          <Letter key={`${i}-${ch}`} char={ch} delay={i * LETTER_STAGGER} textClass={titleClass} />
        ))}
      </View>

      <FadeIn delay={subDelay}>
        <Text className="mt-2 text-[10px] uppercase tracking-[3px] text-muted font-sans-semibold">
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
    </View>
  );
}

/** One title letter: fade + rise. Animated.View carries the motion (style only), Text the styling. */
function Letter({ char, delay, textClass }: { char: string; delay: number; textClass: string }) {
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
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        ],
      }}>
      {/* Non-breaking space keeps word gaps when each glyph is its own inline box. */}
      <Text className={textClass}>{char === ' ' ? ' ' : char}</Text>
    </Animated.View>
  );
}
