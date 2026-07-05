import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';

// Placeholder — real Settings (budget · fixed expenses · categories) lands in Phase 4.
export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.paper }} edges={['top']}>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-2xl text-ink font-serif">Settings</Text>
        <Text className="text-center text-sm leading-6 text-muted font-sans">
          개인 설정 · 예산 · 카테고리
        </Text>
      </View>
    </SafeAreaView>
  );
}
