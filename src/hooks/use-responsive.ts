import { Platform, useWindowDimensions } from 'react-native';

/** Below this window width, web falls back to the mobile layout (bottom tabs + stacked cards). */
export const WIDE_BREAKPOINT = 768;

/**
 * True only on a wide web window. Native is always false (phones are single-width → mobile layout),
 * and a narrow browser window (≈ phone size) is also false, so web renders the mobile layout instead
 * of squeezing the desktop grid into a phone-width column. Re-evaluates on resize via
 * useWindowDimensions, so dragging the browser across the breakpoint swaps layouts live.
 */
export function useIsWideScreen(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}

/**
 * Width-only "tablet and up" check — true on ANY platform once the viewport is ≥ the breakpoint
 * (unlike useIsWideScreen, which is web-only). Drives the drawer surface: phones get the bottom
 * sheet, tablets/desktop get a centered modal. Re-evaluates on resize/rotation.
 */
export function useIsWideViewport(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}
