import { DRIVE_ACCESS_TOKEN_KEY, DRIVE_REFRESH_TOKEN_KEY } from '@/lib/auth/auth';
import { getSecret, setSecret } from '@/lib/auth/token-store';
import { supabase } from '@/lib/supabase';

/** The deployed Supabase Edge Function that exchanges a Google refresh token for a fresh access token. */
const TOKEN_REFRESH_FN = 'google-token-refresh';

/**
 * The currently stored Google access token, or null. It may be EXPIRED — callers don't check expiry
 * up front; they call Drive, and on a 401 refresh reactively via {@link refreshDriveAccessToken}.
 */
export async function getDriveAccessToken(): Promise<string | null> {
  return getSecret(DRIVE_ACCESS_TOKEN_KEY);
}

/**
 * Mint a fresh Google access token via the Edge Function (which holds the Google client secret —
 * see supabase/functions/google-token-refresh), store it, and return it.
 *
 * Google issues access tokens with ~1h validity and Supabase doesn't refresh provider tokens, so
 * this is what keeps Drive sync alive without a re-login. Returns null when we can't refresh — no
 * stored refresh token, or Google rejected it (revoked/expired) — and the caller then surfaces
 * "please sign in again".
 */
export async function refreshDriveAccessToken(): Promise<string | null> {
  const refreshToken = await getSecret(DRIVE_REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const { data, error } = await supabase.functions.invoke<{ access_token?: string }>(
    TOKEN_REFRESH_FN,
    { body: { refresh_token: refreshToken } },
  );
  if (error || !data?.access_token) {
    if (__DEV__) console.warn('[drive-auth] token refresh failed:', error?.message ?? data);
    return null;
  }

  await setSecret(DRIVE_ACCESS_TOKEN_KEY, data.access_token);
  return data.access_token;
}
