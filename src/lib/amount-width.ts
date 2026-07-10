import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * Web-only explicit width for a big monospace amount field, sized to its content (+1 char for the
 * caret). react-native-web gives an unconstrained `<input>` a wide fixed default width, which shoves
 * the number out of a centered `[number] 원` row and overflows at narrow (mobile) widths. Pinning the
 * width to the actual content keeps the field tight and contained at any width. Native `TextInput`s
 * already size to their content, so this returns `undefined` (no-op) there.
 *
 * `fontPx` = the field's font size (Tailwind text-3xl = 30, text-4xl = 36). JetBrains Mono is
 * monospace with a 0.6em advance, so content width ≈ chars × 0.6em.
 */
export function monoAmountWidth(display: string, fontPx: number): TextStyle | undefined {
  if (Platform.OS !== 'web') return undefined;
  const chars = Math.max(display.length, 1) + 1; // +1 char of room for the caret
  return { width: Math.ceil(chars * fontPx * 0.6) };
}
