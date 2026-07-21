import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
// 한글 헤딩용 산세리프. Playfair(라틴)엔 한글이 없어 시스템 폴백으로 딱딱해지던 걸, Inter/JOURNAL 라벨과
// 결이 맞는 정통 한글 산세리프로 교체한다. 웨이트 600은 JOURNAL 라벨(Inter_600SemiBold)과 동일.
import { NotoSansKR_600SemiBold } from '@expo-google-fonts/noto-sans-kr';

/**
 * Fonts loaded at startup via `useFonts` in the root layout.
 * Keys here are the font family names referenced by NativeWind (tailwind.config.js)
 * and by `FontFamily` below — keep all three in sync.
 */
export const FONTS_TO_LOAD = {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  NotoSansKR_600SemiBold,
};

/**
 * Font family names for use OUTSIDE NativeWind className (e.g. navigation options,
 * dynamic styles). Inside components prefer `font-serif` / `font-sans` / `font-mono`.
 */
export const FontFamily = {
  serif: 'PlayfairDisplay_400Regular_Italic', // signature emotional headings — LATIN only (no Hangul)
  serifMedium: 'PlayfairDisplay_500Medium',
  serifSemibold: 'PlayfairDisplay_600SemiBold',
  headingKo: 'NotoSansKR_600SemiBold', // Hangul headings — paired with the Latin serif in AppHeader
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular', // money / numbers
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;
