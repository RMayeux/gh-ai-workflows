import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '@gh-ai-workflows/core';
import { ProviderError } from '@gh-ai-workflows/core';

export class MockProvider implements LLMProvider {
  readonly providerId = 'mock';
  readonly capabilities: LLMProviderCapability = {
    capabilities: new Set(['json_mode', 'streaming', 'function_calling', 'vision']),
    maxTokens: 4096,
    contextWindow: 128000,
  };

  constructor(private config: { responseText?: string }) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    return {
      text: this.config.responseText || `Mock response to: ${request.prompt}`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    };
  }
}
