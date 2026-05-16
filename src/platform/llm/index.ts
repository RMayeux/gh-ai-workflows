import { ProviderRegistry } from '@core';
import { OpenAIProvider } from './implementations/openai';
import { AnthropicProvider } from './implementations/anthropic';
import { GeminiProvider } from './implementations/gemini';
import { MistralProvider } from './implementations/mistral';
import { MockProvider } from './implementations/mock';
import { FallbackProvider } from './implementations/fallback';

export function registerAllProviders() {
  ProviderRegistry.register('openai', OpenAIProvider);
  ProviderRegistry.register('anthropic', AnthropicProvider);
  ProviderRegistry.register('gemini', GeminiProvider);
  ProviderRegistry.register('mistral', MistralProvider);
  ProviderRegistry.register('mock', MockProvider);
}

export * from './implementations/openai';
export * from './implementations/anthropic';
export * from './implementations/gemini';
export * from './implementations/mistral';
export * from './implementations/mock';
export * from './utils';
