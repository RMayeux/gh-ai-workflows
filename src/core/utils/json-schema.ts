import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Exports a zod schema as a JSON schema.
 */
export function exportToJsonSchema(schema: z.ZodTypeAny) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zodToJsonSchema(schema as any);
}
