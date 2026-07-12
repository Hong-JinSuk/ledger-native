import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Palette } from '@/constants/palette';

/**
 * Sonner-shaped toast for React Native (works on native AND react-native-web). Sonner itself is a
 * DOM-only library, so this reimplements its ergonomics — `toast()` + `.success/.error/.info/
 * .warning/.loading/.promise/.dismiss` — over an imperative module store, matched to the app's warm
 * "감성" tone. Mount {@link Toaster} once at the root; fire toasts via the imperative {@link toast}
 * (no provider/hook needed). {@link useToast} is kept as a thin back-compat alias.
 */

export type ToastVariant = 'default' | 'success' | 'error' | 'info' | 'warning' | 'loading';

type ToastOptions = { id?: number; description?: string; duration?: number };

export type ToastItem = {
  id: number;
  variant: ToastVariant;
  message: string;
  description?: string;
  /** True once dismissal starts, so the row can animate out before it's removed. */
  dismissing: boolean;
};

// --- Queue (module store) -----------------------------------------------------------------------
type ToastState = {
  toasts: ToastItem[];
  upsert: (t: Omit<ToastItem, 'dismissing'>) => void;
  startDismiss: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
};

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  upsert: (t) =>
    set((s) => {
      const next: ToastItem = { ...t, dismissing: false };
      return {
        toasts: s.toasts.some((x) => x.id === t.id)
          ? s.toasts.map((x) => (x.id === t.id ? next : x))
          : [...s.toasts, next],
      };
    }),
  startDismiss: (id) =>
    set((s) => ({ toasts: s.toasts.map((x) => (x.id === id ? { ...x, dismissing: true } : x)) })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

// --- Imperative API -----------------------------------------------------------------------------
const DURATION: Record<ToastVariant, number> = {
  default: 2600,
  success: 2600,
  info: 2600,
  warning: 3200,
  error: 3800,
  loading: Number.POSITIVE_INFINITY, // stays until updated (e.g. by promise) or dismissed
};

let counter = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function scheduleDismiss(id: number, duration: number) {
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  if (Number.isFinite(duration)) {
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        useToastStore.getState().startDismiss(id);
      }, duration),
    );
  }
}

function push(variant: ToastVariant, message: string, opts?: ToastOptions): number {
  const id = opts?.id ?? ++counter;
  useToastStore.getState().upsert({ id, variant, message, description: opts?.description });
  scheduleDismiss(id, opts?.duration ?? DURATION[variant]);
  return id;
}

type PromiseMessages<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((err: unknown) => string);
};

export const toast = Object.assign(
  (message: string, opts?: ToastOptions) => push('default', message, opts),
  {
    success: (message: string, opts?: ToastOptions) => push('success', message, opts),
    error: (message: string, opts?: ToastOptions) => push('error', message, opts),
    info: (message: string, opts?: ToastOptions) => push('info', message, opts),
    warning: (message: string, opts?: ToastOptions) => push('warning', message, opts),
    /** Persists until updated/dismissed; returns its id so you can update it. */
    loading: (message: string, opts?: ToastOptions) => push('loading', message, opts),
    /** Dismiss one toast (animated) or, with no id, clear them all immediately. */
    dismiss: (id?: number) => {
      if (id == null) {
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
        useToastStore.getState().clear();
      } else {
        const t = timers.get(id);
        if (t) clearTimeout(t);
        timers.delete(id);
        useToastStore.getState().startDismiss(id);
      }
    },
    /** Show a loading toast, then swap it to success/error when the promise settles. */
    promise: <T,>(promise: Promise<T>, messages: PromiseMessages<T>) => {
      const id = push('loading', messages.loading);
      promise.then(
        (data) =>
          push(
            'success',
            typeof messages.success === 'function' ? messages.success(data) : messages.success,
            { id },
          ),
        (err) =>
          push(
            'error',
            typeof messages.error === 'function' ? messages.error(err) : messages.error,
            { id },
          ),
      );
      return promise;
    },
  },
);

/** Back-compat: returns the imperative {@link toast}. Existing `const toast = useToast()` keeps working. */
export function useToast() {
  return toast;
}

// --- UI -----------------------------------------------------------------------------------------
type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const VARIANT: Record<ToastVariant, { color: string; Icon: IconCmp | null }> = {
  default: { color: Palette.ink, Icon: null },
  success: { color: Palette.income, Icon: CircleCheck },
  error: { color: Palette.expense, Icon: CircleX },
  info: { color: Palette.transfer, Icon: Info },
  warning: { color: '#D97706', Icon: TriangleAlert }, // amber-600 (not in the base palette)
  loading: { color: Palette.muted, Icon: null }, // spinner instead of an icon
};

/**
 * Non-blocking top overlay that stacks the active toasts. Mount ONCE at the root. Reads the queue
 * from the module store, so any code can fire a toast via {@link toast} without a provider.
 */
export function Toaster() {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((s) => s.toasts);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 12,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 8,
      }}>
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </View>
  );
}

function ToastRow({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const [anim] = useState(() => new Animated.Value(0));

  // Enter: fade + slide down (the app's default motion "결").
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [anim]);

  // Exit: once flagged dismissing, animate out then drop from the queue.
  useEffect(() => {
    if (!item.dismissing) return;
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) remove(item.id);
      },
    );
  }, [item.dismissing, anim, remove, item.id]);

  const { color, Icon } = VARIANT[item.variant];

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
      }}>
      <Pressable
        onPress={() => toast.dismiss(item.id)}
        className="flex-row items-center gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3"
        style={{
          maxWidth: 440,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 6,
        }}>
        {item.variant === 'loading' ? (
          <ActivityIndicator size="small" color={Palette.muted} />
        ) : Icon ? (
          <Icon size={17} color={color} strokeWidth={2.4} />
        ) : (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        )}
        <View className="shrink">
          <Text className="text-sm text-ink font-sans-medium">{item.message}</Text>
          {!!item.description && (
            <Text className="mt-0.5 text-xs leading-5 text-muted font-sans">{item.description}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
