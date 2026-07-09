import type { LedgerStorage } from '@/lib/storage/ledger-storage';
import {
  createLedgerFile,
  findLedgerFileId,
  readLedgerFile,
  writeLedgerFile,
} from '@/lib/sync/drive-api';
import type { LedgerSnapshot } from '@/types/ledger';

/**
 * Google Drive as a {@link LedgerStorage} backend — the remote "확정된 원격 상태".
 *
 * It fulfils the exact same load/save/clear contract as the local AsyncStorage backend, so the sync
 * service can treat local and remote uniformly (see [[sync-service]]). The data lives in the user's
 * own Drive (drive.file scope), so we never hard-delete it from the app — `clear` is a deliberate
 * no-op.
 */
export const driveLedgerStorage: LedgerStorage = {
  async load(): Promise<LedgerSnapshot | null> {
    const id = await findLedgerFileId();
    return id ? readLedgerFile(id) : null;
  },

  async save(snapshot: LedgerSnapshot): Promise<void> {
    const id = await findLedgerFileId();
    if (id) await writeLedgerFile(id, snapshot);
    else await createLedgerFile(snapshot);
  },

  async clear(): Promise<void> {
    // The Drive file is the user's own data — the app never deletes it. Intentional no-op.
  },
};
