import { useState } from 'react';

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
};

/**
 * Big centered amount field with comma grouping (e.g. "1,200,000").
 *
 * While FOCUSED it shows raw digits (no commas). Reformatting on every keystroke was what yanked the
 * caret to the ones place when editing a middle digit: the value React fed back ("12,001,000")
 * differed from what the browser had, so the caret reset to the end. Showing raw digits during
 * editing means the value never changes shape mid-keystroke, so the caret stays where you're typing.
 * On blur it shows the grouped number again. (SheetTextInput is a plain TextInput on web.)
 */
export function AmountInput({ value, onChangeValue, onSubmitEditing }: Props) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  const display = focused ? raw : value ? formatAmount(value) : '';

  return (
    <SheetTextInput
      value={display}
      onFocus={() => {
        setRaw(value ? String(value) : '');
        setFocused(true);
      }}
      onChangeText={(text) => {
        const digits = text.replace(/[^0-9]/g, '');
        setRaw(digits);
        onChangeValue(digits ? parseInt(digits, 10) : 0);
      }}
      onBlur={() => setFocused(false)}
      onSubmitEditing={onSubmitEditing}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={Palette.line}
      // Size to content on web so the centered [number] 원 stays tight and never overflows.
      style={monoAmountWidth(display, 36)}
      className="text-center text-4xl text-ink font-mono-semibold"
    />
  );
}
