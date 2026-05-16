import { z } from 'zod';

export interface WorkflowContract<I, O> {
  inputSchema: z.ZodSchema<I>;
  outputSchema: z.ZodSchema<O>;
}

/**
 * Validates workflow input and parses it.
 * Since GHA inputs are usually strings, we attempt to parse JSON if possible.
 */
export function validateWorkflowInput<I>(
  contract: WorkflowContract<any, any>,
  input: unknown
): I {
  let parsedInput = input;
  
  if (typeof input === 'string') {
    try {
      parsedInput = JSON.parse(input);
    } catch {
      // Keep as string if not JSON
    }
  }

  return contract.inputSchema.parse(parsedInput);
}

/**
 * Validates workflow output and serializes it to a JSON string.
 */
export function serializeWorkflowOutput<O>(
  contract: WorkflowContract<any, any>,
  output: unknown
): string {
  const validated = contract.outputSchema.parse(output);
  return JSON.stringify(validated);
}
