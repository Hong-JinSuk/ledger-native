/**
 * In-app browser (WebView) detection + escape — WEB CONCERN ONLY.
 *
 * Google OAuth rejects embedded WebViews with `403: disallowed_useragent`, and apps like KakaoTalk open
 * shared links in exactly such a WebView. On web we detect that context and bounce the user out to a real
 * system browser, where Google login is allowed. Native builds authenticate through the secure system
 * browser already (expo-web-browser / ASWebAuthenticationSession), so they never hit this — hence this
 * no-op stub. The real logic lives in `in-app-browser.web.ts` (Metro picks it on web).
 */
export type InAppBrowser = 'kakaotalk' | 'naver' | 'line' | 'instagram' | 'facebook';

/** Native: never an in-app browser. */
export function detectInAppBrowser(): InAppBrowser | null {
  return null;
}

/** Native: nothing to escape. */
export function openExternalBrowser(): boolean {
  return false;
}
