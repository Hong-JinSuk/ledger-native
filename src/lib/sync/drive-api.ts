import { getDriveAccessToken } from '@/lib/sync/drive-auth';
import type { LedgerSnapshot } from '@/types/ledger';

/**
 * Thin Google Drive REST v3 client for the single ledger data file.
 *
 * NOTE ON fetch: Google Drive is a foreign API with its own response shapes, explicitly outside our
 * server's response envelope (see CLAUDE.md "API 응답 표준"). This project has no shared axios
 * instance, so Drive calls use `fetch` directly through the small authed `driveFetch` wrapper below.
 *
 * Scope is `drive.file`, so `files.list` only ever sees files THIS app created — the ledger file
 * lives in the user's own Drive and nothing else is visible to us (least privilege).
 */

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const MULTIPART_BOUNDARY = 'ledger_sync_multipart_boundary';

/** The app's single data file in the user's Drive. */
export const LEDGER_FILE_NAME = 'ledger.json';

/** Thrown when Drive rejects the token (401/403). This is the seam for Phase 6b token refresh. */
export class DriveAuthError extends Error {
  constructor(message = '구글 드라이브 접근 권한이 만료됐어요. 다시 로그인해주세요.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

/** Authed fetch to a Google API. Adds the Bearer token and normalizes auth / HTTP errors. */
async function driveFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getDriveAccessToken();
  if (!token) throw new DriveAuthError('구글 인증이 필요해요. 다시 로그인해주세요.');

  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) throw new DriveAuthError();
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Drive ${res.status}: ${detail}`);
  }
  return res;
}

/** Find the ledger file's id, or null if the app hasn't created it yet. */
export async function findLedgerFileId(): Promise<string | null> {
  const q = encodeURIComponent(`name = '${LEDGER_FILE_NAME}' and trashed = false`);
  const res = await driveFetch(
    `${DRIVE_FILES}?q=${q}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`,
  );
  const json = (await res.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id ?? null;
}

/** Read + parse the ledger snapshot from a Drive file (null if the remote JSON is corrupt). */
export async function readLedgerFile(fileId: string): Promise<LedgerSnapshot | null> {
  const res = await driveFetch(`${DRIVE_FILES}/${fileId}?alt=media`);
  const text = await res.text();
  try {
    return JSON.parse(text) as LedgerSnapshot;
  } catch {
    // Corrupt remote → treat as "no remote"; the caller re-uploads the good local copy.
    return null;
  }
}

/** Create the ledger file (multipart: metadata + JSON body). Returns the new file id. */
export async function createLedgerFile(snapshot: LedgerSnapshot): Promise<string> {
  const body =
    `--${MULTIPART_BOUNDARY}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify({ name: LEDGER_FILE_NAME, mimeType: 'application/json' })}\r\n` +
    `--${MULTIPART_BOUNDARY}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(snapshot)}\r\n` +
    `--${MULTIPART_BOUNDARY}--`;

  const res = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}` },
    body,
  });
  const json = (await res.json()) as { id: string };
  return json.id;
}

/**
 * Overwrite a Drive file's content with the snapshot. A single media PATCH replaces the whole
 * object in one request, so there's no partial-write window (Drive handles the atomicity of the
 * object swap) — no temp-file dance needed.
 */
export async function writeLedgerFile(fileId: string, snapshot: LedgerSnapshot): Promise<void> {
  await driveFetch(`${DRIVE_UPLOAD}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
}
