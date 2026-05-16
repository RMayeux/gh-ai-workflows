import { LLMProvider, ProviderConfig } from './types/llm';

export type ProviderConstructor = new (config: ProviderConfig) => LLMProvider;

export class ProviderRegistry {
  private static providers = new Map<string, ProviderConstructor>();

  static register(id: string, constructor: ProviderConstructor) {
    this.providers.set(id, constructor);
  }

  static create(id: string, config: ProviderConfig): LLMProvider {
    const Constructor = this.providers.get(id);
    if (!Constructor) {
      throw new Error(`Provider ${id} is not registered`);
    }
    return new Constructor(config);
  }

  static getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
