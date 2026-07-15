import { useRef, useState, type ComponentType } from 'react';
import { TextInput } from 'react-native';
import type { NativeSyntheticEvent, TextInputProps, TextInputSelectionChangeEventData } from 'react-native';

import { SheetTextInput } from '@/components/sheet-text-input';
import { Palette } from '@/constants/palette';
import { monoAmountWidth } from '@/lib/amount-width';
import { formatAmount } from '@/lib/money';

type Props = {
  /** Current amount as an integer (KRW). */
  value: number;
  /** Called with the new integer amount on every edit. */
  onChangeValue: (next: number) => void;
  /** Enter / return key → save. */
  onSubmitEditing?: () => void;
  /** Focus on mount (new record opens straight into the amount field). */
  autoFocus?: boolean;
  /** Render with a plain TextInput instead of the bottom-sheet input — for use OUTSIDE a bottom sheet
   *  (e.g. the onboarding overlay), where BottomSheetTextInput has no sheet context. */
  plain?: boolean;
};

type Sel = { start: number; end: number };

/** Caret index in `formatted` that sits just after `digitsLeft` digits (grouping commas skipped). */
function caretAfterDigits(formatted: string, digitsLeft: number): number {
  if (digitsLeft <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    const c = formatted.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      seen += 1;
      if (seen === digitsLeft) return i + 1;
    }
  }
  return formatted.length;
}

/**
 * Big centered amount field with live comma grouping (e.g. "2,700,000" as you type).
 *
 * Reformatting every keystroke normally yanks the caret to the end (the controlled value React feeds
 * back differs in shape from what the field had). We avoid that by re-anchoring the caret by DIGIT
 * COUNT: find how many digits sat left of the caret in the just-typed text, then place the caret after
 * that many digits in the freshly grouped string — so an inserted/removed comma near the caret can't
 * shove it. The `onSelectionChange` our own edit triggers is skipped once so it can't clobber that.
 */
export function AmountInput({ value, onChangeValue, onSubmitEditing, autoFocus, plain }: Props) {
  const [focused, setFocused] = useState(false);
  // Outside a bottom sheet, BottomSheetTextInput (inside SheetTextInput) has no sheet context — use a
  // plain TextInput there. Inside sheets (record/budget/fixed drawers) SheetTextInput wires keyboard avoidance.
  const Input = (plain ? TextInput : SheetTextInput) as ComponentType<TextInputProps>;
  const [sel, setSel] = useState<Sel | undefined>(undefined);
  const prevDisplay = useRef('');
  const skipNextSel = useRef(false);

  const display = value ? formatAmount(value) : '';

  return (
    <Input
      value={display}
      // Control the caret only while focused; released on blur so the field isn't over-controlled.
      selection={focused ? sel : undefined}
      onFocus={() => {
        prevDisplay.current = display;
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        setSel(undefined);
      }}
      onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        // Ignore the selection event our own reformat triggers — it would overwrite the caret we just
        // computed. User-driven taps/drags still update `sel` normally.
        if (skipNextSel.current) {
          skipNextSel.current = false;
          return;
        }
        setSel(e.nativeEvent.selection);
      }}
      onChangeText={(text) => {
        const digits = text.replace(/[^0-9]/g, '');
        const next = digits ? parseInt(digits, 10) : 0;
        const formatted = next ? formatAmount(next) : '';

        // Caret within the just-typed `text`: common prefix vs. the previously shown value, plus any
        // newly inserted chars (negative for a delete → clamped to the prefix). Then re-anchor by the
        // digit count into the regrouped string.
        const old = prevDisplay.current;
        let p = 0;
        while (p < old.length && p < text.length && old[p] === text[p]) p += 1;
        const caretInText = p + Math.max(0, text.length - old.length);
        const digitsLeft = text.slice(0, caretInText).replace(/[^0-9]/g, '').length;
        const caret = caretAfterDigits(formatted, digitsLeft);

        prevDisplay.current = formatted;
        skipNextSel.current = true;
        setSel({ start: caret, end: caret });
        onChangeValue(next);
      }}
      onSubmitEditing={onSubmitEditing}
      autoFocus={autoFocus}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={Palette.line}
      // Size to content on web so the centered [number] 원 stays tight and never overflows.
      style={monoAmountWidth(display, 36)}
      className="text-center text-4xl text-ink font-mono-semibold"
    />
  );
}
