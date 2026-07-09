import { DRIVE_ACCESS_TOKEN_KEY } from '@/lib/auth/auth';
import { getSecret } from '@/lib/auth/token-store';

/**
 * Supplies a Google access token for Drive REST calls (the single seam the rest of the sync layer
 * depends on).
 *
 * Phase 6a (now): returns the `provider_token` captured at login. Google issues it with ~1h of
 * validity and Supabase does NOT refresh provider tokens — so once it expires, Drive calls 401 and
 * the sync fails softly, to be retried on the next trigger (local data is never at risk).
 *
 * Phase 6b (TODO): when the token is missing/expired/401, exchange the stored
 * `provider_refresh_token` for a fresh access token via a Supabase Edge Function. The Google client
 * secret required for that exchange must live server-side only — never in the app bundle. Wiring it
 * here keeps every caller (drive-api → drive-storage → sync-service) unchanged.
 */
export async function getDriveAccessToken(): Promise<string | null> {
  return getSecret(DRIVE_ACCESS_TOKEN_KEY);
}
