import { describe, it, expect, vi } from 'vitest';
import { 
  coreVersion, 
  cleanJson, 
  generateStructured, 
  validateWorkflowInput, 
  serializeWorkflowOutput 
} from '../src/index';
import { LLMProvider } from '../src/types/llm';
import { z } from 'zod';

describe('Core Package', () => {
  it('should have a version', () => {
    expect(coreVersion).toBe('0.0.0');
  });
});

describe('cleanJson', () => {
  it('should remove markdown fences', () => {
    const input = '```json\n{"foo": "bar"}\n```';
    expect(cleanJson(input)).toBe('{"foo": "bar"}');
  });

  it('should remove plain markdown fences', () => {
    const input = '```\n{"foo": "bar"}\n```';
    expect(cleanJson(input)).toBe('{"foo": "bar"}');
  });

  it('should extract JSON from surrounding text', () => {
    const input = 'Here is the result: {"foo": "bar"} hope this helps!';
    expect(cleanJson(input)).toBe('{"foo": "bar"}');
  });

  it('should return trimmed text if no fences found', () => {
    const input = '  {"foo": "bar"}  ';
    expect(cleanJson(input)).toBe('{"foo": "bar"}');
  });
});

describe('generateStructured', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  const mockProvider: LLMProvider = {
    providerId: 'test',
    capabilities: {
      capabilities: new Set(['json_mode']),
      maxTokens: 1000,
      contextWindow: 4000,
    },
    generate: vi.fn(),
  };

  it('should return data when LLM returns valid JSON', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: '{"name": "Alice", "age": 30}',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const result = await generateStructured(mockProvider, schema, { prompt: 'test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Alice', age: 30 });
    expect(result.attempts).toBe(1);
  });

  it('should retry and eventually succeed if first response is invalid', async () => {
    vi.mocked(mockProvider.generate)
      .mockResolvedValueOnce({
        text: 'Invalid JSON',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      })
      .mockResolvedValueOnce({
        text: '{"name": "Alice", "age": 30}',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      });

    const result = await generateStructured(mockProvider, schema, { prompt: 'test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Alice', age: 30 });
    expect(result.attempts).toBe(2);
  });

  it('should fail after max retries', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: 'Invalid JSON',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const result = await generateStructured(mockProvider, schema, { prompt: 'test' }, { maxRetries: 1 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
  });
});

describe('Workflow Contracts', () => {
  const contract = {
    inputSchema: z.object({
      repo: z.string(),
      commit: z.string(),
    }),
    outputSchema: z.object({
      summary: z.string(),
      score: z.number(),
    }),
  };

  it('should validate workflow input', () => {
    const input = JSON.stringify({ repo: 'owner/repo', commit: 'sha' });
    const result = validateWorkflowInput(contract, input);
    expect(result).toEqual({ repo: 'owner/repo', commit: 'sha' });
  });

  it('should throw on invalid workflow input', () => {
    const input = JSON.stringify({ repo: 'owner/repo' });
    expect(() => validateWorkflowInput(contract, input)).toThrow();
  });

  it('should serialize workflow output', () => {
    const output = { summary: 'All good', score: 100 };
    const result = serializeWorkflowOutput(contract, output);
    expect(result).toBe(JSON.stringify(output));
  });

  it('should throw on invalid workflow output', () => {
    const output = { summary: 'All good' };
    expect(() => serializeWorkflowOutput(contract, output)).toThrow();
  });
});
