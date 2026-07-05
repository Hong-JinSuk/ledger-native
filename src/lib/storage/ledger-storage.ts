import AsyncStorage from '@react-native-async-storage/async-storage';

import { LEDGER_STORAGE_KEY } from '@/constants/ledger';
import type { LedgerSnapshot } from '@/types/ledger';

/**
 * Persistence port for the ledger snapshot. Screens/store never talk to a storage backend
 * directly — they go through this interface, so the Google Drive backend (Phase 6) can slot in
 * behind the same contract without touching callers.
 */
export interface LedgerStorage {
  load(): Promise<LedgerSnapshot | null>;
  save(snapshot: LedgerSnapshot): Promise<void>;
  clear(): Promise<void>;
}

/** Local, always-available implementation. First-write on-device store (offline source of truth). */
export const asyncStorageLedger: LedgerStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LedgerSnapshot;
    } catch {
      // Corrupt payload: treat as empty rather than crashing; caller re-seeds.
      return null;
    }
  },
  async save(snapshot) {
    await AsyncStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(snapshot));
  },
  async clear() {
    await AsyncStorage.removeItem(LEDGER_STORAGE_KEY);
  },
};
