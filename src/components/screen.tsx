import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WEB_MAX_WIDTH } from '@/constants/layout';
import { Palette } from '@/constants/palette';

type Edge = 'top' | 'right' | 'bottom' | 'left';

/**
 * Warm paper background + safe-area wrapper used by every screen.
 *
 * On web, content is centered to a max-width so it doesn't stretch across a wide desktop window
 * (gives comfortable left/right margins). Native renders full-width — phones are single-width.
 * Pass `webMaxWidth` to narrow specific screens (e.g. the login form).
 */
export function Screen({
  children,
  edges = ['top'],
  webMaxWidth = WEB_MAX_WIDTH,
}: {
  children: ReactNode;
  edges?: Edge[];
  webMaxWidth?: number;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.paper }} edges={edges}>
      {Platform.OS === 'web' ? (
        <View style={{ flex: 1, width: '100%', maxWidth: webMaxWidth, alignSelf: 'center' }}>
          {children}
        </View>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
