import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from '../anthropic';
import { RateLimitError, AuthenticationError, InvalidRequestError, ProviderError } from '../../../../core/errors/llm-errors';

vi.mock('../../../../core/telemetry', () => ({
  Logger: { debugProvider: vi.fn() },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const defaultRequest = { prompt: 'Hello' };

function createProvider(overrides = {}) {
  return new AnthropicProvider({ apiKey: 'sk-test-ant-xxxxxxxxxxxxxxxx', model: 'claude-sonnet-4-20250514', ...overrides });
}

function mockOkResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Hi there' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: 'end_turn',
      ...overrides,
    }),
  };
}

function mockErrorResponse(status: number, body: Record<string, unknown> = {}) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: vi.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnthropicProvider', () => {
  it('returns a successful response', async () => {
    mockFetch.mockResolvedValue(mockOkResponse());
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('Hi there');
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(response.finishReason).toBe('stop');
  });

  it('includes system prompt as top-level field', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, systemPrompt: 'Be concise' });
    const parsed = JSON.parse(body!);
    expect(parsed.system).toBe('Be concise');
  });

  it('includes stop sequences when provided', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, stopSequences: ['\n\n'] });
    const parsed = JSON.parse(body!);
    expect(parsed.stop_sequences).toEqual(['\n\n']);
  });

  it('sets max_tokens from request', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, maxTokens: 1024 });
    const parsed = JSON.parse(body!);
    expect(parsed.max_tokens).toBe(1024);
  });

  it('throws RateLimitError on 429', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(429));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(RateLimitError);
  });

  it('throws AuthenticationError on 401', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(401));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(AuthenticationError);
  });

  it('throws AuthenticationError on 403', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(403));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(AuthenticationError);
  });

  it('throws InvalidRequestError on 400', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(400));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(InvalidRequestError);
  });

  it('throws ProviderError on 500', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(500, { error: { message: 'Server error' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('throws ProviderError when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('handles missing API key', async () => {
    const provider = new AnthropicProvider({ apiKey: '', model: 'claude-sonnet-4-20250514' });
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('filters out non-text content blocks', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [
          { type: 'tool_use', text: 'tool output' },
          { type: 'text', text: 'final answer' },
        ],
        usage: { input_tokens: 5, output_tokens: 3 },
        stop_reason: 'end_turn',
      }),
    });
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('final answer');
  });

  it('handles empty content array', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [], usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'end_turn' }),
    });
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('');
  });

  it('maps stop_reason correctly', async () => {
    mockFetch.mockResolvedValue(mockOkResponse({ stop_reason: 'max_tokens' }));
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.finishReason).toBe('length');
  });
});
