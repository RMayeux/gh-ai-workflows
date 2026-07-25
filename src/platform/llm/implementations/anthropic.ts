import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '../types';
import { ProviderError, RateLimitError, AuthenticationError, InvalidRequestError } from '../../../core/errors/llm-errors';
import { Logger } from '../../../core/telemetry';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  stop_sequences?: string[];
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason?: string;
}

interface AnthropicErrorResponse {
  error?: {
    message: string;
    type?: string;
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly providerId = 'anthropic';
  readonly capabilities: LLMProviderCapability = {
    capabilities: new Set(['json_mode', 'streaming', 'vision']),
    maxTokens: 4096,
    contextWindow: 200000,
  };

  constructor(private config: { apiKey: string; model: string }) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      if (!this.config.apiKey) throw new Error('Missing API Key');

      const body: AnthropicRequest = {
        model: this.config.model,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens ?? this.capabilities.maxTokens,
        temperature: request.temperature ?? 0.7,
      };

      if (request.systemPrompt) {
        body.system = request.systemPrompt;
      }

      if (request.stopSequences && request.stopSequences.length > 0) {
        body.stop_sequences = request.stopSequences;
      }

      Logger.debugProvider(this.providerId, 'REQUEST', body);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as AnthropicErrorResponse;
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`${response.status}: ${errorMessage}`);
      }

      const data: AnthropicResponse = await response.json();
      Logger.debugProvider(this.providerId, 'RESPONSE', data);

      const text = data.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text || '')
        .join('\n')
        .trim() || '';

      const usage = data.usage || { input_tokens: 0, output_tokens: 0 };

      return {
        text,
        usage: {
          promptTokens: usage.input_tokens,
          completionTokens: usage.output_tokens,
          totalTokens: usage.input_tokens + usage.output_tokens,
        },
        finishReason: this.mapFinishReason(data.stop_reason ?? 'unknown'),
      };
    } catch (e: unknown) {
      throw this.normalizeError(e);
    }
  }

  private mapFinishReason(reason: string): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence': return 'stop';
      case 'max_tokens': return 'length';
      default: return 'unknown';
    }
  }

  private normalizeError(e: unknown): Error {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('429')) return new RateLimitError(message);
    if (message.includes('401') || message.includes('403')) return new AuthenticationError(message);
    if (message.includes('400')) return new InvalidRequestError(message);
    return new ProviderError(message);
  }
}
