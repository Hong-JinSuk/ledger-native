import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';

// Out of v1 scope — kept as a placeholder (see MIGRATION_PLAN.md).
export default function InsightsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.paper }} edges={['top']}>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-2xl text-ink font-serif">Insights coming soon</Text>
        <Text className="text-center text-sm leading-6 text-muted font-sans">
          자산 흐름 및 소비 패턴 분석 기능이 준비 중입니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}
