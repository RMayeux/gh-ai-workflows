import { describe, it, expect, vi } from 'vitest';
import { summarizeDiff } from '../diff-summarizer';
import { LLMProvider } from '../../platform/llm/types';

const mockProvider: LLMProvider = {
  providerId: 'mock',
  capabilities: {
    capabilities: new Set(['json_mode']),
    maxTokens: 4096,
    contextWindow: 128000,
  },
  generate: vi.fn(),
};

describe('summarizeDiff', () => {
  it('should return diff as-is when below threshold', async () => {
    const shortDiff = 'diff --git a/a.ts b/a.ts\n+const x = 1;';
    const result = await summarizeDiff(shortDiff, mockProvider, 8000);
    expect(result).toBe(shortDiff);
  });

  it('should call provider.generate when diff exceeds threshold', async () => {
    const largeDiff = 'a'.repeat(8001);
    vi.mocked(mockProvider.generate).mockResolvedValueOnce({
      text: 'summary: changed a.ts by adding const x',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    });

    const result = await summarizeDiff(largeDiff, mockProvider, 8000);

    expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining(largeDiff.slice(0, 100)),
      systemPrompt: expect.stringContaining('Summarize'),
      maxTokens: 1024,
      temperature: 0.3,
    }));
    expect(result).toBe('summary: changed a.ts by adding const x');
  });

  it('should use default threshold of 8000', async () => {
    const largeDiff = 'b'.repeat(8001);
    vi.mocked(mockProvider.generate).mockResolvedValueOnce({
      text: 'summary text',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    });

    const result = await summarizeDiff(largeDiff, mockProvider);
    expect(result).toBe('summary text');
  });
});
