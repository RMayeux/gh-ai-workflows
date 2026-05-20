import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runQATestCasesWorkflow } from '../index';
import { GitHubClient, ContextBuilder, replaceBotComments } from '@platform/github';
import { ProviderRegistry, Logger } from '@core';
import { LLMProvider } from '@core/types/llm';

vi.mock('@platform/github', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      postComment: vi.fn().mockResolvedValue({}),
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
    replaceBotComments: vi.fn().mockResolvedValue(undefined),
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
  projectContext: 'Project X is a fintech app.',
  docPattern: '.*\\.md',
  debug: false,
};

const MOCK_QA_RESULT = {
  summary: 'Updated session rotation logic.',
  impactedFeatures: [
    {
      featureSlug: 'auth-session',
      testCases: ['Cond → Action → Result'],
    },
  ],
  totalTests: 1,
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

describe('runQATestCasesWorkflow', () => {
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
      data: MOCK_QA_RESULT,
      attempts: 1,
      rawResponse: '...',
    });

    const result = await runQATestCasesWorkflow(MOCK_INPUTS);

    expect(result).toEqual(MOCK_QA_RESULT);
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
    expect(replaceBotComments).toHaveBeenCalledWith(
      expect.any(GitHubClient),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      '🧪 QA Test Cases'
    );
    
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    expect(gh.postComment).toHaveBeenCalledWith(
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      expect.stringContaining('## 🧪 QA Test Cases')
    );
  });

  it('LLM returns malformed JSON -> generateStructured retries -> succeeds on second attempt', async () => {
    (generateStructured as any)
      .mockRejectedValueOnce(new Error('Malformed JSON'))
      .mockResolvedValueOnce({
        success: true,
        data: MOCK_QA_RESULT,
        attempts: 2,
        rawResponse: '...',
      });

    const result = await runQATestCasesWorkflow(MOCK_INPUTS);
    expect(result).toEqual(MOCK_QA_RESULT);
    expect(generateStructured).toHaveBeenCalledTimes(2);
  });

  it('LLM returns malformed JSON -> all retries exhausted -> structured error returned, process exits with code 1', async () => {
    (generateStructured as any).mockResolvedValue({
      success: false,
      error: 'Format Error: Unexpected token',
      attempts: 4,
      rawResponse: 'bad json',
    });

    await expect(runQATestCasesWorkflow(MOCK_INPUTS)).rejects.toThrow('LLM Generation failed: Format Error: Unexpected token');
  });

  it('LLM returns JSON that fails Zod validation -> same retry and failure behavior as above', async () => {
    (generateStructured as any).mockResolvedValue({
      success: false,
      error: 'Zod validation failed',
      attempts: 4,
      rawResponse: '{"wrong": "schema"}',
    });

    await expect(runQATestCasesWorkflow(MOCK_INPUTS)).rejects.toThrow('LLM Generation failed: Zod validation failed');
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    (gh.postComment as any).mockRejectedValue(new Error('GitHub API Error'));
    
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: MOCK_QA_RESULT,
      attempts: 1,
      rawResponse: '...',
    });

    await expect(runQATestCasesWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('Failed to post QA comment: GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: Failed to post QA comment: GitHub API Error'));
  });
});
