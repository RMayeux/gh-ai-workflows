import { describe, it, expect } from 'vitest';
import { MockProvider } from '../mock';

describe('MockProvider', () => {
  it('returns default mock response when no responseText configured', async () => {
    const provider = new MockProvider({ apiKey: 'sk-test-xxxxxxxxxxxxxxxx', model: 'mock-model' });
    const response = await provider.generate({ prompt: 'What is AI?' });
    expect(response.text).toBe('Mock response to: What is AI?');
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(response.finishReason).toBe('stop');
  });

  it('returns configured responseText when provided', async () => {
    const provider = new MockProvider({ apiKey: 'sk-test-xxxxxxxxxxxxxxxx', model: 'mock-model', responseText: 'Custom response' });
    const response = await provider.generate({ prompt: 'Hi' });
    expect(response.text).toBe('Custom response');
  });

  it('has correct providerId and capabilities', () => {
    const provider = new MockProvider({ apiKey: 'sk-test-xxxxxxxxxxxxxxxx', model: 'mock-model' });
    expect(provider.providerId).toBe('mock');
    expect(provider.capabilities.capabilities.has('json_mode')).toBe(true);
    expect(provider.capabilities.capabilities.has('streaming')).toBe(true);
    expect(provider.capabilities.maxTokens).toBe(4096);
  });
});
