import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small secret store for the Google Drive tokens (the app's crown jewels — they grant access to
 * the user's own Drive, where the ledger data will live in Phase 6). We keep these OUT of the
 * plain ledger AsyncStorage.
 *
 * 🔴 Native: expo-secure-store (iOS Keychain / Android Keystore) — hardware-backed, the right place.
 * 🟡 Web: SecureStore doesn't exist on react-native-web, so we fall back to AsyncStorage
 *    (localStorage). That's LESS secure — acceptable only because web is secondary and Phase 6
 *    moves the Drive-token refresh server-side (the refresh needs the Google client secret, which
 *    never ships in the client anyway). Don't treat the web copy as truly secret.
 */
const isWeb = Platform.OS === 'web';

export async function setSecret(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getSecret(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function deleteSecret(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
