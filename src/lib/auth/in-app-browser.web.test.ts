import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectInAppBrowser, openExternalBrowser } from './in-app-browser.web';

/** Stub the browser globals the web implementation reads (UA + location). */
function setEnv(userAgent: string, href = 'https://ledger.example.com/login') {
  const location = { href };
  vi.stubGlobal('navigator', { userAgent });
  vi.stubGlobal('location', location);
  return location;
}

afterEach(() => vi.unstubAllGlobals());

// Representative real UA strings.
const KAKAO_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.0';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
const INSTAGRAM_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0 Android';

describe('detectInAppBrowser', () => {
  it('flags the KakaoTalk in-app browser', () => {
    setEnv(KAKAO_IOS);
    expect(detectInAppBrowser()).toBe('kakaotalk');
  });

  it('does NOT flag real mobile browsers (no false positives)', () => {
    setEnv(CHROME_ANDROID);
    expect(detectInAppBrowser()).toBeNull();
    setEnv(SAFARI_IOS);
    expect(detectInAppBrowser()).toBeNull();
  });
});

describe('openExternalBrowser', () => {
  it('bounces KakaoTalk out via its openExternal scheme (preserving the URL)', () => {
    const loc = setEnv(KAKAO_IOS, 'https://ledger.example.com/login?ref=kakao');
    expect(openExternalBrowser()).toBe(true);
    expect(loc.href).toBe(
      `kakaotalk://web/openExternal?url=${encodeURIComponent('https://ledger.example.com/login?ref=kakao')}`,
    );
  });

  it('hands an Android in-app browser to Chrome via an intent URL', () => {
    const loc = setEnv(INSTAGRAM_ANDROID);
    expect(openExternalBrowser()).toBe(true);
    expect(loc.href).toBe(
      'intent://ledger.example.com/login#Intent;scheme=https;package=com.android.chrome;end',
    );
  });

  it('leaves a real browser untouched (nothing to escape)', () => {
    const loc = setEnv(SAFARI_IOS);
    expect(openExternalBrowser()).toBe(false);
    expect(loc.href).toBe('https://ledger.example.com/login');
  });
});
