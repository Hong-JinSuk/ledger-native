import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily } from '@/constants/fonts';
import { Palette } from '@/constants/palette';

/**
 * Custom bottom tab bar for the mobile layout.
 *
 * react-navigation's default bar top-aligns its content (its button hardcodes
 * `justifyContent: 'flex-start'`), so giving it a roomier height left the icon+label shoved to the
 * top. We draw the bar ourselves instead: icon + uppercase tracked label, vertically centered, with
 * generous height and safe-area padding — matching the app's warm editorial caption style (the same
 * uppercase/tracked treatment as AppHeader subtitles and the web nav).
 */
export function MobileTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: Palette.paper,
        borderTopWidth: 1,
        borderTopColor: Palette.line,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12),
      }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const focused = state.index === index;
        const color = focused ? Palette.ink : Palette.muted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            className="flex-1 items-center justify-center gap-1.5 active:opacity-60">
            {options.tabBarIcon?.({ focused, color, size: 22 })}
            <Text
              style={{
                fontFamily: FontFamily.sansSemibold,
                fontSize: 10,
                letterSpacing: 1.5,
                color,
              }}>
              {label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
