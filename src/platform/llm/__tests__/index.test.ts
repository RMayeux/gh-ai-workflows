import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAllProviders } from '../index';
import { ProviderRegistry } from '@core/registry';

vi.mock('@core/registry', () => ({
  ProviderRegistry: {
    register: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerAllProviders', () => {
  it('registers all five providers', () => {
    registerAllProviders();
    expect(ProviderRegistry.register).toHaveBeenCalledTimes(5);
    expect(ProviderRegistry.register).toHaveBeenCalledWith('openai', expect.any(Function));
    expect(ProviderRegistry.register).toHaveBeenCalledWith('anthropic', expect.any(Function));
    expect(ProviderRegistry.register).toHaveBeenCalledWith('gemini', expect.any(Function));
    expect(ProviderRegistry.register).toHaveBeenCalledWith('mistral', expect.any(Function));
    expect(ProviderRegistry.register).toHaveBeenCalledWith('mock', expect.any(Function));
  });
});
