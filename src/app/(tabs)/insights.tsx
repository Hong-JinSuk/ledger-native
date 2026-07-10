import { Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { FadeIn } from '@/components/fade-in';
import { Screen } from '@/components/screen';

// Out of v1 scope — kept as a placeholder (see MIGRATION_PLAN.md). Uses the shared AppHeader so the
// title sits in the same position as every other tab (no jump when switching to/from Insights).
export default function InsightsScreen() {
  return (
    <Screen>
      <View className="flex-1 px-5 pt-4">
        <AppHeader title="Insights" subtitle="Financial Analytics" />
        <FadeIn delay={80} style={{ flex: 1 }}>
          <View className="flex-1 items-center justify-center gap-3 px-3 pb-24">
            <Text className="text-2xl text-ink font-serif">아직 준비 중이에요</Text>
            <Text className="text-center text-sm leading-6 text-muted font-sans">
              자산 흐름과 소비 패턴을{'\n'}곧 다정하게 담아둘게요.
            </Text>
          </View>
        </FadeIn>
      </View>
    </Screen>
  );
}
