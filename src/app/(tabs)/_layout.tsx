import { Tabs } from 'expo-router';
import { BarChart2, BookOpen, Settings } from 'lucide-react-native';
import { Platform, View } from 'react-native';

import { FontFamily } from '@/constants/fonts';
import { Palette } from '@/constants/palette';
import { WebTopNav } from '@/components/web-top-nav';

export default function TabsLayout() {
  // Web: a desktop-style top nav bar over the tab screens (bottom bar hidden). The tab navigator is
  // kept for state preservation; WebTopNav drives navigation. Native path below is untouched.
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.paper }}>
        <WebTopNav />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
            sceneStyle: { backgroundColor: Palette.paper },
          }}>
          <Tabs.Screen name="(journal)" />
          <Tabs.Screen name="insights" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Palette.ink,
        tabBarInactiveTintColor: Palette.muted,
        sceneStyle: { backgroundColor: Palette.paper },
        tabBarStyle: {
          backgroundColor: Palette.paper,
          borderTopColor: Palette.line,
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.sansSemibold,
          fontSize: 11,
          letterSpacing: 0.5,
        },
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
  );
}
