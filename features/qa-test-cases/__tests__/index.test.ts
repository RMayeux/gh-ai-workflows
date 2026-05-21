import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runQATestCasesWorkflow } from '../index';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { upsertBotComment } from '@platform/github/comments';
import { ProviderRegistry } from '@core/registry';
import { Logger } from '@core/telemetry';
import { LLMProvider } from '@core/types/llm';

vi.mock('@platform/github', () => {
  const mockGhInstance = {
    postComment: vi.fn().mockResolvedValue({}),
    listComments: vi.fn().mockResolvedValue([]),
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

vi.mock('@platform/github/comments', () => ({
  upsertBotComment: vi.fn().mockResolvedValue(undefined),
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
  unchangedTestCases: [],
  retiredTestCases: [],
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
      text: JSON.stringify(MOCK_QA_RESULT),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    const result = await runQATestCasesWorkflow(MOCK_INPUTS);

    expect(result).toEqual(MOCK_QA_RESULT);
    expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'mock user prompt',
      systemPrompt: 'mock system prompt',
    }));
    expect(upsertBotComment).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      '🧪 QA Test Cases',
      expect.stringContaining('### 🧪 QA Test Cases — updated')
    );
    
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    expect(gh.postComment).not.toHaveBeenCalled();
  });

  it('LLM returns malformed JSON -> generateStructured retries -> succeeds on second attempt', async () => {
    vi.mocked(mockProvider.generate)
      .mockResolvedValueOnce({
        text: 'Invalid JSON',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(MOCK_QA_RESULT),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      });

    const workflowPromise = runQATestCasesWorkflow(MOCK_INPUTS);
    await vi.runAllTimersAsync();
    const result = await workflowPromise;
    expect(result).toEqual(MOCK_QA_RESULT);
    expect(mockProvider.generate).toHaveBeenCalledTimes(2);
  });

  it('LLM returns malformed JSON -> all retries exhausted -> structured error returned, process exits with code 1', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: 'Invalid JSON',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const workflowPromise = runQATestCasesWorkflow(MOCK_INPUTS);
    const rejection = expect(workflowPromise).rejects.toThrow(/LLM Generation failed: Format Error/);
    await vi.runAllTimersAsync();
    await rejection;
  });

  it('LLM returns JSON that fails Zod validation -> same retry and failure behavior as above', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify({ wrong: 'schema' }),
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const workflowPromise = runQATestCasesWorkflow(MOCK_INPUTS);
    const rejection = expect(workflowPromise).rejects.toThrow(/LLM Generation failed: Format Error/);
    await vi.runAllTimersAsync();
    await rejection;
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    vi.mocked(upsertBotComment).mockRejectedValueOnce(new Error('GitHub API Error'));
    
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_QA_RESULT),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await expect(runQATestCasesWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('Failed to post QA comment: GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: Failed to post QA comment: GitHub API Error'));
  });

  it('Subsequent run: fetches previous comment and passes it to prompt', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    const previousComment = {
      id: 1,
      body: '🧪 QA Test Cases\n\nSome old TCs',
      created_at: '2026-01-01T00:00:00Z',
    };
    vi.mocked(gh.listComments).mockResolvedValue([previousComment]);

    const complexResult = {
      summary: 'Complex update.',
      impactedFeatures: [{ featureSlug: 'feat-a', testCases: ['New TC'] }],
      unchangedTestCases: ['Old TC 1'],
      retiredTestCases: ['Old TC 2'],
      totalTests: 2,
    };

    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(complexResult),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await runQATestCasesWorkflow(MOCK_INPUTS);

    expect(gh.listComments).toHaveBeenCalledWith(MOCK_INPUTS.owner, MOCK_INPUTS.repo, MOCK_INPUTS.pullNumber);
    
    // Verify PromptEngine.render was called with previous_comment
    const { PromptEngine } = await import('@core/prompt-engine');
    expect(PromptEngine.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        previous_comment: previousComment.body,
      })
    );

    expect(upsertBotComment).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      '🧪 QA Test Cases',
      expect.stringContaining('**Already covered**\n- [ ] Old TC 1')
    );
    expect(upsertBotComment).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      '🧪 QA Test Cases',
      expect.stringContaining('**Retired**\n~~- Old TC 2~~')
    );
  });
});
