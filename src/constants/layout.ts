import { Platform, type ViewStyle } from 'react-native';

/**
 * Shared web layout metrics. On web we center page content to this max-width so it doesn't stretch
 * edge-to-edge on wide screens (native ignores it — phones are single-width). The top nav and each
 * Screen both align to this width so the header and body share the same left/right margins.
 */
export const WEB_MAX_WIDTH = 1200;

/**
 * Web-only content centering for a scroll view's `contentContainerStyle`. The ScrollView itself
 * stays full-window-width — so its scrollbar sits at the window's right edge like a normal web page —
 * while the content column is capped to {@link WEB_MAX_WIDTH} and centered (auto side margins).
 * Native returns `{}`: phones are single-width and scroll edge-to-edge.
 */
export const webScrollContent: ViewStyle =
  Platform.OS === 'web' ? { maxWidth: WEB_MAX_WIDTH, width: '100%', marginHorizontal: 'auto' } : {};
