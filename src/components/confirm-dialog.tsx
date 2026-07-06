import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  /** Confirm button label. Default '삭제'. */
  confirmLabel?: string;
  /** Cancel button label. Default '취소'. */
  cancelLabel?: string;
  /** Red confirm button (delete-style). Default true. */
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Cross-platform confirm (works on native AND react-native-web, unlike `Alert.alert` which is a
 * no-op on web). Returns a promise resolving true/false. Mount {@link ConfirmProvider} once at the
 * root; call via {@link useConfirm}. Replaces the per-call Alert dialogs so deletes work on web too.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const destructive = options?.destructive !== false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={options !== null}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}>
        <Pressable
          onPress={() => close(false)}
          className="flex-1 items-center justify-center bg-black/40 px-8">
          {/* Inner press absorbs taps so tapping the card doesn't dismiss. */}
          <Pressable onPress={() => {}} className="w-full max-w-sm rounded-3xl bg-paper p-6">
            <Text className="text-xl text-ink font-serif">{options?.title}</Text>
            {!!options?.message && (
              <Text className="mt-2 text-sm leading-6 text-muted font-sans">{options.message}</Text>
            )}
            <View className="mt-6 flex-row gap-2">
              <Pressable
                onPress={() => close(false)}
                className="flex-1 items-center rounded-full bg-fill py-3.5 active:opacity-70">
                <Text className="text-sm text-ink font-sans-semibold">
                  {options?.cancelLabel ?? '취소'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => close(true)}
                className={`flex-1 items-center rounded-full py-3.5 active:opacity-80 ${destructive ? 'bg-expense' : 'bg-ink'}`}>
                <Text className="text-sm text-paper font-sans-bold">
                  {options?.confirmLabel ?? '삭제'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}
