import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase client — holds the USER account/profile + auth session only.
 * Ledger data lives in the user's Google Drive (Phase 6), never here.
 *
 * The URL + anon key are PUBLIC client keys (safe to ship). Set them in `.env`:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
 */
// Static access (not process.env[name]) so Expo inlines the values at build time.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example → .env, fill them in, then restart with `npx expo start --clear`.',
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Session persists in AsyncStorage (app-sandboxed). The sensitive Google Drive refresh
      // token goes to expo-secure-store separately (see src/lib/auth/auth.ts).
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // PKCE (not the supabase-js default of 'implicit'): more secure on native, and the redirect
      // comes back with a `?code=` we exchange ourselves. AsyncStorage also holds the code_verifier
      // between signInWithOAuth() and exchangeCodeForSession().
      flowType: 'pkce',
      // Web-only: let supabase auto-exchange the `?code=` in the page URL on return. On native we
      // capture the redirect via expo-web-browser and exchange the code manually, so keep it off.
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);
