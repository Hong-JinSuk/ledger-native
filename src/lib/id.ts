import * as Crypto from 'expo-crypto';

/**
 * Device-generated UUID for new entities. Must be device-side (never server-issued) so items
 * created offline still get a stable primary key for the Drive merge. Isolates the expo-crypto
 * dependency so pure logic (selectors/merge) stays RN-free and unit-testable.
 */
export function newId(): string {
  return Crypto.randomUUID();
}

/** Current time as an ISO-8601 string (the format stored in createdAt/updatedAt). */
export function nowIso(): string {
  return new Date().toISOString();
}
