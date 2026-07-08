import { useEffect, type RefObject } from 'react';
import { Platform } from 'react-native';

/**
 * Web-only "click outside to dismiss": calls `onOutside` when a pointer press lands outside the
 * element `ref` points at, or when Escape is pressed. No-op on native — RN has no `document`, and
 * inline inputs there dismiss via their own 취소 button / keyboard.
 *
 * On react-native-web a View's ref resolves to the underlying DOM node, so `.contains` exists at
 * runtime. `active` gates the listeners so they only run while the dismissible UI is open.
 */
export function useClickOutside(
  ref: RefObject<unknown>,
  active: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;

    const isOutside = (target: EventTarget | null) => {
      const node = ref.current as { contains?: (t: EventTarget | null) => boolean } | null;
      // If the ref hasn't resolved to a DOM node, don't dismiss (fail safe = keep it open).
      return !!node?.contains && !node.contains(target);
    };

    const handlePointer = (e: Event) => {
      if (isOutside(e.target)) onOutside();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOutside();
    };

    // `pointerdown` (not click) so the dismiss fires as the outside press starts; presses *inside*
    // the ref (e.g. the 추가 button) are excluded, so their own onPress still commits normally.
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, active, onOutside]);
}
