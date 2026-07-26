import { z } from 'zod';

export const PRMetadataSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(72, 'Title must be under 72 characters'),
  summary: z.string()
    .min(1, 'Summary is required')
    .max(150, 'Summary must be under 150 characters'),
  changes: z.array(z.string())
    .min(1, 'At least one change bullet is required')
    .max(20, 'Changes must have at most 20 bullets'),
    fixes: z.array(z.string()).max(20).optional(),
});

export type PRMetadata = z.infer<typeof PRMetadataSchema>;
