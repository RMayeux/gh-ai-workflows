import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '@gh-ai-workflows/core';

export class FallbackProvider implements LLMProvider {
  readonly providerId = 'fallback';
  readonly capabilities: LLMProviderCapability;

  constructor(
    private providers: LLMProvider[],
    options: {
      maxRetriesPerProvider?: number;
    } = {}
  ) {
    // Capabilities are the intersection of all providers, or the most capable one depending on strategy.
    // Here we take the capabilities of the first provider as the primary.
    this.capabilities = providers[0]?.capabilities || {
      capabilities: new Set(),
      maxTokens: 0,
      contextWindow: 0,
    };
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.generate(request);
      } catch (e) {
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
    }

    throw new Error(`All providers failed. Errors: ${errors.map(e => e.message).join('; ')}`);
  }
}
