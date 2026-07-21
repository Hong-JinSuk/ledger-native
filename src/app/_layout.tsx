import '../global.css';

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BootScreen } from '@/components/boot-screen';
import { ConfirmProvider } from '@/components/confirm-dialog';
import { Toaster } from '@/components/toast';
import { FONTS_TO_LOAD } from '@/constants/fonts';
import { Palette } from '@/constants/palette';
import { initNotifications } from '@/lib/notifications/notifications';
import { ensureAccountScope, syncNow } from '@/lib/sync/sync-service';
import { useAuthStore } from '@/store/auth-store';
import { useLedgerStore } from '@/store/ledger-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS_TO_LOAD);
  const hydrated = useLedgerStore((s) => s.hydrated);
  const hydrate = useLedgerStore((s) => s.hydrate);

  const session = useAuthStore((s) => s.session);
  const authInitializing = useAuthStore((s) => s.initializing);
  const initializeAuth = useAuthStore((s) => s.initialize);

  // Load the on-device ledger snapshot on boot (local-first).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Register the local-notification handler + Android channel once at boot. Permission is NOT asked
  // here — that happens lazily when a reminder is first turned on (see scheduleReminder).
  useEffect(() => {
    void initNotifications();
  }, []);

  // Wire up Supabase auth: read the persisted session, then subscribe (cleanup unsubscribes).
  useEffect(() => initializeAuth(), [initializeAuth]);

  const ready = (fontsLoaded || fontError) && hydrated && !authInitializing;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // Google Drive sync (Phase 6): once ready + logged in, sync on start and whenever the app returns
  // to the foreground. syncNow coalesces concurrent calls; failures never touch local data.
  useEffect(() => {
    if (!ready || !session) return;
    const userId = session.user.id;
    let active = true;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    // Scope the local mirror to this account BEFORE the first sync — a different Google account on the
    // same device/browser resets local (its data stays safe in the previous account's Drive) so the two
    // never bleed together. Same account keeps its local-first data untouched.
    void (async () => {
      await ensureAccountScope(userId);
      if (active) void syncNow();
    })();
    return () => {
      active = false;
      sub.remove();
    };
  }, [ready, session]);

  if (!ready) {
    // Paper-bg branded boot frame instead of a blank one. On native the OS splash covers this; on
    // web (no splash) it replaces the white flash during font load + AsyncStorage hydration.
    return <BootScreen />;
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
              }}>
              {/* Auth gate: logged in → the app; logged out → the login screen. Flipping `session`
                  swaps which group is mounted, and expo-router redirects to the available one. */}
              <Stack.Protected guard={!!session}>
                <Stack.Screen name="(tabs)" />
              </Stack.Protected>
              <Stack.Protected guard={!session}>
                <Stack.Screen name="login" />
              </Stack.Protected>
              {/* Web OAuth return target — reachable in both states (native never navigates here). */}
              <Stack.Screen name="auth/callback" />
            </Stack>
            <Toaster />
          </ConfirmProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
