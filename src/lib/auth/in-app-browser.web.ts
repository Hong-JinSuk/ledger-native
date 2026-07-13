/**
 * Web implementation: detect known in-app browsers (WebViews) and bounce out to a real system browser.
 *
 * Google OAuth blocks embedded WebViews (`403: disallowed_useragent`). The common trigger in Korea is
 * opening a shared link inside KakaoTalk's in-app browser. We match a short allow-list of well-known
 * in-app browsers by User-Agent (kept conservative to avoid false-positives on real browsers), then use
 * each one's documented "open externally" escape hatch so the user can finish Google login in Safari/Chrome.
 */
export type InAppBrowser = 'kakaotalk' | 'naver' | 'line' | 'instagram' | 'facebook';

function userAgent(): string {
  const g = globalThis as { navigator?: { userAgent?: string } };
  return g.navigator?.userAgent?.toLowerCase() ?? '';
}

export function detectInAppBrowser(): InAppBrowser | null {
  const ua = userAgent();
  if (!ua) return null;
  if (ua.includes('kakaotalk')) return 'kakaotalk';
  if (ua.includes('naver(')) return 'naver'; // NAVER app UA: "... NAVER(inapp; search; ...)"
  if (ua.includes('line/')) return 'line';
  if (ua.includes('instagram')) return 'instagram';
  if (ua.includes('fbav') || ua.includes('fban')) return 'facebook';
  return null;
}

/**
 * Try to re-open the current page in the device's real browser (where Google login works). Returns true
 * if an escape was triggered; false when we can't force it (e.g. iOS Instagram/Facebook), so the caller
 * can fall back to manual "open in browser" guidance.
 */
export function openExternalBrowser(): boolean {
  const g = globalThis as {
    location?: { href: string };
    navigator?: { userAgent?: string };
  };
  const loc = g.location;
  if (!loc) return false;

  const url = loc.href;
  switch (detectInAppBrowser()) {
    case 'kakaotalk':
      // KakaoTalk scheme: re-open the URL in the device's default browser (iOS + Android).
      loc.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
      return true;
    case 'line':
      // Line: a query flag forces the system browser.
      loc.href = `${url}${url.includes('?') ? '&' : '?'}openExternalBrowser=1`;
      return true;
    default:
      // NAVER / Instagram / Facebook on Android: hand the URL to Chrome via an intent: URL.
      if (/android/i.test(g.navigator?.userAgent ?? '')) {
        loc.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        return true;
      }
      // iOS (non-KakaoTalk): no reliable programmatic escape → caller shows manual guidance.
      return false;
  }
}
