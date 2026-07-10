import { Tabs } from 'expo-router';
import { BarChart2, BookOpen, Settings } from 'lucide-react-native';
import { View } from 'react-native';

import { WebTopNav } from '@/components/web-top-nav';
import { FontFamily } from '@/constants/fonts';
import { Palette } from '@/constants/palette';
import { useIsWideScreen } from '@/hooks/use-responsive';

export default function TabsLayout() {
  // Wide web → a desktop-style top nav bar (bottom bar hidden; WebTopNav drives navigation). Native
  // OR a narrow web window → the mobile bottom tabs, so shrinking the browser to phone width shows
  // the mobile layout instead of the squeezed desktop one. The tab navigator is always mounted (it
  // preserves screen state); only the nav chrome swaps.
  const isWide = useIsWideScreen();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Palette.paper,
      }}
    >
      {isWide && <WebTopNav />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Palette.ink,
          tabBarInactiveTintColor: Palette.muted,
          sceneStyle: { backgroundColor: Palette.paper },
          tabBarStyle: isWide
            ? { display: 'none' }
            : { backgroundColor: Palette.paper, borderTopColor: Palette.line },
          // Uppercase + tracked labels to match the app's caption style (AppHeader subtitle, section
          // headers, the web nav pills) — reads cleaner than title-case at this size, too.
          tabBarLabelStyle: {
            fontFamily: FontFamily.sansSemibold,
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tabs.Screen
          name="(journal)"
          options={{
            title: 'Journal',
            tabBarIcon: ({ color, size }) => (
              <BookOpen color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: 'Insights',
            tabBarIcon: ({ color, size }) => (
              <BarChart2 color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Settings color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
