import { describe, it, expect } from 'vitest';
import { WorkflowInputsSchema } from '../workflow-inputs';

const validInput = {
  llm: 'openai' as const,
  model: 'gpt-4o',
  apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
  promptVersion: '1.2.3',
  maxTokens: 4096,
  debug: 'true',
  githubToken: 'ghp_testtoken000000000000000000000000',
  prNumber: 42,
};

describe('WorkflowInputsSchema', () => {
  it('validates a complete valid input', () => {
    const result = WorkflowInputsSchema.parse(validInput);
    expect(result).toMatchObject({
      llm: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
      promptVersion: '1.2.3',
      maxTokens: 4096,
      debug: true,
      githubToken: 'ghp_testtoken000000000000000000000000',
      prNumber: 42,
    });
  });

  it('accepts debug as a boolean', () => {
    const result = WorkflowInputsSchema.parse({ ...validInput, debug: false });
    expect(result.debug).toBe(false);
  });

  it('accepts debug as string "true" filtering through preprocessor', () => {
    const result = WorkflowInputsSchema.parse({ ...validInput, debug: 'true' });
    expect(result.debug).toBe(true);
  });

  it('coerces string maxTokens to number', () => {
    const result = WorkflowInputsSchema.parse({ ...validInput, maxTokens: '8192' });
    expect(result.maxTokens).toBe(8192);
  });

  it('coerces string prNumber to number', () => {
    const result = WorkflowInputsSchema.parse({ ...validInput, prNumber: '7' });
    expect(result.prNumber).toBe(7);
  });

  it('rejects invalid prompt version format', () => {
    expect(() => WorkflowInputsSchema.parse({ ...validInput, promptVersion: '1.2' })).toThrow();
  });

  it('rejects empty model', () => {
    expect(() => WorkflowInputsSchema.parse({ ...validInput, model: '' })).toThrow();
  });

  it('rejects non-positive maxTokens', () => {
    expect(() => WorkflowInputsSchema.parse({ ...validInput, maxTokens: 0 })).toThrow();
  });

  it('rejects maxTokens > 100000', () => {
    expect(() => WorkflowInputsSchema.parse({ ...validInput, maxTokens: 100001 })).toThrow();
  });

  it('rejects unsupported llm provider', () => {
    expect(() => WorkflowInputsSchema.parse({ ...validInput, llm: 'unknown' })).toThrow();
  });

  it('rejects negative prNumber', () => {
    expect(() => WorkflowInputsSchema.parse({ ...validInput, prNumber: -1 })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => WorkflowInputsSchema.parse({})).toThrow();
  });
});
