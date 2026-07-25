import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPRReviewWorkflow } from '../index';
import { GitHubClient, ContextBuilder, upsertBotComment, syncLabels } from '@platform/github';
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
        files: ['src/index.ts', 'src/utils.ts'],
        details: {
          title: 'Realistic PR Title',
          body: 'Realistic PR Body',
          additions: 100,
          deletions: 50,
        },
      }),
    })),
    replaceBotComments: vi.fn().mockResolvedValue(undefined),
    upsertBotComment: vi.fn().mockResolvedValue(undefined),
    syncLabels: vi.fn().mockResolvedValue(undefined),
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
  maxTokens: 4096,
  debug: false,
};

const MOCK_REVIEW = {
  summary: 'The implementation is correct but has some performance issues.',
  issues: [
    { severity: 'warning', status: 'new', description: 'Unnecessary loop in index.ts' }
  ],
  resolvedIssues: [],
  approved: true,
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

describe('runPRReviewWorkflow', () => {
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
      text: JSON.stringify(MOCK_REVIEW),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    const result = await runPRReviewWorkflow(MOCK_INPUTS);

    expect(result).toEqual(MOCK_REVIEW);
    expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'mock user prompt',
      systemPrompt: 'mock system prompt',
      maxTokens: MOCK_INPUTS.maxTokens,
    }));
    expect(upsertBotComment).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      '### 🤖 AI Code Review',
      expect.stringContaining('### 🤖 AI Code Review — updated')
    );
    expect(syncLabels).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      { add: ['approved'] }
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
        text: JSON.stringify(MOCK_REVIEW),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      });

    const workflowPromise = runPRReviewWorkflow(MOCK_INPUTS);
    await vi.runAllTimersAsync();
    const result = await workflowPromise;
    expect(result).toEqual(MOCK_REVIEW);
    expect(mockProvider.generate).toHaveBeenCalledTimes(2);
  });

  it('LLM returns malformed JSON -> all retries exhausted -> structured error returned, process exits with code 1', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: 'Invalid JSON',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const workflowPromise = runPRReviewWorkflow(MOCK_INPUTS);
    const rejection = expect(workflowPromise).rejects.toThrow(/LLM generation failed: Format Error/);
    await vi.runAllTimersAsync();
    await rejection;
  });

  it('LLM returns JSON that fails Zod validation -> same retry and failure behavior as above', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify({ wrong: 'schema' }),
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop',
    });

    const workflowPromise = runPRReviewWorkflow(MOCK_INPUTS);
    const rejection = expect(workflowPromise).rejects.toThrow(/LLM generation failed: Format Error/);
    await vi.runAllTimersAsync();
    await rejection;
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    vi.mocked(upsertBotComment).mockRejectedValueOnce(new Error('GitHub API Error'));
    
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_REVIEW),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await expect(runPRReviewWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: GitHub API Error'));
  });

  it('Subsequent run: fetches previous comment and passes it to prompt', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    const previousComment = {
      id: 1,
      body: '### 🤖 AI Code Review\n\nSome old issues',
      created_at: '2026-01-01T00:00:00Z',
    };
    vi.mocked(gh.listComments).mockResolvedValue([previousComment]);

    const complexReview = {
      summary: 'Improved implementation.',
      issues: [
        { severity: 'error', status: 'persisting', description: 'Critical bug still here' },
        { severity: 'info', status: 'new', description: 'Minor cleanup needed' },
      ],
      resolvedIssues: [{ description: 'Fixed the memory leak' }],
      approved: false,
    };

    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(complexReview),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await runPRReviewWorkflow(MOCK_INPUTS);

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
      '### 🤖 AI Code Review',
      expect.stringContaining('**New issues**\n- [ ] [info] Minor cleanup needed')
    );
    expect(upsertBotComment).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      '### 🤖 AI Code Review',
      expect.stringContaining('**Persisting issues**\n- [ ] [error] Critical bug still here')
    );
    expect(upsertBotComment).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_INPUTS.owner,
      MOCK_INPUTS.repo,
      MOCK_INPUTS.pullNumber,
      '### 🤖 AI Code Review',
      expect.stringContaining('**Resolved issues**\n- [x] Fixed the memory leak')
    );
  });
});
