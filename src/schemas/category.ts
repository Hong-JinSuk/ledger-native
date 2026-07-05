import { z } from 'zod';

import { transactionTypeSchema } from '@/schemas/transaction';

/** Validates the category editor form (Phase 4 — category CRUD the web never wired up). */
export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요'),
  icon: z.string().min(1, '아이콘을 선택해주세요'),
  type: transactionTypeSchema,
  // required (not .default) so input/output types match — keeps RHF + zodResolver generics
  // aligned. The drawer seeds ['기타'] for new categories and coalesces empty → ['기타'] on save.
  subcategories: z.array(z.string()),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
