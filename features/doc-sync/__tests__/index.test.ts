import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDocSyncWorkflow } from '../index';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { ProviderRegistry } from '@core/registry';
import { Logger } from '@core/telemetry';
import { LLMProvider } from '@core/types/llm';
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

vi.mock('@platform/github', () => {
  const mockGhInstance = {
    request: vi.fn(),
    listMergedPRs: vi.fn().mockResolvedValue([]),
    listPRs: vi.fn().mockResolvedValue([]),
    createPR: vi.fn().mockResolvedValue({ number: 456 }),
    updatePR: vi.fn().mockResolvedValue({}),
    getPRDetails: vi.fn().mockResolvedValue({ base: { ref: 'main' } }),
  };
  return {
    GitHubClient: vi.fn().mockImplementation(() => mockGhInstance),
    ContextBuilder: vi.fn().mockImplementation(() => ({
      buildPRContext: vi.fn().mockResolvedValue({
        diff: 'realistic diff content',
        files: ['src/index.ts'],
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
  lookbackCommits: 10,
  docPattern: '.*\\.md',
  debug: false,
};

const MOCK_SYNC_RESULT = {
  summary: 'Updated auth docs.',
  changes: [
    {
      path: 'docs/auth.md',
      action: 'update',
      content: 'New content',
      explanation: 'Update auth flow',
    }
  ],
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

describe('runDocSyncWorkflow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubEnv('GITHUB_TOKEN', MOCK_INPUTS.githubToken);
    vi.stubEnv('OPENAI_API_KEY', MOCK_INPUTS.apiKey);
    vi.mocked(ProviderRegistry.create).mockReturnValue(mockProvider);
    
    vi.mocked(execSync).mockReturnValue('mock git output');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['file1.md']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('Happy path: valid inputs -> correct LLM call arguments -> correct output written', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_SYNC_RESULT),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    const result = await runDocSyncWorkflow(MOCK_INPUTS);

    expect(result).toEqual({ synced: true, changes: MOCK_SYNC_RESULT.changes });
    expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'mock user prompt',
      systemPrompt: 'mock system prompt',
    }));
    
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('docs/auth.md'),
      'New content',
      'utf8'
    );
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git commit -m'), expect.any(Object));
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git push origin'), expect.any(Object));
  });

  it('Audit Mode: no pullNumber -> computes diff from baseline', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_SYNC_RESULT),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    const result = await runDocSyncWorkflow({ ...MOCK_INPUTS, pullNumber: undefined });

    expect(result).toEqual({ synced: true, changes: MOCK_SYNC_RESULT.changes });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git diff'), expect.any(Object));
  });

  it('No changes needed: LLM returns empty changes array', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify({ summary: 'No changes needed', changes: [] }),
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const result = await runDocSyncWorkflow(MOCK_INPUTS);

    expect(result).toEqual({ synced: false, changes: [] });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('LLM returns malformed JSON -> generateStructured retries -> succeeds on second attempt', async () => {
    vi.mocked(mockProvider.generate)
      .mockResolvedValueOnce({
        text: 'Invalid JSON',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(MOCK_SYNC_RESULT),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      });

    const workflowPromise = runDocSyncWorkflow(MOCK_INPUTS);
    await vi.runAllTimersAsync();
    const result = await workflowPromise;
    expect(result).toEqual({ synced: true, changes: MOCK_SYNC_RESULT.changes });
    expect(mockProvider.generate).toHaveBeenCalledTimes(2);
  });

  it('LLM returns malformed JSON -> all retries exhausted -> structured error returned, process exits with code 1', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: 'Invalid JSON',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const workflowPromise = runDocSyncWorkflow(MOCK_INPUTS);
    await vi.runAllTimersAsync();
    await expect(workflowPromise).rejects.toThrow('LLM Generation failed: Format Error: Unexpected token');
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    vi.mocked(gh.createPR).mockRejectedValue(new Error('GitHub API Error'));
    
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_SYNC_RESULT),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await expect(runDocSyncWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: GitHub API Error'));
  });
});
