/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Warm / editorial palette ported from the web app (the "감성" tone).
      colors: {
        paper: '#FCFBF7', // app background (cream)
        ink: '#1A1A1A', // primary text, dark buttons
        muted: '#8C887D', // secondary text, uppercase labels
        line: '#E8E4D9', // borders, dividers, chip bg
        fill: '#F5F3ED', // input bg, hover fill, overlay tint
        // Semantic accents (by transaction type)
        income: '#16A34A', // green-600 (수입)
        expense: '#DC2626', // red-600 (지출)
        transfer: '#3B82F6', // blue-500 (이체)
        accent: '#4F46E5', // indigo-600 (selection / active)
      },
      // RN needs one concrete loaded font per family (no web-style fallback cascade).
      // Names must match the @expo-google-fonts exports loaded via useFonts in the root layout.
      fontFamily: {
        serif: ['PlayfairDisplay_400Regular_Italic'], // signature emotional headings (italic)
        'serif-medium': ['PlayfairDisplay_500Medium'],
        'serif-semibold': ['PlayfairDisplay_600SemiBold'],
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        mono: ['JetBrainsMono_400Regular'], // money / numbers
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-semibold': ['JetBrainsMono_600SemiBold'],
      },
    },
  },
  plugins: [],
};
