import { describe, it, expect, vi } from 'vitest';
import { runPRMetadataWorkflow } from '../src/workflows/pr-metadata';
import { MockGitHubClient } from './mocks/github';
import { PR_FIXTURES } from '@gh-ai-workflows/core/testing';
import { generateStructured, ProviderError } from '@gh-ai-workflows/core';

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

describe('PR Metadata Workflow Failure Modes', () => {
  const defaultInputs = {
    githubToken: 'mock-token',
    llm: 'mock',
    model: 'mock-model',
    apiKey: 'mock-key',
    owner: 'owner',
    repo: 'repo',
    pullNumber: 1,
    promptVersion: '1.0.0',
  };

  it('should handle LLM generation failure gracefully', async () => {
    const mockGH = new MockGitHubClient(PR_FIXTURES['small-pr']);
    vi.spyOn(mockGH, 'updatePR');
    
    (generateStructured as any).mockRejectedValue(new ProviderError('LLM API timeout', 'timeout'));

    await expect(runPRMetadataWorkflow({
      ...defaultInputs,
      githubClient: mockGH,
    })).rejects.toThrow('LLM API timeout');
    
    // Verify that the PR was NOT updated if generation failed
    expect(mockGH.updatePR).not.toHaveBeenCalled();
  });

  it('should handle GitHub API failure during metadata update', async () => {
    const mockGH = new MockGitHubClient(PR_FIXTURES['small-pr']);
    vi.spyOn(mockGH, 'updatePR').mockRejectedValue(new Error('GitHub API Error'));
    
    (generateStructured as any).mockResolvedValue({
      success: true,
      data: {
        title: 'New Title',
        body: 'New Body',
        change_type: 'feat',
        breaking: false,
        doc_impact: false,
        doc_slugs: [],
      },
    });

    await expect(runPRMetadataWorkflow({
      ...defaultInputs,
      githubClient: mockGH,
    })).rejects.toThrow('GitHub API Error');
  });
});
