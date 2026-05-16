import { describe, it, expect, vi } from 'vitest';
import { runPRMetadataWorkflow } from '../src/workflows/pr-metadata';
import { GitHubClient } from '../src/index';
import { generateStructured } from '@gh-ai-workflows/core';
import { ProviderRegistry } from '@gh-ai-workflows/core';
import { PromptEngine } from '@gh-ai-workflows/core';

vi.mock('../src/index', async () => {
  const actual = await vi.importActual('../src/index');
  return {
    ...actual,
    GitHubClient: vi.fn(),
  };
});
vi.mock('@gh-ai-workflows/core', async () => {
  const actual = await vi.importActual('@gh-ai-workflows/core');
  return {
    ...actual,
    generateStructured: vi.fn(),
    PromptEngine: {
      ...actual.PromptEngine,
      render: vi.fn().mockReturnValue({
        system: 'Mocked System',
        user: 'Mocked User',
      }),
    },
  };
});

describe('PR Metadata Workflow', () => {
  it('should orchestrate PR metadata generation and update GitHub', async () => {
    const mockGH = {
      getPRDiff: vi.fn().mockResolvedValue('diff content'),
      getPRFiles: vi.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
      getPRDetails: vi.fn().mockResolvedValue({
        title: 'Old Title',
        body: 'Old Body',
        additions: 10,
        deletions: 5,
      }),
      updatePR: vi.fn().mockResolvedValue({}),
      addLabels: vi.fn().mockResolvedValue({}),
    };
    (GitHubClient as any).mockImplementation(() => mockGH);

    vi.spyOn(ProviderRegistry, 'create').mockReturnValue({
      capabilities: {
        capabilities: new Set(['json_mode']),
      },
    } as any);

    (generateStructured as any).mockResolvedValue({
      success: true,
      data: {
        title: 'New Title',
        body: 'New Body',
        change_type: 'feat',
        breaking: false,
        doc_impact: true,
        doc_slugs: ['auth/login'],
      },
    });

    const inputs = {
      githubToken: 'token',
      llm: 'openai',
      model: 'gpt-4',
      apiKey: 'key',
      owner: 'owner',
      repo: 'repo',
      pullNumber: 1,
      promptVersion: '1.0.0',
      debug: true,
    };

    const result = await runPRMetadataWorkflow(inputs);

    expect(result.title).toBe('New Title');
    expect(mockGH.getPRDiff).toHaveBeenCalledWith('owner', 'repo', 1);
    expect(mockGH.updatePR).toHaveBeenCalledWith('owner', 'repo', 1, 'New Title', 'New Body');
    expect(mockGH.addLabels).toHaveBeenCalledWith('owner', 'repo', 1, expect.arrayContaining(['feat', 'doc-impact', 'size/XS']));
  });
});
