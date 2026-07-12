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
 *
 * Pass `webFull` for scrolling screens that want the scrollbar at the window's right edge (a normal
 * web page): the Screen stays full-width and the screen's own ScrollView centers its content column
 * via {@link webScrollContent}. Without it, the max-width wrapper would pin the scrollbar to the
 * centered column's edge instead.
 */
export function Screen({
  children,
  edges = ['top'],
  webMaxWidth = WEB_MAX_WIDTH,
  webFull = false,
}: {
  children: ReactNode;
  edges?: Edge[];
  webMaxWidth?: number;
  webFull?: boolean;
}) {
  const constrain = Platform.OS === 'web' && !webFull;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.paper }} edges={edges}>
      {constrain ? (
        <View style={{ flex: 1, width: '100%', maxWidth: webMaxWidth, alignSelf: 'center' }}>
          {children}
        </View>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
