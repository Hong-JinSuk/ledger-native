import { create } from 'zustand';

/**
 * idle → syncing → synced | error | unauthorized. Drives the (soft, non-blocking) sync indicator.
 * `unauthorized` = Drive permission was never granted (or revoked) — a calm "needs permission" state,
 * distinct from a transient `error`, so we don't show a scary "sync failed" to people who just skipped
 * the Drive consent.
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'unauthorized';

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
