import { LEDGER_SNAPSHOT_VERSION } from '@/constants/ledger';
import { nowIso } from '@/lib/id';
import { DriveAuthError } from '@/lib/sync/drive-api';
import { driveLedgerStorage } from '@/lib/sync/drive-storage';
import { mergeLedger } from '@/lib/sync/merge';
import { useLedgerStore } from '@/store/ledger-store';
import { useSyncStore } from '@/store/sync-store';
import type { LedgerSnapshot } from '@/types/ledger';

/**
 * The single sync orchestrator (CLAUDE.md: Drive I/O + merge live in ONE service layer; screens
 * only ever touch local state). It pulls the Drive snapshot, merges it into local (local wins true
 * conflicts, deletions win — see [[merge]]), then writes the merged result to BOTH sides so they
 * match.
 *
 * Safety invariants:
 *  - Local is the source of truth. We only ever merge INTO it and re-persist; on any failure the
 *    local data is left exactly as it was and the next trigger retries.
 *  - Concurrent calls (app-start + foreground firing together) share one in-flight run.
 */

const remote = driveLedgerStorage;

let inFlight: Promise<void> | null = null;

/** The current in-memory ledger as a snapshot — the newest local work / source of truth. */
function localSnapshot(): LedgerSnapshot {
  const { years, records, categories, settings } = useLedgerStore.getState();
  return { version: LEDGER_SNAPSHOT_VERSION, years, records, categories, settings };
}

async function run(): Promise<void> {
  const update = useSyncStore.getState().update;
  update({ status: 'syncing', error: null });
  try {
    const local = localSnapshot();
    const remoteSnap = await remote.load();

    if (remoteSnap) {
      // Merge Drive → local. applySyncedSnapshot re-merges against the CURRENT store so any edits
      // made during the (async) pull still win and are never clobbered.
      const merged = mergeLedger(local, remoteSnap);
      useLedgerStore.getState().applySyncedSnapshot(merged);
    }

    // Push the freshest local (post-merge, including concurrent edits) up to Drive. A missing remote
    // file is created here; an existing one is overwritten atomically.
    await remote.save(localSnapshot());

    update({ status: 'synced', lastSyncedAt: nowIso(), error: null });
  } catch (err) {
    const message =
      err instanceof DriveAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : '동기화에 실패했어요. 잠시 후 다시 시도할게요.';
    // Local data is untouched — surface softly and let the next trigger retry.
    useSyncStore.getState().update({ status: 'error', error: message });
    if (__DEV__) console.warn('[sync] failed:', err);
  }
}

/**
 * Trigger a sync. Called on app start, on return to foreground, and after finishing an edit.
 * Coalesces concurrent callers onto a single in-flight run.
 */
export function syncNow(): Promise<void> {
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
