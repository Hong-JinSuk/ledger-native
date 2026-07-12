import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';

import { Palette } from '@/constants/palette';
import { useIsWideViewport } from '@/hooks/use-responsive';

export type AdaptiveSheetRef = { present: () => void; dismiss: () => void };

type Props = {
  /** Mobile bottom-sheet snap points (ignored by the wide-web side panel, which is full height). */
  snapPoints?: (string | number)[];
  /** Scrollable body (long forms) vs a plain view (short forms). Default true. */
  scroll?: boolean;
  /** Padding/style for the content container — the same value is used on both layouts. */
  contentContainerStyle?: ViewStyle;
  /** Runs after the sheet/panel finishes closing (e.g. the write-end Drive sync hook). */
  onDismiss?: () => void;
  children: ReactNode;
};

/**
 * One drawer surface, two shapes:
 *  • phone / narrow viewport → a @gorhom bottom sheet that slides up (unchanged behavior).
 *  • tablet & up             → a centered modal dialog that fades in, because a full-width bottom
 *    sheet feels heavy on a wide screen.
 *
 * The SAME children render in both — only the container swaps — and it exposes present()/dismiss()
 * so each drawer keeps its existing imperative ref API. Text inputs already degrade to a plain
 * TextInput on web (see SheetTextInput), so the form content is portable across both containers.
 */
export const AdaptiveSheet = forwardRef<AdaptiveSheetRef, Props>(
  function AdaptiveSheet(
    { snapPoints, scroll = true, contentContainerStyle, onDismiss, children },
    ref,
  ) {
    const isWide = useIsWideViewport();

    // Mobile: gorhom bottom sheet.
    const bottomRef = useRef<BottomSheetModal>(null);

    // Wide: a centered modal driven by a single 0→1 progress value (fades in/out via opacity).
    const [webOpen, setWebOpen] = useState(false);
    const [anim] = useState(() => new Animated.Value(0));

    useEffect(() => {
      if (webOpen) {
        Animated.timing(anim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start();
      }
    }, [webOpen, anim]);

    const closeWeb = useCallback(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setWebOpen(false);
          onDismiss?.();
        }
      });
    }, [anim, onDismiss]);

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          if (isWide) setWebOpen(true);
          else bottomRef.current?.present();
        },
        dismiss: () => {
          if (isWide) closeWeb();
          else bottomRef.current?.dismiss();
        },
      }),
      [isWide, closeWeb],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.35}
        />
      ),
      [],
    );

    if (isWide) {
      // Tablet & up → a centered modal dialog that fades in (not a full-width bottom sheet).
      return (
        <Modal
          visible={webOpen}
          transparent
          animationType="none"
          onRequestClose={closeWeb}
        >
          <Animated.View style={{ flex: 1, opacity: anim }}>
            <Pressable
              onPress={closeWeb}
              accessibilityLabel="닫기"
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                backgroundColor: 'rgba(0,0,0,0.4)',
              }}
            >
              {/* Inner press absorbs taps so tapping the card doesn't dismiss (like ConfirmDialog). */}
              <Pressable
                onPress={() => {}}
                style={{
                  width: '100%',
                  maxWidth: 480,
                  maxHeight: '86%',
                  backgroundColor: Palette.paper,
                  borderRadius: 28,
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.18,
                  shadowRadius: 32,
                  paddingTop: 24,
                }}
              >
                {scroll ? (
                  <ScrollView
                    contentContainerStyle={contentContainerStyle}
                    keyboardShouldPersistTaps="handled"
                  >
                    {children}
                  </ScrollView>
                ) : (
                  <View style={contentContainerStyle}>{children}</View>
                )}
              </Pressable>
            </Pressable>
          </Animated.View>
        </Modal>
      );
    }

    return (
      <BottomSheetModal
        ref={bottomRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: Palette.paper }}
        handleIndicatorStyle={{ backgroundColor: Palette.line }}
        onDismiss={onDismiss}
      >
        {scroll ? (
          <BottomSheetScrollView contentContainerStyle={contentContainerStyle}>
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={contentContainerStyle}>
            {children}
          </BottomSheetView>
        )}
      </BottomSheetModal>
    );
  },
);
