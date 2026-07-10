import { Check } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';

type ToastFn = (message: string) => void;

const ToastContext = createContext<ToastFn | null>(null);

/**
 * Gentle success toast for quiet feedback (e.g. "기록했어요"). A warm-toned pill that slides in from
 * the top and auto-dismisses — soft enough not to interrupt the "감성" tone. Cross-platform (native
 * AND react-native-web). Mount {@link ToastProvider} once at the root; call via {@link useToast}.
 * Mirrors {@link useConfirm}'s provider/hook shape so success + confirm feedback stay consistent.
 */
export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const VISIBLE_MS = 1900;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  // Held in state (lazy init), not a ref, so it isn't read during render — matches FadeIn and keeps
  // the React Compiler's rules-of-react lint happy. Mutated only from event handlers/effects.
  const [anim] = useState(() => new Animated.Value(0)); // 0 = hidden, 1 = shown
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMessage(null);
      },
    );
  }, [anim]);

  const show = useCallback<ToastFn>(
    (msg) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, VISIBLE_MS);
    },
    [anim, hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message !== null && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 0,
            right: 0,
            alignItems: 'center',
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
            ],
          }}>
          <View
            className="flex-row items-center gap-2 rounded-full bg-ink px-4 py-2.5"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.14,
              shadowRadius: 12,
              elevation: 6,
            }}>
            <Check size={14} color={Palette.paper} strokeWidth={3} />
            <Text className="text-sm text-paper font-sans-medium">{message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
