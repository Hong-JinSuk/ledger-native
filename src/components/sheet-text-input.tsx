import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ComponentType } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';

/**
 * A text input for use inside a bottom sheet.
 *
 * • Native: @gorhom's `BottomSheetTextInput`, which wires the sheet's keyboard avoidance.
 * • Web: that component CRASHES on blur — its blur handler calls the native-only
 *   `TextInput.State.currentlyFocusedInput()`, which react-native-web doesn't implement
 *   ("RNTextInput.default.State.currentlyFocusedInput is not a function"). A plain TextInput works
 *   fine inside the sheet on web (no keyboard avoidance is needed there), so we fall back to it.
 *
 * Props are the standard TextInput props (+ NativeWind `className`) — identical on both platforms.
 */
const Input = (
  Platform.OS === 'web' ? TextInput : BottomSheetTextInput
) as unknown as ComponentType<TextInputProps>;

export function SheetTextInput(props: TextInputProps) {
  return <Input {...props} />;
}
