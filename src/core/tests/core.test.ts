import { describe, it, expect, vi } from 'vitest';
import { ProviderRegistry } from '../registry';
import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '../types/llm';

class MockProvider implements LLMProvider {
  readonly providerId = 'mock';
  readonly capabilities: LLMProviderCapability = {
    capabilities: new Set(['json_mode']),
    maxTokens: 4096,
    contextWindow: 8192,
  };

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    return {
      text: JSON.stringify({ result: 'success' }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      finishReason: 'stop',
    };
  }
}

describe('ProviderRegistry', () => {
  it('should register and create a provider', () => {
    ProviderRegistry.register('mock', MockProvider);
    const provider = ProviderRegistry.create('mock', { apiKey: 'test', model: 'test' });
    expect(provider).toBeInstanceOf(MockProvider);
    expect(provider.providerId).toBe('mock');
  });

  it('should throw error for unregistered provider', () => {
    expect(() => ProviderRegistry.create('unknown', {})).toThrow('Provider unknown is not registered');
  });

  it('should list registered providers', () => {
    expect(ProviderRegistry.getRegisteredProviders()).toContain('mock');
  });
});
