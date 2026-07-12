import { LEDGER_SNAPSHOT_VERSION } from '@/constants/ledger';
import { nowIso } from '@/lib/id';
import {
  createLedgerFile,
  DriveAuthError,
  readLedgerFile,
  statLedgerFile,
  writeLedgerFile,
} from '@/lib/sync/drive-api';
import { mergeLedger } from '@/lib/sync/merge';
import { useAuthStore } from '@/store/auth-store';
import { useLedgerStore } from '@/store/ledger-store';
import { useSyncStore } from '@/store/sync-store';
import type { LedgerSnapshot } from '@/types/ledger';

/**
 * The single sync orchestrator (CLAUDE.md: Drive I/O + merge live in ONE service layer; screens only
 * ever touch local state). It reconciles local ↔ the user's Google Drive with two cost guards so the
 * frequent triggers (app-start, foreground, and now every edit-screen close) don't hammer the API:
 *
 *  - PULL is gated on the remote file's `modifiedTime`: if Drive hasn't changed since our last sync,
 *    the whole download is skipped (nothing new to merge).
 *  - PUSH is gated on a local "dirty" counter: if the ledger hasn't changed since our last upload,
 *    the write is skipped. A cancelled/no-op edit therefore costs zero uploads.
 *
 * Safety invariants:
 *  - Local is the source of truth. We only ever merge INTO it and re-persist; on any failure the
 *    local data is left exactly as it was and the next trigger retries.
 *  - Skipping the pull is safe against clobbering: we only skip it when `modifiedTime` proves the
 *    remote is unchanged, so a subsequent push can't overwrite an unseen remote edit.
 *  - Concurrent calls (app-start + foreground firing together) share one in-flight run.
 */

// --- Local change tracking (the dirty flag) -----------------------------------------------------
// A monotonic counter bumped whenever the persistable ledger content changes. Tracked via a store
// subscription so EVERY mutation path counts without threading a flag through each action. (Every
// action produces a fresh object for the slice it touches, so a reference check detects real edits.)
let localRev = 0;
useLedgerStore.subscribe((state, prev) => {
  if (
    state.records !== prev.records ||
    state.categories !== prev.categories ||
    state.settings !== prev.settings ||
    state.years !== prev.years ||
    state.yearMeta !== prev.yearMeta
  ) {
    localRev += 1;
  }
});

// --- Session sync memory (module-scoped) --------------------------------------------------------
// Resets on reload, which is fine: the first sync of a session always reconciles fully (remote
// modifiedTime ≠ null, and localRev ≠ lastPushedRev), so nothing is missed.
/** rev of the snapshot we last successfully pushed to Drive; `localRev !== lastPushedRev` ⇒ dirty. */
let lastPushedRev = -1;
/** Drive file's modifiedTime as of our last sync — lets us skip re-downloading an unchanged remote. */
let lastRemoteModifiedTime: string | null = null;

let inFlight: Promise<void> | null = null;

/** The current in-memory ledger as a snapshot — the newest local work / source of truth. */
function localSnapshot(): LedgerSnapshot {
  const { years, yearMeta, records, categories, settings } = useLedgerStore.getState();
  return { version: LEDGER_SNAPSHOT_VERSION, years, yearMeta, records, categories, settings };
}

/** One reconciliation pass. Returns true on success (used to decide whether to flush a mid-sync edit). */
async function run(): Promise<boolean> {
  const update = useSyncStore.getState().update;
  update({ status: 'syncing', error: null });
  try {
    // 1) Peek at the remote's metadata — one lightweight files.list, no download.
    const meta = await statLedgerFile();
    if (__DEV__) console.log('[sync] stat →', meta ? `found ${meta.id} @ ${meta.modifiedTime}` : 'NO FILE');

    // 2) PULL — only when the remote actually changed since we last saw it. An unchanged
    //    modifiedTime means Drive still holds exactly what we last reconciled, so the (potentially
    //    large) download is skipped entirely.
    if (meta && meta.modifiedTime !== lastRemoteModifiedTime) {
      const remoteSnap = await readLedgerFile(meta.id);
      if (__DEV__) console.log('[sync] PULL:', remoteSnap ? 'read OK → merging' : 'null/corrupt → skip merge');
      if (remoteSnap) {
        // applySyncedSnapshot re-merges against the CURRENT store, so edits made during the async
        // download still win and are never clobbered.
        const merged = mergeLedger(localSnapshot(), remoteSnap);
        useLedgerStore.getState().applySyncedSnapshot(merged);
      }
      lastRemoteModifiedTime = meta.modifiedTime;
    } else if (__DEV__) {
      console.log('[sync] pull skipped — meta?', !!meta, '| mt===lastSeen?', meta?.modifiedTime === lastRemoteModifiedTime);
    }

    // 3) PUSH — only when local has un-pushed changes (dirty), or the remote file doesn't exist yet.
    //    Capture the rev BEFORE the upload so an edit landing mid-write keeps us dirty for a re-flush.
    if (localRev !== lastPushedRev || !meta) {
      const revAtPush = localRev;
      const written = meta
        ? await writeLedgerFile(meta.id, localSnapshot())
        : await createLedgerFile(localSnapshot());
      if (__DEV__) {
        console.log('[sync] PUSH', meta ? 'overwrite' : 'CREATE NEW FILE', '→', written.id, '@', written.modifiedTime);
      }
      lastPushedRev = revAtPush;
      lastRemoteModifiedTime = written.modifiedTime; // our own write is now the known remote state
    } else if (__DEV__) {
      console.log('[sync] push skipped — not dirty (localRev', localRev, '=== lastPushedRev', lastPushedRev, ')');
    }

    update({ status: 'synced', lastSyncedAt: nowIso(), error: null });
    if (__DEV__) console.log('[sync] ✅ synced');
    return true;
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
    return false;
  }
}

/**
 * Trigger a full sync (pull-if-changed + push-if-dirty). Called on app start, on return to the
 * foreground, on the manual button, and after an edit screen closes. Coalesces concurrent callers
 * onto a single in-flight run; if an edit lands mid-sync, one extra run flushes it.
 */
export function syncNow(): Promise<void> {
  if (!inFlight) {
    inFlight = (async () => {
      const ok = await run();
      inFlight = null;
      // Edits that arrived while the run was in flight leave us dirty again → flush once more. Only
      // on success, so a failing sync doesn't hot-loop (the next trigger retries instead).
      if (ok && localRev !== lastPushedRev) void syncNow();
    })();
  }
  return inFlight;
}

/**
 * Write-end trigger (CLAUDE.md "작성 종료 시"): call when an edit screen / drawer closes. It pushes the
 * change up promptly — but ONLY if something actually changed, so opening and dismissing a drawer
 * with no edit costs zero API calls. Skips entirely when logged out (Drive would just reject).
 */
export function syncOnEditEnd(): void {
  if (localRev === lastPushedRev) return; // nothing new since the last push → don't touch the network
  if (!useAuthStore.getState().session) return;
  void syncNow();
}
