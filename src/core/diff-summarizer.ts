import { LLMProvider } from '../platform/llm/types';

const SUMMARIZE_SYSTEM_PROMPT = `You are a code review assistant. Summarize the following diff concisently.
Focus on: which files changed, what changed in each file, and key hunks.
Output plain text, ~5% of the original size.`;

export async function summarizeDiff(
  diff: string,
  provider: LLMProvider,
  threshold = 8000,
): Promise<string> {
  if (diff.length < threshold) return diff;

  const response = await provider.generate({
    prompt: `Summarize this diff:\n\n${diff}`,
    systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
    maxTokens: 1024,
    temperature: 0.3,
  });

  return response.text;
}
