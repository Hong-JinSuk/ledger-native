import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type ViewStyle } from 'react-native';

/**
 * Soft fade + rise entrance (the app's default motion "결"). Stagger via `delay`.
 * Uses RN's built-in Animated (no extra deps) so it runs identically on native and web.
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
  const progress = useRef(new Animated.Value(0)).current;

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
