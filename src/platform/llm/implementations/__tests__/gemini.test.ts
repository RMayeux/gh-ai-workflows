import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../gemini';
import { RateLimitError, AuthenticationError, InvalidRequestError, ProviderError } from '../../../../core/errors/llm-errors';

vi.mock('../../../../core/telemetry', () => ({
  Logger: { debugProvider: vi.fn() },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const defaultRequest = { prompt: 'Hello' };

function createProvider(overrides = {}) {
  return new GeminiProvider({ apiKey: 'AIzaSyTest123456789', model: 'gemini-2.0-flash', ...overrides });
}

function mockOkResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({
      candidates: [{
        content: { parts: [{ text: 'Hi there' }] },
        finishReason: 'STOP',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
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

describe('GeminiProvider', () => {
  it('returns a successful response', async () => {
    mockFetch.mockResolvedValue(mockOkResponse());
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('Hi there');
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(response.finishReason).toBe('stop');
  });

  it('includes system instruction when provided', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, systemPrompt: 'Be concise' });
    const parsed = JSON.parse(body!);
    expect(parsed.system_instruction.parts[0].text).toBe('Be concise');
  });

  it('sets jsonMode via responseMimeType', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, jsonMode: true });
    const parsed = JSON.parse(body!);
    expect(parsed.generationConfig.responseMimeType).toBe('application/json');
  });

  it('includes stop sequences when provided', async () => {
    let body: string | undefined;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      body = opts.body as string;
      return mockOkResponse();
    });
    const provider = createProvider();
    await provider.generate({ ...defaultRequest, stopSequences: ['STOP'] });
    const parsed = JSON.parse(body!);
    expect(parsed.generationConfig.stopSequences).toEqual(['STOP']);
  });

  it('throws RateLimitError on 429', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(429, { error: { message: 'Rate limited' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(RateLimitError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Rate limited') });
  });

  it('throws AuthenticationError on 401', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(401, { error: { message: 'Bad key' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(AuthenticationError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Bad key') });
  });

  it('throws AuthenticationError on 403', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(403, { error: { message: 'Forbidden' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(AuthenticationError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Forbidden') });
  });

  it('throws InvalidRequestError on 400', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(400, { error: { message: 'Bad request' } }));
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(InvalidRequestError);
    await expect(provider.generate(defaultRequest)).rejects.toMatchObject({ message: expect.stringContaining('Bad request') });
  });

  it('throws ProviderError on 500', async () => {
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
    const provider = new GeminiProvider({ apiKey: '', model: 'gemini-2.0-flash' });
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('throws error when no candidate is returned', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ candidates: [] }),
    });
    const provider = createProvider();
    await expect(provider.generate(defaultRequest)).rejects.toThrow(ProviderError);
  });

  it('filters out thought blocks from response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [
              { text: 'thinking...', thought: true },
              { text: 'final answer' },
            ],
          },
          finishReason: 'STOP',
        }],
      }),
    });
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.text).toBe('final answer');
  });

  it('maps finishReason correctly', async () => {
    mockFetch.mockResolvedValue(mockOkResponse({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }] }));
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.finishReason).toBe('length');
  });

  it('maps SAFETY to content_filter', async () => {
    mockFetch.mockResolvedValue(mockOkResponse({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'SAFETY' }] }));
    const provider = createProvider();
    const response = await provider.generate(defaultRequest);
    expect(response.finishReason).toBe('content_filter');
  });
});
