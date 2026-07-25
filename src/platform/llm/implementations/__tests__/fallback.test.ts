import { describe, it, expect, vi } from 'vitest';
import { FallbackProvider } from '../fallback';
import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '../../types';

function createMockProvider(name: string, failWith?: Error): LLMProvider {
  return {
    providerId: name,
    capabilities: {
      capabilities: new Set(['json_mode']),
      maxTokens: 4096,
      contextWindow: 128000,
    },
    generate: vi.fn().mockImplementation(async (_req: GenerateRequest): Promise<GenerateResponse> => {
      if (failWith) throw failWith;
      return { text: `response from ${name}`, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, finishReason: 'stop' };
    }),
  };
}

describe('FallbackProvider', () => {
  it('returns response from the first successful provider', async () => {
    const p1 = createMockProvider('p1');
    const p2 = createMockProvider('p2');
    const provider = new FallbackProvider([p1, p2]);
    const response = await provider.generate({ prompt: 'test' });
    expect(response.text).toBe('response from p1');
    expect(p1.generate).toHaveBeenCalledTimes(1);
    expect(p2.generate).not.toHaveBeenCalled();
  });

  it('falls through to the next provider when the first fails', async () => {
    const p1 = createMockProvider('p1', new Error('p1 failed'));
    const p2 = createMockProvider('p2');
    const provider = new FallbackProvider([p1, p2]);
    const response = await provider.generate({ prompt: 'test' });
    expect(response.text).toBe('response from p2');
    expect(p1.generate).toHaveBeenCalledTimes(1);
    expect(p2.generate).toHaveBeenCalledTimes(1);
  });

  it('throws when all providers fail', async () => {
    const p1 = createMockProvider('p1', new Error('p1 error'));
    const p2 = createMockProvider('p2', new Error('p2 error'));
    const provider = new FallbackProvider([p1, p2]);
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('All providers failed');
  });

  it('takes capabilities from the first provider', () => {
    const p1 = createMockProvider('p1');
    const p2 = createMockProvider('p2');
    const provider = new FallbackProvider([p1, p2]);
    expect(provider.capabilities.maxTokens).toBe(4096);
  });

  it('handles empty provider list with default capabilities', () => {
    const provider = new FallbackProvider([]);
    expect(provider.capabilities.maxTokens).toBe(0);
    expect(provider.capabilities.contextWindow).toBe(0);
  });

  it('passes the request to each provider', async () => {
    const p1 = createMockProvider('p1', new Error('fail'));
    const p2 = createMockProvider('p2');
    const provider = new FallbackProvider([p1, p2]);
    await provider.generate({ prompt: 'hello', temperature: 0.5 });
    expect(p1.generate).toHaveBeenCalledWith({ prompt: 'hello', temperature: 0.5 });
    expect(p2.generate).toHaveBeenCalledWith({ prompt: 'hello', temperature: 0.5 });
  });
});
