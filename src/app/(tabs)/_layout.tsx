import { Tabs } from 'expo-router';
import { BarChart2, BookOpen, Settings } from 'lucide-react-native';
import { View } from 'react-native';

import { MobileTabBar } from '@/components/mobile-tab-bar';
import { OnboardingGate } from '@/components/onboarding-welcome';
import { WebTopNav } from '@/components/web-top-nav';
import { Palette } from '@/constants/palette';
import { useIsWideScreen } from '@/hooks/use-responsive';

export default function TabsLayout() {
  // Wide web → a desktop-style top nav bar (bottom bar hidden; WebTopNav drives navigation). Native
  // OR a narrow web window → the mobile bottom tabs, so shrinking the browser to phone width shows
  // the mobile layout instead of the squeezed desktop one. The tab navigator is always mounted (it
  // preserves screen state); only the nav chrome swaps.
  const isWide = useIsWideScreen();
  return (
    <View style={{ flex: 1, backgroundColor: Palette.paper }}>
      {isWide && <WebTopNav />}
      <Tabs
        // Wide web hides the bar entirely (WebTopNav drives nav). Otherwise our own tab bar — the
        // default one top-aligns content, so a roomier bar looked shoved-up (see MobileTabBar).
        tabBar={isWide ? () => null : (props) => <MobileTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Palette.paper },
        }}>
        <Tabs.Screen
          name="(journal)"
          options={{
            title: 'Journal',
            tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: 'Insights',
            tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
          }}
        />
      </Tabs>

      {/* First-run welcome overlay. Self-gates (only shows for a brand-new account after the first
          sync settles); renders null otherwise. Mounted here so it's authed-only and covers all tabs. */}
      <OnboardingGate />
    </View>
  );
}
