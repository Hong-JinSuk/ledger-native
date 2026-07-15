import AsyncStorage from '@react-native-async-storage/async-storage';

import { ONBOARDING_SEEN_KEY } from '@/constants/ledger';

/**
 * Whether the first-run welcome (set a default budget + fixed expenses) has already been shown/dismissed
 * on this device. Local-only + per-device — deliberately NOT part of the synced snapshot, since it's UI
 * chrome, not ledger data. A returning user on a fresh device is recognised by their pulled Drive data
 * (they won't look "new"), not by this flag.
 */
export async function loadOnboardingSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) != null;
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
}
