import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDocSyncWorkflow } from '../index';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { ProviderRegistry, Logger } from '@core';
import { LLMProvider } from '@core/types/llm';
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('@platform/github', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      request: vi.fn(),
      listMergedPRs: vi.fn().mockResolvedValue([]),
      listPRs: vi.fn().mockResolvedValue([]),
      createPR: vi.fn().mockResolvedValue({ number: 456 }),
      updatePR: vi.fn().mockResolvedValue({}),
    })),
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

vi.mock('@core', () => {
  return {
    ProviderRegistry: {
      create: vi.fn(),
    },
    PromptEngine: {
      render: vi.fn().mockReturnValue({
        system: 'mock system prompt',
        user: 'mock user prompt',
      }),
    },
    generateStructured: vi.fn(),
    Logger: {
      log: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      addSecret: vi.fn(),
    },
  };
});

import { generateStructured } from '@core';

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
    vi.clearAllMocks();
    vi.stubEnv('GITHUB_TOKEN', MOCK_INPUTS.githubToken);
    vi.stubEnv('OPENAI_API_KEY', MOCK_INPUTS.apiKey);
    (ProviderRegistry.create as any).mockReturnValue(mockProvider);
    
    (execSync as any).mockReturnValue('mock git output');
    (existsSync as any).mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Happy path: valid inputs -> correct LLM call arguments -> correct output written', async () => {
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: MOCK_SYNC_RESULT,
      attempts: 1,
      rawResponse: '...',
    });

    const result = await runDocSyncWorkflow(MOCK_INPUTS);

    expect(result).toEqual({ synced: true, changes: MOCK_SYNC_RESULT.changes });
    expect(generateStructured).toHaveBeenCalledWith(
      mockProvider,
      expect.any(Object),
      expect.objectContaining({
        prompt: 'mock user prompt',
        systemPrompt: 'mock system prompt',
      }),
      expect.objectContaining({
        maxRetries: 3,
        jsonMode: true,
      })
    );
    
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('docs/auth.md'),
      'New content',
      'utf8'
    );
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git commit -m'), expect.any(Object));
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git push origin'), expect.any(Object));
  });

  it('Audit Mode: no pullNumber -> computes diff from baseline', async () => {
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: MOCK_SYNC_RESULT,
      attempts: 1,
      rawResponse: '...',
    });

    const result = await runDocSyncWorkflow({ ...MOCK_INPUTS, pullNumber: undefined });

    expect(result).toEqual({ synced: true, changes: MOCK_SYNC_RESULT.changes });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git diff'), expect.any(Object));
  });

  it('No changes needed: LLM returns empty changes array', async () => {
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: { summary: 'No changes needed', changes: [] },
      attempts: 1,
      rawResponse: '...',
    });

    const result = await runDocSyncWorkflow(MOCK_INPUTS);

    expect(result).toEqual({ synced: false, changes: [] });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('LLM returns malformed JSON -> generateStructured retries -> succeeds on second attempt', async () => {
    (generateStructured as any)
      .mockRejectedValueOnce(new Error('Malformed JSON'))
      .mockResolvedValueOnce({
        success: true,
        data: MOCK_SYNC_RESULT,
        attempts: 2,
        rawResponse: '...',
      });

    const result = await runDocSyncWorkflow(MOCK_INPUTS);
    expect(result).toEqual({ synced: true, changes: MOCK_SYNC_RESULT.changes });
    expect(generateStructured).toHaveBeenCalledTimes(2);
  });

  it('LLM returns malformed JSON -> all retries exhausted -> structured error returned, process exits with code 1', async () => {
    (generateStructured as any).mockResolvedValue({
      success: false,
      error: 'Format Error: Unexpected token',
      attempts: 4,
      rawResponse: 'bad json',
    });

    await expect(runDocSyncWorkflow(MOCK_INPUTS)).rejects.toThrow('LLM Generation failed: Format Error: Unexpected token');
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    (gh.createPR as any).mockRejectedValue(new Error('GitHub API Error'));
    
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: MOCK_SYNC_RESULT,
      attempts: 1,
      rawResponse: '...',
    });

    await expect(runDocSyncWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: GitHub API Error'));
  });
});
