import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MistralProvider } from '../mistral';
import { RateLimitError, AuthenticationError, InvalidRequestError, ProviderError } from '../../../../core/errors/llm-errors';

vi.mock('../../../../core/telemetry', () => ({
  Logger: { debugProvider: vi.fn() },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const defaultRequest = { prompt: 'Hello' };

function createProvider(overrides = {}) {
  return new MistralProvider({ apiKey: 'sk-test-mistral-xxxxxxxxxxxxxxxx', model: 'mistral-large-latest', ...overrides });
}

function mockOkResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Hi there' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
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

describe('MistralProvider', () => {
  it('returns a successful response', async () => {
    mockFetch.mockResolvedValue(mockOkResponse());
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('Hi there');
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(response.finishReason).toBe('stop');
  });

  it('includes system prompt in messages', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, systemPrompt: 'Be helpful' });
    const parsed = JSON.parse(body!);
    expect(parsed.messages[0].role).toBe('system');
  });

  it('sets jsonMode response_format when requested', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, jsonMode: true });
    const parsed = JSON.parse(body!);
    expect(parsed.response_format).toEqual({ type: 'json_object' });
  });

  it('includes stop sequences when provided', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, stopSequences: ['\n'] });
    const parsed = JSON.parse(body!);
    expect(parsed.stop).toEqual(['\n']);
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
    mockFetch.mockResolvedValue(mockErrorResponse(500));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('throws ProviderError when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('handles missing API key', async () => {
    const provider = new MistralProvider({ apiKey: '', model: 'mistral-large-latest' });
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('handles empty choices gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ choices: [] }),
    });
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('');
  });

  it('maps finish_reason correctly', async () => {
    mockFetch.mockResolvedValue(mockOkResponse({ choices: [{ message: { content: 'x' }, finish_reason: 'content_filter' }] }));
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.finishReason).toBe('content_filter');
  });
});
