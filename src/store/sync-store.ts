import { create } from 'zustand';

/** idle → syncing → synced | error. Drives the (soft, non-blocking) sync indicator in the UI. */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type SyncState = {
  status: SyncStatus;
  /** ISO-8601 of the last successful sync, or null. */
  lastSyncedAt: string | null;
  /** User-facing message when status === 'error'. */
  error: string | null;
  update: (partial: Partial<Pick<SyncState, 'status' | 'lastSyncedAt' | 'error'>>) => void;
};

/** Sync status only (the ledger data itself lives in useLedgerStore). Kept separate so a sync
 *  state change never re-renders the whole ledger tree. */
export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  error: null,
  update: (partial) => set(partial),
}));
