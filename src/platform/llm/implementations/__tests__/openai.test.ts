import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../openai';
import { RateLimitError, AuthenticationError, InvalidRequestError, ProviderError } from '../../../../core/errors/llm-errors';

vi.mock('../../../../core/telemetry', () => ({
  Logger: { debugProvider: vi.fn() },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const defaultRequest = { prompt: 'Hello' };

function createProvider(overrides = {}) {
  return new OpenAIProvider({ apiKey: 'sk-test-xxxxxxxxxxxxxxxx', model: 'gpt-4o', ...overrides });
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

describe('OpenAIProvider', () => {
  it('returns a successful response', async () => {
    mockFetch.mockResolvedValue(mockOkResponse());
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('Hi there');
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(response.finishReason).toBe('stop');
  });

  it('includes system prompt in request', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, systemPrompt: 'Be helpful' });
    const parsed = JSON.parse(body!);
    expect(parsed.messages[0].role).toBe('system');
    expect(parsed.messages[0].content).toBe('Be helpful');
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
    await provider.generate({ ...defaultRequest, stopSequences: ['\n', 'END'] });
    const parsed = JSON.parse(body!);
    expect(parsed.stop).toEqual(['\n', 'END']);
  });

  it('sets temperature and maxTokens from request', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, temperature: 0.5, maxTokens: 2048 });
    const parsed = JSON.parse(body!);
    expect(parsed.temperature).toBe(0.5);
    expect(parsed.max_tokens).toBe(2048);
  });

  it('throws RateLimitError on 429 response', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(429, { error: { message: 'Too fast' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(RateLimitError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Too fast') });
  });

  it('throws AuthenticationError on 401 response', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(401, { error: { message: 'Unauthorized' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(AuthenticationError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Unauthorized') });
  });

  it('throws AuthenticationError on 403 response', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(403, { error: { message: 'Forbidden' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(AuthenticationError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Forbidden') });
  });

  it('throws InvalidRequestError on 400 response', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(400, { error: { message: 'Bad request' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(InvalidRequestError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Bad request') });
  });

  it('throws ProviderError on 500 response', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(500, { error: { message: 'Internal error' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Internal error') });
  });

  it('throws ProviderError when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Network failure') });
  });

  it('handles missing API key', async () => {
    const provider = new OpenAIProvider({ apiKey: '', model: 'gpt-4o' });
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('handles empty choices gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }),
    });
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('');
  });

  it('maps finish_reason correctly', async () => {
    mockFetch.mockResolvedValue(mockOkResponse({ choices: [{ message: { content: 'x' }, finish_reason: 'length' }] }));
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.finishReason).toBe('length');
  });
});
