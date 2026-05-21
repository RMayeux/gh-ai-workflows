import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { generateStructured, cleanJson } from '../structured-generation';
import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '../../platform/llm/types';

class MockProvider implements LLMProvider {
  readonly providerId = 'mock';
  readonly capabilities: LLMProviderCapability = {
    capabilities: new Set(['json_mode']),
    maxTokens: 4096,
    contextWindow: 8192,
  };

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (request.prompt === 'fail') {
      throw new Error('LLM Error');
    }
    return {
      text: '```json\n{"name": "test", "value": 123}\n```',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      finishReason: 'stop',
    };
  }
}

describe('cleanJson', () => {
  it('should extract JSON from markdown fences', () => {
    const text = 'Here is the result:\n```json\n{"a": 1}\n```\nHope this helps!';
    expect(cleanJson(text)).toBe('{"a": 1}');
  });

  it('should extract JSON from plain braces', () => {
    const text = 'Result: {"a": 1}';
    expect(cleanJson(text)).toBe('{"a": 1}');
  });

  it('should return original text if no JSON found', () => {
    const text = 'No JSON here';
    expect(cleanJson(text)).toBe('No JSON here');
  });
});

describe('generateStructured', () => {
  const schema = z.object({
    name: z.string(),
    value: z.number(),
  });

  it('should successfully generate and validate structured output', async () => {
    const provider = new MockProvider();
    const result = await generateStructured(provider, schema, { prompt: 'hello' });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'test', value: 123 });
    expect(result.attempts).toBe(1);
  });

  it('should handle LLM errors', async () => {
    const provider = new MockProvider();
    const result = await generateStructured(provider, schema, { prompt: 'fail' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('LLM Error');
  });
});
