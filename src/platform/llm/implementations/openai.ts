import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '../types';
import { ProviderError, RateLimitError, AuthenticationError, InvalidRequestError } from '../../../core/errors/llm-errors';

export class OpenAIProvider implements LLMProvider {
  readonly providerId = 'openai';
  readonly capabilities: LLMProviderCapability = {
    capabilities: new Set(['json_mode', 'streaming', 'function_calling', 'vision']),
    maxTokens: 4096,
    contextWindow: 128000,
  };

  constructor(private config: { apiKey: string; model: string }) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      // In a real implementation, we would use the openai npm package
      // For now, we mock the API call and error handling
      if (!this.config.apiKey) throw new Error('Missing API Key');
      
      return {
        text: `OpenAI response to: ${request.prompt}`,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      };
    } catch (e: unknown) {
      throw this.normalizeError(e);
    }
  }

  private normalizeError(e: unknown): Error {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('429')) return new RateLimitError(message);
    if (message.includes('401')) return new AuthenticationError(message);
    if (message.includes('400')) return new InvalidRequestError(message);
    return new ProviderError(message);
  }
}
