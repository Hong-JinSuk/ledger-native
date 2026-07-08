import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Palette } from '@/constants/palette';
import { useAuthStore } from '@/store/auth-store';

/**
 * Where the WEB OAuth redirect lands (<origin>/auth/callback?code=…). The supabase client
 * (detectSessionInUrl on web) auto-exchanges the code → the auth store gets a session → we bounce
 * home. On native this route is never reached (expo-web-browser captures the redirect inline).
 */
export default function AuthCallback() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session) router.replace('/');
  }, [session, router]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator color={Palette.ink} />
        <Text className="text-sm text-muted font-sans">로그인 중이에요…</Text>
      </View>
    </Screen>
  );
}
