import { useEffect, useState, type ReactNode } from 'react';
import { Animated, type ViewStyle } from 'react-native';

/**
 * Soft fade + rise entrance (the app's default motion "결"). Stagger via `delay`.
 * Uses RN's built-in Animated (no extra deps) so it runs identically on native and web.
 * The Animated.Value is held in state (lazy init) rather than a ref so it isn't read
 * during render — satisfies the React Compiler's rules-of-react lint.
 */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 350,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}
