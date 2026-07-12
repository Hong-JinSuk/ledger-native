import { ActivityIndicator, Text, View } from 'react-native';

import { Palette } from '@/constants/palette';
import { useSyncStore } from '@/store/sync-store';

/**
 * Tiny, non-blocking sync-status chip for the page header. It appears ONLY while syncing or on error
 * — idle/synced render nothing, so the warm header stays uncluttered. Its job is to explain WHY the
 * journal might quietly reflow when a Drive pull lands on app-start / foreground (previously silent).
 */
export function SyncIndicator() {
  const status = useSyncStore((s) => s.status);

  if (status === 'syncing') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-fill px-2.5 py-1">
        <ActivityIndicator size="small" color={Palette.muted} />
        <Text className="text-[10px] uppercase tracking-wider text-muted font-sans-semibold">
          동기화 중
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-fill px-2.5 py-1">
        <View className="h-1.5 w-1.5 rounded-full bg-expense" />
        <Text className="text-[10px] uppercase tracking-wider text-expense font-sans-semibold">
          동기화 실패
        </Text>
      </View>
    );
  }

  return null;
}
