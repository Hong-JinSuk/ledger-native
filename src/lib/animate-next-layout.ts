import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Android on the old architecture needs this opt-in for LayoutAnimation; it's a harmless no-op on
// Fabric / iOS. Guarded because the method is absent on some setups.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Gently animate the NEXT layout change (list add/remove, row expand/collapse) with one shared
 * preset, so add/remove motion feels consistent instead of hard-popping — part of the app's soft
 * "감성" motion. Call it immediately before the state update that changes layout. Degrades to instant
 * on react-native-web (LayoutAnimation is a no-op there), so it's safe to call on every platform.
 */
export function animateNextLayout(): void {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}
