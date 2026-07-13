import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { FadeIn } from '@/components/fade-in';
import { GoogleLogo } from '@/components/google-logo';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { signInWithGoogle } from '@/lib/auth/auth';
import { detectInAppBrowser, openExternalBrowser } from '@/lib/auth/in-app-browser';
import type { InAppBrowser } from '@/lib/auth/in-app-browser';

/** Friendly names for the in-app browsers we can detect (used in the "open in browser" guidance). */
const IN_APP_LABEL: Record<InAppBrowser, string> = {
  kakaotalk: '카카오톡',
  naver: '네이버 앱',
  line: '라인',
  instagram: '인스타그램',
  facebook: '페이스북',
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Web only: Google OAuth is blocked inside in-app browsers (e.g. KakaoTalk → 403 disallowed_useragent).
  // Detect that context so we can send the user to a real browser instead of dead-ending on Google's page.
  const [inApp, setInApp] = useState<InAppBrowser | null>(null);

  const autoBounced = useRef(false);
  useEffect(() => {
    const detected = detectInAppBrowser();
    setInApp(detected);
    // In an in-app browser, immediately hand off to the real system browser — Google login can't run in
    // a WebView. Best-effort: if the WebView blocks the scheme, the button below is the fallback. Guarded
    // so it fires once (dev StrictMode double-invokes effects).
    if (detected && !autoBounced.current) {
      autoBounced.current = true;
      openExternalBrowser();
    }
  }, []);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // On success the auth store updates via onAuthStateChange → the gate swaps us into the tabs.
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} webMaxWidth={440}>
      <View className="flex-1 justify-between px-8 pb-10 pt-24">
        {/* Wordmark + warm invitation */}
        <View>
          <FadeIn>
            <Text className="text-6xl text-ink font-serif">Ledger</Text>
          </FadeIn>
          <FadeIn delay={120}>
            <Text className="mt-3 text-[11px] uppercase tracking-[3px] text-muted font-sans-semibold">
              Financial Journal
            </Text>
          </FadeIn>
          <FadeIn delay={260}>
            <Text className="mt-9 text-lg leading-8 text-ink/80 font-sans">
              숫자를 조금 더 다정하게.{'\n'}
              오늘 하루를 조용히 기록해요.
            </Text>
          </FadeIn>
        </View>

        {/* Sign in — or, inside an in-app browser, guidance to open a real browser */}
        <FadeIn delay={420}>
          {inApp ? (
            <View>
              <Text className="text-xl text-ink font-serif">브라우저로 이동 중이에요</Text>
              <Text className="mt-3 text-sm leading-6 text-ink/70 font-sans">
                {IN_APP_LABEL[inApp]} 안에서는 Google 로그인이 막혀 있어요.{'\n'}
                기본 브라우저로 자동으로 이동하고 있어요.{'\n'}
                열리지 않으면 아래 버튼을 눌러주세요.
              </Text>

              <Pressable
                onPress={() => openExternalBrowser()}
                className="mt-7 h-14 flex-row items-center justify-center rounded-full bg-ink px-6 active:opacity-80">
                <Text className="text-base text-paper font-sans-bold">브라우저로 열기</Text>
              </Pressable>

              <Text className="mt-5 text-center text-xs leading-5 text-muted font-sans">
                {"그래도 안 되면, 오른쪽 위 메뉴에서\n'다른 브라우저로 열기'를 눌러주세요."}
              </Text>
            </View>
          ) : (
            <View>
              {error ? (
                <Text className="mb-4 text-center text-sm leading-5 text-expense font-sans">
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={handleGoogle}
                disabled={loading}
                style={{ opacity: loading ? 0.65 : 1 }}
                className="h-14 flex-row items-center justify-center gap-3 rounded-full bg-ink px-6 active:opacity-80">
                {loading ? (
                  <ActivityIndicator color={Palette.paper} />
                ) : (
                  <>
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-white">
                      <GoogleLogo size={15} />
                    </View>
                    <Text className="text-base text-paper font-sans-bold">Google로 계속하기</Text>
                  </>
                )}
              </Pressable>

              <Text className="mt-5 text-center text-xs leading-5 text-muted font-sans">
                기록은 당신의 Google Drive에{'\n'}안전하게 보관돼요.
              </Text>
            </View>
          )}
        </FadeIn>
      </View>
    </Screen>
  );
}
