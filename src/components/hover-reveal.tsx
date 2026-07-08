import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Palette } from '@/constants/palette';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Frosted-glass blur behind the overlay. Web-only: react-native-web forwards these CSS properties
// to the DOM (RN has no backdrop-filter). If a browser ignores it, the cream tint alone still reads.
const WEB_BLUR: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as unknown as ViewStyle)
    : undefined;

// The squiggly "record" arrow from the original web: a straight line with a loop-de-loop, then a
// separate arrowhead. Drawn via stroke-dash (offset animates length -> 0 = "draws itself").
const LINE_D = 'M 5 10 L 12 10 C 18 10, 18 4, 15 4 C 12 4, 12 16, 15 16 C 18 16, 18 10, 21 10 L 35 10';
const HEAD_D = 'M 31 6 L 35 10 L 31 14';
const LINE_LEN = 52; // ~path length; dash ≥ length so it fully hides at the start
const HEAD_LEN = 12;

/**
 * Web-only frosted hover overlay for cards: fades in a CTA whose squiggly arrow "draws" itself
 * (line first, then the arrowhead) — ported from the original web's motion `pathLength` effect.
 * Driven by `hovered`. `pointerEvents` is off so the card's own onPress still fires underneath.
 */
export function HoverReveal({ hovered, label }: { hovered: boolean; label: string }) {
  const [fade] = useState(() => new Animated.Value(0));
  const [draw] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fade, {
      toValue: hovered ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    // SVG stroke props can't use the native driver, so this one is JS-driven.
    Animated.timing(draw, {
      toValue: hovered ? 1 : 0,
      duration: hovered ? 800 : 180,
      useNativeDriver: false,
    }).start();
  }, [hovered, fade, draw]);

  // Line draws over the first 75%, arrowhead over the last 25% (matches the original's 0.6s + 0.2s).
  const lineOffset = draw.interpolate({ inputRange: [0, 0.75, 1], outputRange: [LINE_LEN, 0, 0] });
  const headOffset = draw.interpolate({ inputRange: [0, 0.75, 1], outputRange: [HEAD_LEN, HEAD_LEN, 0] });
  const headOpacity = draw.interpolate({ inputRange: [0, 0.74, 0.75, 1], outputRange: [0, 0, 1, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center', opacity: fade },
        WEB_BLUR,
      ]}
      className="bg-fill/70">
      <View className="flex-row items-center gap-2 border-b border-ink pb-1.5">
        <Text className="text-[11px] uppercase tracking-widest text-ink font-sans-bold">{label}</Text>
        <Svg width={44} height={22} viewBox="0 0 40 20" fill="none">
          <AnimatedPath
            d={LINE_D}
            stroke={Palette.ink}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={LINE_LEN}
            strokeDashoffset={lineOffset}
          />
          <AnimatedPath
            d={HEAD_D}
            stroke={Palette.ink}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={HEAD_LEN}
            strokeDashoffset={headOffset}
            opacity={headOpacity}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}
