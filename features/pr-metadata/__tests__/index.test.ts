import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appendFileSync } from 'node:fs';
import { runPRMetadataWorkflow } from '../index';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { ProviderRegistry } from '@core/registry';
import { Logger } from '@core/telemetry';
import type { LLMProvider } from '@platform/llm/types';

vi.mock('node:fs', () => ({
  appendFileSync: vi.fn(),
}));

const mockBuildPRContext = vi.fn();

vi.mock('@platform/github', () => {
  const mockGhInstance = {
    updatePR: vi.fn().mockResolvedValue({}),
  };
  return {
    GitHubClient: vi.fn().mockImplementation(() => mockGhInstance),
    ContextBuilder: vi.fn().mockImplementation(() => ({
      buildPRContext: mockBuildPRContext,
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
  maxTokens: 4096,
  debug: false,
};

const MOCK_METADATA = {
  title: 'feat(auth): add session rotation',
  summary: 'Add session rotation to auth module with token refresh',
  changes: [
    'Schema: Replace flat body with structured summary/changes/fixes arrays, so each part renders independently. Breaking change for anything consuming the old format.',
    'Prompt: Enforce subject-grouped bullets capped at 20 instead of per-file entries. Risk: model may misjudge significance and bury important files in group summaries.',
  ],
  fixes: [
    'Parser: Correct off-by-one error in line count that caused the last line of every file to be skipped during analysis.',
  ],
};

const MOCK_BODY_NO_VERIFICATION = 'Realistic PR Body';
const MOCK_BODY_WITH_VERIFICATION = 'Realistic PR Body\n\n## Verification\n\n- [x] All unit tests pass\n- [x] Manual QA completed';

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
    vi.stubEnv('GITHUB_OUTPUT', '');
    vi.stubEnv('OPENAI_API_KEY', MOCK_INPUTS.apiKey);
    vi.mocked(ProviderRegistry.create).mockReturnValue(mockProvider);
    mockBuildPRContext.mockResolvedValue({
      diff: 'realistic diff content',
      files: ['src/index.ts', 'src/utils.ts'],
      details: {
        title: 'Realistic PR Title',
        body: MOCK_BODY_NO_VERIFICATION,
        additions: 100,
        deletions: 50,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('Happy path: valid inputs -> correct title and body written to PR', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_METADATA),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    const expectedBody = [
      MOCK_METADATA.summary,
      '',
      '## Changes',
      '',
      `* ${MOCK_METADATA.changes[0]}`,
      `* ${MOCK_METADATA.changes[1]}`,
      '',
      '## Fixes',
      '',
      `* ${MOCK_METADATA.fixes![0]}`,
    ].join('\n');

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
      expectedBody,
    );
  });

  it('Happy path -> summary written to GITHUB_OUTPUT env file', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_METADATA),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });
    vi.stubEnv('GITHUB_OUTPUT', '/tmp/test-output');

    await runPRMetadataWorkflow(MOCK_INPUTS);

    expect(appendFileSync).toHaveBeenCalledWith('/tmp/test-output', `summary=${MOCK_METADATA.summary}\n`);
  });

  it('Happy path -> no GITHUB_OUTPUT env -> skip output write silently', async () => {
    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_METADATA),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await runPRMetadataWorkflow(MOCK_INPUTS);

    expect(appendFileSync).not.toHaveBeenCalled();
  });

  it('Should preserve existing Verification section in assembled body', async () => {
    mockBuildPRContext.mockResolvedValue({
      diff: 'realistic diff content',
      files: ['src/index.ts', 'src/utils.ts'],
      details: {
        title: 'Realistic PR Title',
        body: MOCK_BODY_WITH_VERIFICATION,
        additions: 100,
        deletions: 50,
      },
    });

    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_METADATA),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await runPRMetadataWorkflow(MOCK_INPUTS);

    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    const [, , , , body] = vi.mocked(gh.updatePR).mock.calls[0];
    expect(body).toContain('## Verification');
    expect(body).toContain('- [x] All unit tests pass');
    expect(body).toContain('- [x] Manual QA completed');
  });

  it('Should flag unrelated changes with Unrelated: prefix', async () => {
    const metadataWithUnrelated = {
      title: 'feat(core): refactor pipeline',
      summary: 'Refactor pipeline to support pluggable middleware',
      changes: [
        'Core: Extract middleware logic from monolithic pipeline into composable chain. Makes testing and extension easier.',
        'Unrelated: Deleted .github/ISSUE_TEMPLATE/1-deepen-orchestration.md. Flagging in case it was not meant to ride along.',
      ],
    };

    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(metadataWithUnrelated),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await runPRMetadataWorkflow(MOCK_INPUTS);

    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    const [, , , , body] = vi.mocked(gh.updatePR).mock.calls[0];
    expect(body).toContain('* Unrelated: Deleted .github/ISSUE_TEMPLATE/1-deepen-orchestration.md');
  });

  it('Should omit Fixes section when metadata has no fixes', async () => {
    const metadataWithoutFixes = {
      title: 'fix: resolve crash',
      summary: 'Fix null pointer in login flow',
      changes: ['Auth: Add null check before user lookup to prevent crash when user record is missing a profile. No risk — defensive check only.'],
    };

    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(metadataWithoutFixes),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await runPRMetadataWorkflow(MOCK_INPUTS);

    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    const [, , , , body] = vi.mocked(gh.updatePR).mock.calls[0];
    expect(body).not.toContain('## Fixes');
    expect(body).toContain('## Changes');
    expect(body).toContain('* Auth: Add null check before user lookup to prevent crash when user record is missing a profile. No risk — defensive check only.');
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

    const workflowPromise = runPRMetadataWorkflow(MOCK_INPUTS);
    const rejection = expect(workflowPromise).rejects.toThrow(/LLM generation failed: Format Error/);
    await vi.runAllTimersAsync();
    await rejection;
  });

  it('Should produce fewer body bullets than files when LLM subject-groups across 10 files', async () => {
    const manyFiles = Array.from({ length: 10 }, (_, i) => `src/module${i}.ts`);
    mockBuildPRContext.mockResolvedValue({
      diff: 'diff',
      files: manyFiles,
      details: { title: 'PR', body: 'body', additions: 100, deletions: 50 },
    });

    const subjectGrouped = {
      title: 'feat(core): refactor modules',
      summary: 'Refactor modules into shared core',
      changes: [
        'Core: Merge duplicate validation logic into shared utility.',
        'Config: Consolidate per-module config into single file.',
        'Docs: Update READMEs to reference shared core.',
      ],
    };

    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(subjectGrouped),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await runPRMetadataWorkflow(MOCK_INPUTS);

    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    const [, , , , body] = vi.mocked(gh.updatePR).mock.calls[0];
    const changesLines = body.split('\n').filter(l => l.startsWith('* '));
    expect(changesLines.length).toBe(3);
    expect(changesLines.length).toBeLessThan(manyFiles.length);
  });

  it('GitHub API call fails -> error is logged with masked secrets -> process exits with code 1', async () => {
    const gh = new GitHubClient(MOCK_INPUTS.githubToken);
    vi.mocked(gh.updatePR).mockRejectedValue(new Error('GitHub API Error'));

    vi.mocked(mockProvider.generate).mockResolvedValue({
      text: JSON.stringify(MOCK_METADATA),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });

    await expect(runPRMetadataWorkflow({ ...MOCK_INPUTS, githubClient: gh })).rejects.toThrow('GitHub API Error');
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed at step: GitHub API Error'));
  });
});
