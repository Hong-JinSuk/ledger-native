/**
 * Warm, editorial categorical ramp for the Insights category donut (the "감성" tone — muted earthy
 * hues, not a loud dashboard wheel).
 *
 * ⚠️ ORDER IS SEMANTIC, not cosmetic. Colours are assigned in this fixed order (largest slice → slot 1)
 * and NEVER cycled: a 7th+ category folds into "그 외" ({@link CHART_OTHER_COLOR}). The order was chosen
 * to maximise adjacent-slice separation for colour-vision-deficient readers — validated with the dataviz
 * checker (light surface #FCFBF7): worst adjacent CVD ΔE 29.4, all in-band, all ≥3:1 contrast. If you
 * edit a hue, re-run the validator and keep the best ordering; don't reorder casually.
 */
export const CATEGORY_CHART_COLORS = [
  '#C15F3C', // terracotta
  '#0E8C7E', // teal
  '#B88A22', // ochre
  '#4374B2', // dusty blue
  '#7E8B3E', // olive
  '#99507F', // plum
] as const;

/** Neutral taupe for the folded "그 외" slice — recedes so it never competes with a real category. */
export const CHART_OTHER_COLOR = '#8C887D';

/** Named category slices shown before the rest fold into "그 외" (= the number of ramp colours). */
export const MAX_CATEGORY_SLICES = CATEGORY_CHART_COLORS.length;
