import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { FadeIn } from '@/components/fade-in';
import { GoogleLogo } from '@/components/google-logo';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { signInWithGoogle } from '@/lib/auth/auth';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        {/* Sign in */}
        <FadeIn delay={420}>
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
        </FadeIn>
      </View>
    </Screen>
  );
}
