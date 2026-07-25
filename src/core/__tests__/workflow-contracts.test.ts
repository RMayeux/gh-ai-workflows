import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateWorkflowInput, serializeWorkflowOutput } from '../workflow-contracts';

const testContract = {
  inputSchema: z.object({ name: z.string(), count: z.number() }),
  outputSchema: z.object({ result: z.string() }),
};

describe('validateWorkflowInput', () => {
  it('validates a parsed object input', () => {
    const result = validateWorkflowInput(testContract, { name: 'test', count: 42 });
    expect(result).toEqual({ name: 'test', count: 42 });
  });

  it('parses a JSON string input then validates', () => {
    const result = validateWorkflowInput(testContract, '{"name":"test","count":42}');
    expect(result).toEqual({ name: 'test', count: 42 });
  });

  it('keeps a non-JSON string as-is and lets schema validate', () => {
    expect(() => validateWorkflowInput(testContract, 'just-a-string')).toThrow();
  });

  it('throws ZodError when input does not match schema', () => {
    expect(() => validateWorkflowInput(testContract, { name: 123 })).toThrow(z.ZodError);
  });
});

describe('serializeWorkflowOutput', () => {
  it('validates and serializes output to JSON', () => {
    const result = serializeWorkflowOutput(testContract, { result: 'success' });
    expect(result).toBe('{"result":"success"}');
  });

  it('throws when output does not match schema', () => {
    expect(() => serializeWorkflowOutput(testContract, { result: 42 })).toThrow(z.ZodError);
  });
});
