import { LLMProvider, GenerateRequest, GenerateResponse, LLMProviderCapability } from '../types';
import { ProviderError, RateLimitError, AuthenticationError, InvalidRequestError } from '../../../core/errors/llm-errors';
import { Logger } from '../../../core/telemetry';

interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralRequest {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
  response_format?: { type: 'json_object' | 'text' };
}

interface MistralResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MistralErrorResponse {
  error?: {
    message: string;
    type?: string;
  };
}

export class MistralProvider implements LLMProvider {
  readonly providerId = 'mistral';
  readonly capabilities: LLMProviderCapability = {
    capabilities: new Set(['json_mode', 'streaming', 'function_calling']),
    maxTokens: 4096,
    contextWindow: 32000,
  };

  constructor(private config: { apiKey: string; model: string }) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      if (!this.config.apiKey) throw new Error('Missing API Key');

      const messages: MistralMessage[] = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const body: MistralRequest = {
        model: this.config.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.capabilities.maxTokens,
      };

      if (request.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      if (request.stopSequences && request.stopSequences.length > 0) {
        body.stop = request.stopSequences;
      }

      Logger.debugProvider(this.providerId, 'REQUEST', body);

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as MistralErrorResponse;
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`${response.status}: ${errorMessage}`);
      }

      const data: MistralResponse = await response.json();
      Logger.debugProvider(this.providerId, 'RESPONSE', data);

      const choice = data.choices?.[0];
      const text = choice?.message?.content?.trim() || '';
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        text,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        finishReason: this.mapFinishReason(choice?.finish_reason ?? 'unknown'),
      };
    } catch (e: unknown) {
      throw this.normalizeError(e);
    }
  }

  private mapFinishReason(reason: string): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      default: return 'unknown';
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
