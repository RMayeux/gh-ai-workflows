import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline } from '../workflow-pipeline';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { ProviderRegistry } from '@core/registry';
import { PromptEngine } from '@core/prompt-engine';
import { generateStructured } from '@core/structured-generation';
import { summarizeDiff } from '@core/diff-summarizer';
import { z } from 'zod';
import { Logger } from '@core/telemetry';

vi.mock('@platform/github', () => {
  const mockGhInstance = {
    request: vi.fn(),
  };
  return {
    GitHubClient: vi.fn().mockImplementation(() => mockGhInstance),
    ContextBuilder: vi.fn().mockImplementation(() => ({
      buildPRContext: vi.fn().mockResolvedValue({
        diff: 'realistic diff content',
        files: ['src/index.ts'],
        details: {
          title: 'Test PR',
          body: 'Test body',
          additions: 100,
          deletions: 50,
        },
      }),
    })),
    GitHubContext: {},
  };
});

vi.mock('@core/registry', () => ({
  ProviderRegistry: {
    create: vi.fn(),
    register: vi.fn(),
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

vi.mock('@core/structured-generation', () => ({
  generateStructured: vi.fn(),
}));

vi.mock('@core/diff-summarizer', () => ({
  summarizeDiff: vi.fn(),
}));

vi.mock('@core/prompt-engine', () => ({
  PromptEngine: {
    render: vi.fn().mockReturnValue({
      system: 'mock system prompt',
      user: 'mock user prompt',
    }),
  },
  PromptDefinition: {},
}));

const testSchema = z.object({ result: z.string() });

const MOCK_INPUTS = {
  githubToken: 'ghp_testtoken000000000000000000000000',
  llm: 'openai',
  model: 'gpt-4o',
  apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
  owner: 'owner-name',
  repo: 'repo-name',
  pullNumber: 123,
  debug: false,
};

const mockProvider = {
  providerId: 'openai',
  capabilities: {
    capabilities: new Set(['json_mode']),
    maxTokens: 4096,
    contextWindow: 128000,
  },
  generate: vi.fn(),
};

const makeConfig = (overrides = {}) => ({
  promptDef: { id: 'test', system: 'sys', user: 'usr', overrides: {} },
  schema: testSchema,
  prepareVariables: vi.fn().mockResolvedValue({ key: 'value' }),
  handleResult: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProviderRegistry.create).mockReturnValue(mockProvider as any);
    vi.mocked(generateStructured).mockResolvedValue({
      success: true,
      data: { result: 'success' },
      attempts: 1,
      rawResponse: '{"result":"success"}',
    });
  });

  it('Happy path: calls all steps and returns data', async () => {
    const config = makeConfig();

    const result = await runPipeline(MOCK_INPUTS, config);

    expect(result).toEqual({ result: 'success' });
    expect(ContextBuilder).toHaveBeenCalledTimes(1);
    expect(config.prepareVariables).toHaveBeenCalledWith(
      expect.objectContaining({ codeDiff: 'realistic diff content' }),
    );
    expect(PromptEngine.render).toHaveBeenCalledWith(
      config.promptDef,
      { key: 'value' },
    );
    expect(generateStructured).toHaveBeenCalledWith(
      mockProvider,
      testSchema,
      { prompt: 'mock user prompt', systemPrompt: 'mock system prompt' },
      { maxRetries: 3, jsonMode: true },
    );
    expect(config.handleResult).toHaveBeenCalledWith(
      expect.objectContaining({ codeDiff: 'realistic diff content' }),
      { result: 'success' },
    );
  });

  it('Uses injected githubClient when provided', async () => {
    const injectedGh = new GitHubClient('ghp_injectedtoken00000000000000000000');
    const config = makeConfig();

    await runPipeline({ ...MOCK_INPUTS, githubClient: injectedGh }, config);

    expect(config.prepareVariables).toHaveBeenCalledWith(
      expect.objectContaining({ gh: injectedGh }),
    );
  });

  it('Summarizes diff when summaryLlm and summaryModel are set', async () => {
    vi.mocked(summarizeDiff).mockResolvedValue('summarized diff');
    const config = makeConfig({ prepareVariables: vi.fn().mockResolvedValue({}) });

    await runPipeline({ ...MOCK_INPUTS, summaryLlm: 'openai', summaryModel: 'gpt-4o-mini' }, config);

    expect(summarizeDiff).toHaveBeenCalledWith('realistic diff content', mockProvider);
    expect(config.prepareVariables).toHaveBeenCalledWith(
      expect.objectContaining({ codeDiff: 'summarized diff' }),
    );
  });

  it('Passes maxTokens to generate request when set', async () => {
    const config = makeConfig();

    await runPipeline({ ...MOCK_INPUTS, maxTokens: 2048 }, config);

    expect(generateStructured).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ maxTokens: 2048 }),
      expect.anything(),
    );
  });

  it('Omits maxTokens when not set', async () => {
    const config = makeConfig();

    await runPipeline(MOCK_INPUTS, config);

    expect(generateStructured).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.not.objectContaining({ maxTokens: expect.anything() }),
      expect.anything(),
    );
  });

  it('Throws error when LLM generation fails', async () => {
    vi.mocked(generateStructured).mockResolvedValue({
      success: false,
      error: 'Format Error: Invalid JSON',
      attempts: 3,
      rawResponse: 'bad json',
    });

    const config = makeConfig();

    await expect(runPipeline(MOCK_INPUTS, config)).rejects.toThrow(
      'LLM generation failed: Format Error: Invalid JSON',
    );
    expect(config.handleResult).not.toHaveBeenCalled();
  });

  it('Logs debug messages when debug is true', async () => {
    const config = makeConfig();

    await runPipeline({ ...MOCK_INPUTS, debug: true }, config);

    expect(Logger.debug).toHaveBeenCalledWith(expect.stringContaining('Running workflow'));
    expect(Logger.debug).toHaveBeenCalledWith('Generated result:', { result: 'success' });
  });

  it('Calls prepareVariables with correct context shape', async () => {
    const config = makeConfig();

    await runPipeline(MOCK_INPUTS, config);

    const callArg = vi.mocked(config.prepareVariables).mock.calls[0][0];
    expect(callArg).toHaveProperty('gh');
    expect(callArg).toHaveProperty('provider', mockProvider);
    expect(callArg).toHaveProperty('codeDiff', 'realistic diff content');
    expect(callArg).toHaveProperty('context');
    expect(callArg.context).toHaveProperty('diff');
    expect(callArg.context).toHaveProperty('files');
    expect(callArg.context).toHaveProperty('details');
  });
});
