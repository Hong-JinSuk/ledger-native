import { z } from 'zod';

export const transactionTypeSchema = z.enum(['수입', '지출', '이체']);

/**
 * Validates the user-editable fields of the record drawer (Phase 3).
 * year/month are supplied by the screen context, not the form.
 */
export const transactionFormSchema = z.object({
  type: transactionTypeSchema,
  amount: z.number().int().min(0),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  merchant: z.string().optional(),
  day: z.number().int().min(1).max(31).nullable(),
  // optional (not .default) so the schema's input and output types match — keeps the
  // react-hook-form + zodResolver generics aligned. Callers coalesce to '' where needed.
  note: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
