/**
 * Warm / editorial palette ported from the web app (the "감성" tone).
 * Mirror of the `colors` block in tailwind.config.js — keep both in sync.
 * Use NativeWind classes (bg-paper, text-ink, …) in components; use this
 * object only where className can't reach (StatusBar, navigation options, dynamic styles).
 */
export const Palette = {
  paper: '#FCFBF7', // app background (cream)
  ink: '#1A1A1A', // primary text, dark buttons
  muted: '#8C887D', // secondary text, uppercase labels
  line: '#E8E4D9', // borders, dividers, chip bg
  fill: '#F5F3ED', // input bg, hover fill, overlay tint
  income: '#16A34A', // green-600 (수입)
  expense: '#DC2626', // red-600 (지출)
  transfer: '#3B82F6', // blue-500 (이체)
  accent: '#4F46E5', // indigo-600 (selection / active)
} as const;

export type PaletteColor = keyof typeof Palette;
