import { z } from 'zod';

export const PRMetadataSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(72, 'Title must be under 72 characters'),
  body: z.string()
    .min(1, 'Body is required'),
  change_type: z.enum(['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore']),
  breaking: z.boolean().default(false),
  doc_impact: z.boolean().default(false),
  doc_slugs: z.array(z.string()).default([]),
});

export type PRMetadata = z.infer<typeof PRMetadataSchema>;
