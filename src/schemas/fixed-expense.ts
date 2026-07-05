import { z } from 'zod';

/**
 * Validates the fixed-expense editor (Phase 4). A FixedExpense lives inside the Settings
 * document (not an independently-synced entity), so add/edit/delete rewrite the array.
 *
 * Fields are `.optional()` rather than `.default()` so the schema's input and output types
 * match — keeps the react-hook-form + zodResolver generics aligned (see transaction schema).
 */
export const fixedExpenseFormSchema = z.object({
  title: z.string().trim().min(1, '이름을 입력해주세요'),
  type: z.string().min(1, '유형을 선택해주세요'),
  amount: z.number().int().min(0),
  /** Day of month 1–31, or null when unspecified. */
  date: z.number().int().min(1).max(31).nullable(),
  note: z.string().optional(),
});

export type FixedExpenseFormValues = z.infer<typeof fixedExpenseFormSchema>;
