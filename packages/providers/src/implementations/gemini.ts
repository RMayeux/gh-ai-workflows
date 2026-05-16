import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '@gh-ai-workflows/core';
import { ProviderError, RateLimitError, AuthenticationError, InvalidRequestError } from '@gh-ai-workflows/core';

export class GeminiProvider implements LLMProvider {
  readonly providerId = 'gemini';
  readonly capabilities: LLMProviderCapability = {
    capabilities: new Set(['json_mode', 'streaming', 'function_calling', 'vision']),
    maxTokens: 8192,
    contextWindow: 1000000,
  };

  constructor(private config: { apiKey: string; model: string }) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      if (!this.config.apiKey) throw new Error('Missing API Key');
      
      return {
        text: `Gemini response to: ${request.prompt}`,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      };
    } catch (e: any) {
      throw this.normalizeError(e);
    }
  }

  private normalizeError(e: any): Error {
    if (e.message?.includes('429')) return new RateLimitError(e.message);
    if (e.message?.includes('401')) return new AuthenticationError(e.message);
    if (e.message?.includes('400')) return new InvalidRequestError(e.message);
    return new ProviderError(e.message);
  }
}
