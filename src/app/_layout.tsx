import '../global.css';

import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmProvider } from '@/components/confirm-dialog';
import { FONTS_TO_LOAD } from '@/constants/fonts';
import { Palette } from '@/constants/palette';
import { seedDevData } from '@/lib/dev/seed-dev-data';
import { useLedgerStore } from '@/store/ledger-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS_TO_LOAD);
  const hydrated = useLedgerStore((s) => s.hydrated);
  const hydrate = useLedgerStore((s) => s.hydrate);

  // Load the on-device ledger snapshot on boot (local-first).
  useEffect(() => {
    hydrate().then(() => {
      if (__DEV__) seedDevData();
    });
  }, [hydrate]);

  const ready = (fontsLoaded || fontError) && hydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ConfirmProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Palette.paper },
              }}
            />
          </ConfirmProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
