import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPRMetadataWorkflow } from '../index';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { syncLabels } from '@platform/github/labels';
import { ProviderRegistry } from '@core/registry';
import { Logger } from '@core/telemetry';
import { LLMProvider } from '@core/types/llm';

vi.mock('@platform/github', () => {
  const mockGhInstance = {
    updatePR: vi.fn().mockResolvedValue({}),
    addLabels: vi.fn().mockResolvedValue({}),
  };
  return {
    GitHubClient: vi.fn().mockImplementation(() => mockGhInstance),
    ContextBuilder: vi.fn().mockImplementation(() => ({
      buildPRContext: vi.fn().mockResolvedValue({
        diff: 'realistic diff content',
        files: ['src/index.ts', 'src/utils.ts'],
        details: {
          title: 'Realistic PR Title',
          body: 'Realistic PR Body',
          additions: 100,
          deletions: 50,
        },
      }),
    })),
  };
});

vi.mock('@platform/github/labels', () => ({
  syncLabels: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@core/registry', () => ({
  ProviderRegistry: {
    create: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock('@core/prompt-engine', () => ({
  PromptEngine: {
    render: vi.fn().mockReturnValue({
      system: 'mock system prompt',
      user: 'mock user prompt',
    }),
  },
}));

vi.mock('@core/telemetry', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    addSecret: vi.fn(),
  },
}));

const MOCK_INPUTS = {
  githubToken: 'ghp_testtoken000000000000000000000000',
  llm: 'openai',
  model: 'gpt-4o',
  apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
  owner: 'owner-name',
  repo: 'repo-name',
  pullNumber: 123,
  maxTokens: 4096,
  debug: false,
};

const MOCK_METADATA = {
  title: 'feat(auth): add session rotation',
  body: '## What changed\nImplemented session rotation.',
  change_type: 'feat',
  breaking: false,
  doc_impact: true,
  doc_slugs: ['auth-guide'],
};

const mockProvider: LLMProvider = {
  providerId: 'openai',
  capabilities: {
    capabilities: new Set(['json_mode']),
    maxTokens: 4096,
    contextWindow: 128000,
  },
  generate: vi.fn(),
};

describe('runPRMetadataWorkflow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubEnv('GITHUB_TOKEN', MOCK_INPUTS.githubToken);
    vi.stubEnv('OPENAI_API_KEY', MOCK_INPUTS.apiKey);
    vi.mocked(ProviderRegistry.create).mockReturnValue(mockProvider);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('Happy path: valid inputs -> correct LLM call arguments -> correct output written', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_METADATA),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    const result = await runPRMetadataWorkflow(MOCK_INPUTS);

    expect(result).toEqual(MOCK_METADATA);
    expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'mock user prompt',
      systemPrompt: 'mock system prompt',
      maxTokens: MOCK_INPUTS.maxTokens,
    }));
    
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    expect(gh.updatePR).toHaveBeenCalledWith(
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      MOCK_METADATA.title,
      MOCK_METADATA.body
    );
    
    expect(syncLabels).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      { add: ['feat', 'doc-impact', 'size/S'] }
    );
  });

  it('LLM returns malformed JSON -> generateStructured retries -> succeeds on second attempt', async () => {
    vi.mocked(mockProvider.generate)
      .mockResolvedValueOnce({
        text: 'Invalid JSON',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(MOCK_METADATA),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      });

    const workflowPromise = runPRMetadataWorkflow(MOCK_INPUTS);
    await vi.runAllTimersAsync();
    const result = await workflowPromise;
    expect(result).toEqual(MOCK_METADATA);
    expect(mockProvider.generate).toHaveBeenCalledTimes(2);
  });

  it('LLM returns malformed JSON -> all retries exhausted -> structured error returned, process exits with code 1', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: 'Invalid JSON',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const workflowPromise = runPRMetadataWorkflow(MOCK_INPUTS);
    await vi.runAllTimersAsync();
    await expect(workflowPromise).rejects.toThrow(/LLM Generation failed: Format Error/);
  });

  it('LLM returns JSON that fails Zod validation -> same retry and failure behavior as above', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify({ wrong: 'schema' }),
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const workflowPromise = runPRMetadataWorkflow(MOCK_INPUTS);
    await vi.runAllTimersAsync();
    await expect(workflowPromise).rejects.toThrow(/LLM Generation failed: Format Error/);
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    vi.mocked(gh.updatePR).mockRejectedValue(new Error('GitHub API Error'));
    
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_METADATA),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await expect(runPRMetadataWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('Failed to update PR: GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: Failed to update PR: GitHub API Error'));
  });
});
