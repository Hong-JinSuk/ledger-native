import { Platform } from 'react-native';

import { toast } from '@/components/toast';
import { scheduleReminder } from '@/lib/notifications/notifications';

/**
 * Surfaced after Drive sync fails auth (401/403) MAX_AUTH_RETRIES times in a row (see sync-service).
 * The local ledger is never touched by a failed sync, so the copy REASSURES first, then asks for a
 * re-login — the one action that actually re-grants Drive access.
 *
 * Cross-platform by design (web + mobile 둘 다):
 *  - Web → the in-app {@link toast} (our sonner-shaped toast; already root-mounted, works on
 *    react-native-web where expo-notifications does NOT).
 *  - Native → an OS local notification so a backgrounded user still sees it.
 * Same message either way; callers just `void alertSyncReauthNeeded()`.
 */
const TITLE = '동기화 오류가 발생했어요';
const BODY = '로그아웃 후 다시 로그인해 주세요. 지금까지 작성한 내용은 안전하게 저장돼 있으니 안심하세요.';

export async function alertSyncReauthNeeded(): Promise<void> {
  if (Platform.OS === 'web') {
    // Longer than the default error toast (3.8s) — this asks the user to act, so give them time to read.
    toast.error(TITLE, { description: BODY, duration: 8000 });
    return;
  }
  await scheduleReminder({ id: 'sync-reauth', title: TITLE, body: BODY, when: { kind: 'now' } });
}
