import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Exports a zod schema as a JSON schema.
 */
export function exportToJsonSchema(schema: z.ZodTypeAny) {
  return zodToJsonSchema(schema as any);
}
