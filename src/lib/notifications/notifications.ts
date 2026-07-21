import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Single entry point for LOCAL notifications — every reminder in the app goes through here so no
 * screen ever touches expo-notifications directly (mirrors the sync layer in `src/lib/sync`).
 * Permission, the Android channel, and the app's tone live in one place; callers just say WHAT and
 * WHEN via {@link scheduleReminder}.
 *
 * Local/scheduled notifications work in Expo Go on SDK 54 (only REMOTE push needs a dev build), so
 * this is testable on-device today. Everything is scheduled on-device from the local snapshot — no
 * server — which keeps the "no ledger data on our backend" identity intact.
 */

const CHANNEL_ID = 'ledger-reminders';

// How a notification behaves when it lands while the app is FOREGROUNDED. SDK 54 replaced the old
// `shouldShowAlert` with `shouldShowBanner` + `shouldShowList` (all four fields required). Runs once
// on import — importing this module anywhere (we do it at boot) registers the handler early.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let channelReady = false;
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  // Android 8+ needs a channel for anything to show; 13+ needs it created before the permission
  // prompt. One calm "리마인더" channel is enough for every reminder type.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '리마인더',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Call once at boot (root layout). Sets up the Android channel; safe to call repeatedly (memoised). */
export async function initNotifications(): Promise<void> {
  await ensureChannel();
}

/**
 * Ensure we may post notifications. Called lazily by {@link scheduleReminder} — we ask at the moment a
 * reminder is first turned on, never cold at boot (iOS discourages context-less prompts). Returns
 * false when denied; callers then stay silent (감성 톤 — no scary error, local app still works).
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return next.granted;
}

/** When a reminder should fire. `now` = immediately (handy as a test ping). */
export type ReminderWhen =
  | { kind: 'now' }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'date'; date: Date };

export type Reminder = {
  /** Stable id so re-scheduling from a changed snapshot REPLACES instead of piling up duplicates
   *  (e.g. 'record-daily', `fixed:${fixedExpenseId}`). */
  id: string;
  title: string;
  body?: string;
  /** Optional payload read when the user taps the notification (e.g. a route to open). */
  data?: Record<string, unknown>;
  when: ReminderWhen;
};

/**
 * THE one function everything calls to post/schedule a local notification. Ensures permission + the
 * Android channel, replaces any existing notification with the same id, then schedules. Returns the
 * scheduled identifier, or null when permission is denied (caller does nothing — nothing surfaced).
 */
export async function scheduleReminder(reminder: Reminder): Promise<string | null> {
  if (!(await ensureNotificationPermission())) return null;
  await ensureChannel();

  // Replace-by-id: drop the previous copy so a re-schedule never leaves a stale duplicate behind.
  await cancelReminder(reminder.id);

  return Notifications.scheduleNotificationAsync({
    identifier: reminder.id,
    content: { title: reminder.title, body: reminder.body, data: reminder.data },
    trigger: toTrigger(reminder.when),
  });
}

/** Cancel a scheduled reminder by its stable id. No-op if it isn't scheduled. */
export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Cancel every scheduled reminder (e.g. when the user turns reminders off globally). */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** All currently-scheduled reminders — useful for reconciling against the snapshot. */
export async function listScheduledReminders(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

// SDK 54: `channelId` belongs on the trigger (not content); `null` fires immediately.
function toTrigger(when: ReminderWhen): Notifications.NotificationTriggerInput {
  switch (when.kind) {
    case 'now':
      return null;
    case 'daily':
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: when.hour,
        minute: when.minute,
        channelId: CHANNEL_ID,
      };
    case 'date':
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when.date,
        channelId: CHANNEL_ID,
      };
  }
}
