export type ModelCapability = 'json_mode' | 'streaming' | 'function_calling' | 'vision';

export interface LLMProviderCapability {
  capabilities: Set<ModelCapability>;
  maxTokens: number;
  contextWindow: number;
}

export interface GenerateRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  stopSequences?: string[];
}

export interface GenerateResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error' | 'unknown';
}

export interface LLMProvider {
  readonly providerId: string;
  readonly capabilities: LLMProviderCapability;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
