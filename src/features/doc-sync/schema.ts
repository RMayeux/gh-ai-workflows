import { z } from 'zod';

export const DocSyncSchema = z
  .object({
    summary: z.string().describe('Summary of the documentation updates needed based on the code changes'),
    changes: z
      .array(
        z.object({
          path: z.string().describe('Relative path to the documentation file'),
          action: z.enum(['create', 'update', 'delete']).describe('The action to perform on the file'),
          content: z.string().describe('The full new content of the file (empty string if action is delete)'),
          explanation: z.string().describe('Short explanation of why this change is needed'),
        })
      )
      .describe('List of suggested documentation changes'),
  })
  .strict();

export type DocSync = z.infer<typeof DocSyncSchema>;

export const DocSyncInputsSchema = z.object({
  githubToken: z.string().min(1),
  llm: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullNumber: z.number().int().positive().optional(),
  lookbackCommits: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe('Number of commits to look back if no audit PR is found'),
  docPattern: z.string().describe('Regex to find documentation files in the repository'),
  debug: z.boolean().optional(),
});

export type DocSyncInputs = z.infer<typeof DocSyncInputsSchema>;