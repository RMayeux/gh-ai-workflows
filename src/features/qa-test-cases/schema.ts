import { z } from 'zod';

export const QATestCasesSchema = z.object({
  summary: z.string().describe('One sentence describing what changed and why it matters to QA'),
  impactedFeatures: z.array(z.object({
    featureSlug: z.string().describe('The domain/feature-slug'),
    testCases: z.array(z.string()).describe('List of test cases in "condition → action → expected result" format')
  })),
  totalTests: z.number().describe('Total number of test cases across all features')
});

export type QATestCases = z.infer<typeof QATestCasesSchema>;

export const QATestCasesInputsSchema = z.object({
  githubToken: z.string().min(1),
  llm: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullNumber: z.number().int().positive(),
  projectContext: z.string().optional().describe('General context about the project to help the AI understand the domain.'),
  docPattern: z.string().optional().describe('Optional regex to find documentation files in the repository. If provided, all matching files will be included in the prompt.'),
  debug: z.boolean().optional(),
});

export type QATestCasesInputs = z.infer<typeof QATestCasesInputsSchema>;
