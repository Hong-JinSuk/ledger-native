import { Image, View } from 'react-native';

import { Palette } from '@/constants/palette';

import ledgerLogo from '@/assets/images/logo.png';

const LOGO_ASPECT = 1050 / 420; // matches the cropped wordmark used in the web top nav

/**
 * Minimal branded loading frame shown while fonts load + the ledger hydrates from AsyncStorage.
 * On native the OS splash sits on top of this, so it's mostly a fallback; its real job is WEB, where
 * `expo-splash-screen` is a no-op — without this the page flashes white before the app paints. Kept
 * dependency-free (plain View + Image, no safe-area/font hooks) because it renders BEFORE the
 * providers mount.
 */
export function BootScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Palette.paper,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Image
        source={ledgerLogo}
        style={{ width: 150, height: 150 / LOGO_ASPECT, opacity: 0.85 }}
        resizeMode="contain"
      />
    </View>
  );
}
