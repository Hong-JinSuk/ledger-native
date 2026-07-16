import type { User } from '@supabase/supabase-js';

/** created ≈ signed-in → the account was created and signed into in the same first-signup event. */
const SAME_EVENT_MS = 10_000;
/** ...AND that happened just now — guards against odd `last_sign_in_at` semantics across versions. */
const RECENTLY_CREATED_MS = 5 * 60_000;

/**
 * True when this session is the user's FIRST-EVER sign-in — the Supabase account was created at
 * essentially the same instant as this sign-in, and that instant is right now.
 *
 * `created_at` / `last_sign_in_at` are server-side timestamps, so the "same event" test has no client
 * clock skew. The extra "created just now" test (client clock) only ever biases toward safety: if a
 * clock is badly skewed we return false and fall back to the normal sync-gated onboarding — never a
 * false positive that would flash onboarding at a returning user.
 *
 * Used to skip waiting for the first Drive sync before showing onboarding: a brand-new account has
 * never used the app, so its Drive has no ledger file worth waiting for.
 */
export function isNewSignup(user: Pick<User, 'created_at' | 'last_sign_in_at'>, now: number): boolean {
  if (!user.created_at) return false;
  const created = new Date(user.created_at).getTime();
  if (Number.isNaN(created)) return false;
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : created;
  if (Number.isNaN(lastSignIn)) return false;

  const sameEvent = Math.abs(lastSignIn - created) < SAME_EVENT_MS;
  const recentlyCreated = now - created < RECENTLY_CREATED_MS;
  return sameEvent && recentlyCreated;
}
