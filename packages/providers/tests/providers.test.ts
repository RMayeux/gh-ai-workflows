import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '@gh-ai-workflows/core';
import { registerAllProviders } from '@gh-ai-workflows/providers';
import { GenerateRequest } from '@gh-ai-workflows/core';

describe('Provider Abstraction Layer', () => {
  it('should register all providers', () => {
    registerAllProviders();
    const registered = ProviderRegistry.getRegisteredProviders();
    expect(registered).toContain('openai');
    expect(registered).toContain('anthropic');
    expect(registered).toContain('gemini');
    expect(registered).toContain('mistral');
    expect(registered).toContain('mock');
  });

  it('should create a provider from registry', async () => {
    registerAllProviders();
    const provider = ProviderRegistry.create('mock', { responseText: 'Hello from Mock' });
    const response = await provider.generate({ prompt: 'Hi' });
    expect(response.text).toBe('Hello from Mock');
  });

  it('should be provider agnostic', async () => {
    registerAllProviders();
    const providers = [
      ProviderRegistry.create('openai', { apiKey: 'sk-123', model: 'gpt-4' }),
      ProviderRegistry.create('anthropic', { apiKey: 'sk-123', model: 'claude-3' }),
      ProviderRegistry.create('mock', {})
    ];

    const request: GenerateRequest = { prompt: 'Test' };
    for (const provider of providers) {
      const response = await provider.generate(request);
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('usage');
    }
  });
});
