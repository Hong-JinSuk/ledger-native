import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Shared "nothing here yet" card — one warm treatment for every secondary empty list (categories,
 * fixed expenses, a day with no records, …) so they stop each looking different (plain text vs
 * dashed box vs solid card). Soft rounded card + centered muted copy, matching the app's card
 * language. The prominent first-run CTA empties (e.g. a month's first record) keep their own hero
 * treatment on purpose — this is for the quieter ones.
 */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <View className="items-center rounded-2xl border border-line bg-white/60 px-5 py-9">
      <Text className="text-center text-sm leading-6 text-muted font-sans">{message}</Text>
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}
