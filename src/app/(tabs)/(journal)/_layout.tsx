import { Stack } from 'expo-router';

import { Palette } from '@/constants/palette';

// The Journal tab is a stack: years → [year] (months) → [year]/[month] (spreadsheet).
// Params are numeric (year/month) — safe identifiers, never raw Korean text in the URL.
export default function JournalStackLayout() {
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
