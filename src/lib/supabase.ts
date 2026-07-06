import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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
      // token goes to expo-secure-store separately (Phase 5 auth flow).
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Native has no URL to parse a session from (that's a web-only OAuth concern).
      detectSessionInUrl: false,
    },
  },
);
