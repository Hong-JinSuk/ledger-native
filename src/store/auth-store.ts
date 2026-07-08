import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { captureDriveTokens } from '@/lib/auth/auth';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** True until the persisted session has been read once (so we don't flash the login screen). */
  initializing: boolean;
  /** Wire up auth: load the stored session, then subscribe. Returns an unsubscribe cleanup. */
  initialize: () => () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initializing: true,

  initialize: () => {
    // 1) Load whatever session is already persisted (fast — reads AsyncStorage).
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, initializing: false });
    });

    // 2) React to every future change (sign-in, sign-out, token refresh).
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      set({ session });
      // Google's provider tokens are present ONLY on the initial SIGNED_IN (this is the web
      // full-page-redirect capture point; native also re-captures here harmlessly). Later
      // TOKEN_REFRESHED events have no provider token, so guard on their presence.
      if (event === 'SIGNED_IN' && session?.provider_refresh_token) {
        void captureDriveTokens(session.provider_token, session.provider_refresh_token);
      }
    });

    return () => data.subscription.unsubscribe();
  },
}));
