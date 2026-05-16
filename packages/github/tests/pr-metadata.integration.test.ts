import { describe, it, expect } from 'vitest';
import { runPRMetadataWorkflow } from '../src/workflows/pr-metadata';
import { MockGitHubClient } from './mocks/github';
import { PR_FIXTURES } from '@gh-ai-workflows/core/testing';
import { generateStructured } from '@gh-ai-workflows/core';
import { vi } from 'vitest';

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

describe('PR Metadata Workflow Integration', () => {
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

  Object.entries(PR_FIXTURES).forEach(([name, fixture]) => {
    it(`should process ${name} correctly`, async () => {
      const mockGH = new MockGitHubClient(fixture);
      
      // Mock LLM response based on fixture name for predictability
      const mockLLMResult = {
        title: `Processed: ${fixture.details.title}`,
        body: `Processed body for ${name}`,
        change_type: name.includes('breaking') ? 'breaking' : 'feat',
        breaking: name.includes('breaking'),
        doc_impact: name.includes('docs'),
        doc_slugs: name.includes('docs') ? ['docs/readme'] : [],
      };
      
      (generateStructured as any).mockResolvedValue({
        success: true,
        data: mockLLMResult,
      });

      const result = await runPRMetadataWorkflow({
        ...defaultInputs,
        githubClient: mockGH,
      });

      expect(result).toEqual(mockLLMResult);
      
      // We can also snapshot the result to ensure no regressions in the logic
      expect(result).toMatchSnapshot();
    });
  });
});
