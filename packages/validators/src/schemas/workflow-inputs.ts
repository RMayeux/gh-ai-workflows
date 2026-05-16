import { z } from 'zod';

export const WorkflowInputsSchema = z.object({
  llm: z.enum(['openai', 'anthropic', 'gemini', 'mistral', 'mock']),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  promptVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Invalid prompt version format (expected x.y.z)'),
  maxTokens: z.coerce.number().int().positive().max(100000),
  debug: z.preprocess((val) => val === 'true', z.boolean()),
  githubToken: z.string().min(1),
  prNumber: z.coerce.number().int().positive(),
});

export type WorkflowInputs = z.infer<typeof WorkflowInputsSchema>;
