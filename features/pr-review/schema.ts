import { z } from 'zod';

export const PRReviewSchema = z.object({
  summary: z.string()
    .min(1, 'Summary is required'),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'info']),
    status: z.enum(['new', 'persisting']),
    description: z.string(),
  })).default([]),
  resolvedIssues: z.array(z.object({
    description: z.string(),
  })).default([]),
  approved: z.boolean().default(false),
});

export type PRReview = z.infer<typeof PRReviewSchema>;
