import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRunner, RunnerInputs } from '../workflow-runner';

describe('createRunner', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp_testtoken000000000000000000000000');
    vi.stubEnv('LLM', 'openai');
    vi.stubEnv('MODEL', 'gpt-4o');
    vi.stubEnv('API_KEY', 'sk-test-xxxxxxxxxxxxxxxx');
    vi.stubEnv('GITHUB_REPOSITORY_OWNER', 'owner-name');
    vi.stubEnv('GITHUB_REPOSITORY_NAME', 'repo-name');
    vi.stubEnv('GITHUB_EVENT_PULL_REQUEST_NUMBER', '42');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps standard env vars to typed inputs', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({
      githubToken: 'ghp_testtoken000000000000000000000000',
      llm: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test-xxxxxxxxxxxxxxxx',
      owner: 'owner-name',
      repo: 'repo-name',
      pullNumber: 42,
      debug: false,
    }));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('sets debug=true when DEBUG=true', async () => {
    vi.stubEnv('DEBUG', 'true');
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ debug: true }));
  });

  it('maps MAX_TOKENS as number', async () => {
    vi.stubEnv('MAX_TOKENS', '8192');
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 8192 }));
  });

  it('maps LOOKBACK_COMMITS as number', async () => {
    vi.stubEnv('LOOKBACK_COMMITS', '25');
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ lookbackCommits: 25 }));
  });

  it('maps DOC_PATTERN to camelCase docPattern', async () => {
    vi.stubEnv('DOC_PATTERN', 'docs/**/*.md');
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ docPattern: 'docs/**/*.md' }));
  });

  it('maps PROJECT_CONTEXT to camelCase projectContext', async () => {
    vi.stubEnv('PROJECT_CONTEXT', 'My Project');
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ projectContext: 'My Project' }));
  });

  it('exits with code 1 when a base required env var is missing', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('LLM', 'openai');
    vi.stubEnv('MODEL', 'gpt-4o');
    vi.stubEnv('API_KEY', 'key');
    vi.stubEnv('GITHUB_REPOSITORY_OWNER', 'owner');
    vi.stubEnv('GITHUB_REPOSITORY_NAME', 'repo');

    const fn = vi.fn();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required environment variables'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('exits with code 1 when requiredEnvVars option is missing', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('GITHUB_TOKEN', 'tok');
    vi.stubEnv('LLM', 'openai');
    vi.stubEnv('MODEL', 'gpt-4o');
    vi.stubEnv('API_KEY', 'key');
    vi.stubEnv('GITHUB_REPOSITORY_OWNER', 'owner');
    vi.stubEnv('GITHUB_REPOSITORY_NAME', 'repo');

    const fn = vi.fn();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createRunner(fn, { requiredEnvVars: ['GITHUB_EVENT_PULL_REQUEST_NUMBER'] }).run()).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required environment variables'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('exits with code 1 when validate callback returns failure', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createRunner(fn, {
      validate: () => ({ success: false, error: { message: 'bad input' } }),
    }).run()).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Input validation failed:', 'bad input');
    expect(fn).not.toHaveBeenCalled();
  });

  it('proceeds when validate callback returns success', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(createRunner(fn, {
      validate: () => ({ success: true }),
    }).run()).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(fn).toHaveBeenCalled();
  });

  it('exits with code 1 when workflow function throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('workflow failure'));
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createRunner(fn).run()).rejects.toThrow('exit');
    expect(errorSpy).toHaveBeenCalledWith('Workflow failed:', expect.any(Error));
  });
});
