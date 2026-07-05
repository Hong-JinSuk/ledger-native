import { Stack } from 'expo-router';

import { Palette } from '@/constants/palette';

// The Settings tab is a stack: index (budget · categories · fixed expenses) → categories (CRUD).
export default function SettingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.paper },
        animation: 'slide_from_right',
      }}
    />
  );
}
