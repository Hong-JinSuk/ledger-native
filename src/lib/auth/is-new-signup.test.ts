import { describe, expect, it } from 'vitest';

import { isNewSignup } from '@/lib/auth/is-new-signup';

const SIGNUP = '2026-07-16T00:00:00.000Z';
const AT = (iso: string, plusMs = 0) => new Date(iso).getTime() + plusMs;

describe('isNewSignup', () => {
  it('true on the first sign-in — created ≈ signed-in, and it just happened', () => {
    expect(isNewSignup({ created_at: SIGNUP, last_sign_in_at: SIGNUP }, AT(SIGNUP, 1500))).toBe(true);
    // A couple of seconds between account creation and the sign-in record still counts.
    expect(isNewSignup({ created_at: SIGNUP, last_sign_in_at: AT_ISO(SIGNUP, 3000) }, AT(SIGNUP, 3500))).toBe(true);
  });

  it('true when last_sign_in_at is missing (falls back to created_at)', () => {
    expect(isNewSignup({ created_at: SIGNUP, last_sign_in_at: undefined }, AT(SIGNUP, 800))).toBe(true);
  });

  it('false for a returning user — signs in long after account creation', () => {
    const created = '2026-01-01T00:00:00.000Z';
    const now = AT('2026-07-16T09:00:00.000Z');
    expect(isNewSignup({ created_at: created, last_sign_in_at: '2026-07-16T09:00:00.000Z' }, now)).toBe(false);
  });

  it('false for a returning user even if last_sign_in_at ≈ created_at (odd semantics) — not created recently', () => {
    const created = '2026-01-01T00:00:00.000Z';
    // sameEvent would be true, but the account was created 6+ months ago → recentlyCreated is false.
    expect(isNewSignup({ created_at: created, last_sign_in_at: created }, AT('2026-07-16T00:00:00.000Z'))).toBe(false);
  });

  it('false when created_at is missing or unparseable', () => {
    expect(isNewSignup({ created_at: undefined as unknown as string, last_sign_in_at: SIGNUP }, AT(SIGNUP))).toBe(false);
    expect(isNewSignup({ created_at: 'not-a-date', last_sign_in_at: SIGNUP }, AT(SIGNUP))).toBe(false);
  });
});

/** ISO string `ms` after `iso` — for building last_sign_in_at a few seconds past created_at. */
function AT_ISO(iso: string, plusMs: number): string {
  return new Date(new Date(iso).getTime() + plusMs).toISOString();
}
