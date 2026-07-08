import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { deleteSecret, setSecret } from '@/lib/auth/token-store';
import { supabase } from '@/lib/supabase';

// Required on WEB to dismiss the OAuth popup and finish the session. Harmless no-op on native.
WebBrowser.maybeCompleteAuthSession();

/**
 * Google login is the ONLY auth method — Drive access is mandatory (that's where the ledger data
 * lives). We ask for identity + `drive.file` (app-created files only = least privilege for our
 * single data file).
 */
const GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';

// 🔴 SECRET-ish: these are the Google tokens that unlock the user's Drive. Stored via token-store
// (secure-store on native). The refresh token is the one that matters long-term.
export const DRIVE_ACCESS_TOKEN_KEY = 'google_provider_token';
export const DRIVE_REFRESH_TOKEN_KEY = 'google_provider_refresh_token';

/**
 * Where Google → Supabase → the app lands back.
 *
 * Native (Expo Go AND dev/standalone) uses a FIXED `myapp://auth/callback` — NOT makeRedirectUri().
 * In Expo Go makeRedirectUri() returns `exp://<LAN-IP>:8081/--/auth/callback`, whose IP changes per
 * network (hotspot → 172.20.10.x, other Wi-Fi → something else). Supabase's redirect allow-list
 * matched that long IP+port+`/--/` exp URL unreliably, so it fell back to its Site URL (localhost)
 * and the browser dead-ended on the phone. A fixed scheme URL fixes both ends:
 *   • Supabase matches `myapp://**` every time (no IP/port/`/--/`), and
 *   • iOS ASWebAuthenticationSession intercepts it *by scheme* — in-process, so it works even in
 *     Expo Go where `myapp://` isn't OS-registered. (Also correct for a dev/standalone build.)
 * Web keeps the origin-based redirect (needs `http://localhost:8081/**` allow-listed in dev).
 */
export const redirectTo =
  Platform.OS === 'web'
    ? makeRedirectUri({ scheme: 'myapp', path: 'auth/callback' })
    : 'myapp://auth/callback';

if (__DEV__) {
  // Dev-only: prints the exact redirect URL (also shown on the login screen).
  console.log('[auth] redirectTo =', redirectTo);
}

/**
 * Kick off Google OAuth. On success the Supabase session lands via onAuthStateChange (which the
 * auth store listens to), so this resolves with no value — callers just await + catch errors.
 */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: GOOGLE_SCOPES,
      // Native: WE open the browser (below). Web: let supabase redirect the whole page.
      skipBrowserRedirect: Platform.OS !== 'web',
      queryParams: {
        access_type: 'offline', // → Google issues a refresh token…
        prompt: 'consent', // …and returns it on EVERY sign-in, not just the first
      },
    },
  });
  if (error) throw error;

  // Web: the page already navigated to Google; detectSessionInUrl handles the return, and the auth
  // store captures the provider tokens on SIGNED_IN. Nothing more to do here.
  if (Platform.OS === 'web') return;

  if (!data?.url) throw new Error('로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // user closed/canceled — not an error, just abort

  // PKCE: the redirect carries `?code=…`. Exchange it (code_verifier is read from AsyncStorage).
  const { queryParams } = Linking.parse(result.url);
  const authError = queryParams?.error_description ?? queryParams?.error;
  if (authError) throw new Error(String(authError));

  const code = typeof queryParams?.code === 'string' ? queryParams.code : undefined;
  if (!code) throw new Error('인증 코드를 받지 못했어요. 다시 시도해주세요.');

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;

  // Google's provider tokens ride ONLY on this fresh session — Supabase neither persists nor
  // refreshes them, and they vanish from getSession() after ~1h. Grab them right now.
  await captureDriveTokens(
    sessionData.session?.provider_token,
    sessionData.session?.provider_refresh_token,
  );
}

/** Persist the Google Drive tokens (refresh token = the durable key to the user's Drive). */
export async function captureDriveTokens(
  accessToken?: string | null,
  refreshToken?: string | null,
): Promise<void> {
  if (accessToken) await setSecret(DRIVE_ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) await setSecret(DRIVE_REFRESH_TOKEN_KEY, refreshToken);
}

/** Sign out of Supabase and wipe the stored Drive tokens. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await deleteSecret(DRIVE_ACCESS_TOKEN_KEY);
  await deleteSecret(DRIVE_REFRESH_TOKEN_KEY);
}
