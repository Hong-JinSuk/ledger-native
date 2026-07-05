import { Text, View } from 'react-native';

import { formatAmount } from '@/lib/money';

type Tone = 'income' | 'expense' | 'ink' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  income: 'text-income',
  expense: 'text-expense',
  ink: 'text-ink',
  muted: 'text-muted',
};

/** A labelled amount: small uppercase caption over a mono figure, coloured by tone. */
export function AmountStat({
  label,
  amount,
  tone = 'ink',
  size = 'base',
}: {
  label: string;
  amount: number;
  tone?: Tone;
  size?: 'sm' | 'base';
}) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
        {label}
      </Text>
      <Text className={`mt-1 ${size === 'sm' ? 'text-sm' : 'text-base'} ${TONE_CLASS[tone]} font-mono-medium`}>
        {formatAmount(amount)}
      </Text>
    </View>
  );
}
