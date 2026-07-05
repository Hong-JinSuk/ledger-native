import { Tabs } from 'expo-router';
import { BarChart2, BookOpen, Settings } from 'lucide-react-native';

import { FontFamily } from '@/constants/fonts';
import { Palette } from '@/constants/palette';

export default function TabsLayout() {
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
        name="index"
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
