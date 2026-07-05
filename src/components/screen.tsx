import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/palette';

type Edge = 'top' | 'right' | 'bottom' | 'left';

/** Warm paper background + safe-area wrapper used by every screen. */
export function Screen({ children, edges = ['top'] }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.paper }} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
