import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { Palette } from '@/constants/palette';

/** Editorial back affordance: chevron + uppercase tracked label (e.g. "Years" / "Months"). */
export function BackLink({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      className="flex-row items-center gap-1 active:opacity-60">
      <ChevronLeft size={16} color={Palette.muted} strokeWidth={2.5} />
      <Text className="mt-[1px] text-[10px] uppercase tracking-[2px] text-muted font-sans-semibold">
        {label}
      </Text>
    </Pressable>
  );
}
