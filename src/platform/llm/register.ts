import { ProviderRegistry } from '@core/registry';
import { OpenAIProvider } from './implementations/openai';
import { AnthropicProvider } from './implementations/anthropic';
import { GeminiProvider } from './implementations/gemini';
import { MistralProvider } from './implementations/mistral';
import { MockProvider } from './implementations/mock';

export function registerAllProviders() {
  ProviderRegistry.register('openai', OpenAIProvider);
  ProviderRegistry.register('anthropic', AnthropicProvider);
  ProviderRegistry.register('gemini', GeminiProvider);
  ProviderRegistry.register('mistral', MistralProvider);
  ProviderRegistry.register('mock', MockProvider);
}
