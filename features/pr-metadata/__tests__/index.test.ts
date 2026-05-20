import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPRMetadataWorkflow } from '../index';
import { GitHubClient, ContextBuilder, syncLabels } from '@platform/github';
import { ProviderRegistry, Logger } from '@core';
import { LLMProvider } from '@core/types/llm';

vi.mock('@platform/github', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      updatePR: vi.fn().mockResolvedValue({}),
    })),
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
    syncLabels: vi.fn().mockResolvedValue(undefined),
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
    vi.clearAllMocks();
    vi.stubEnv('GITHUB_TOKEN', MOCK_INPUTS.githubToken);
    vi.stubEnv('OPENAI_API_KEY', MOCK_INPUTS.apiKey);
    (ProviderRegistry.create as any).mockReturnValue(mockProvider);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Happy path: valid inputs -> correct LLM call arguments -> correct output written', async () => {
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: MOCK_METADATA,
      attempts: 1,
      rawResponse: '...',
    });

    const result = await runPRMetadataWorkflow(MOCK_INPUTS);

    expect(result).toEqual(MOCK_METADATA);
    expect(generateStructured).toHaveBeenCalledWith(
      mockProvider,
      expect.any(Object),
      expect.objectContaining({
        prompt: 'mock user prompt',
        systemPrompt: 'mock system prompt',
        maxTokens: MOCK_INPUTS.maxTokens,
      }),
      expect.objectContaining({
        maxRetries: 3,
        jsonMode: true,
      })
    );
    
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    expect(gh.updatePR).toHaveBeenCalledWith(
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      MOCK_METADATA.title,
      MOCK_METADATA.body
    );
    
    // labels: feat + doc-impact + size (150 changes = size/S)
    expect(syncLabels).toHaveBeenCalledWith(
      expect.any(GitHubClient),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      { add: ['feat', 'doc-impact', 'size/S'] }
    );
  });

  it('LLM returns malformed JSON -> generateStructured retries -> succeeds on second attempt', async () => {
    (generateStructured as any)
      .mockRejectedValueOnce(new Error('Malformed JSON'))
      .mockResolvedValueOnce({
        success: true,
        data: MOCK_METADATA,
        attempts: 2,
        rawResponse: '...',
      });

    const result = await runPRMetadataWorkflow(MOCK_INPUTS);
    expect(result).toEqual(MOCK_METADATA);
    expect(generateStructured).toHaveBeenCalledTimes(2);
  });

  it('LLM returns malformed JSON -> all retries exhausted -> structured error returned, process exits with code 1', async () => {
    (generateStructured as any).mockResolvedValue({
      success: false,
      error: 'Format Error: Unexpected token',
      attempts: 4,
      rawResponse: 'bad json',
    });

    await expect(runPRMetadataWorkflow(MOCK_INPUTS)).rejects.toThrow('LLM Generation failed: Format Error: Unexpected token');
  });

  it('LLM returns JSON that fails Zod validation -> same retry and failure behavior as above', async () => {
    (generateStructured as any).mockResolvedValue({
      success: false,
      error: 'Zod validation failed',
      attempts: 4,
      rawResponse: '{"wrong": "schema"}',
    });

    await expect(runPRMetadataWorkflow(MOCK_INPUTS)).rejects.toThrow('LLM Generation failed: Zod validation failed');
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    (gh.updatePR as any).mockRejectedValue(new Error('GitHub API Error'));
    
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: MOCK_METADATA,
      attempts: 1,
      rawResponse: '...',
    });

    await expect(runPRMetadataWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('Failed to update PR: GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: Failed to update PR: GitHub API Error'));
  });
});
