import { describe, it, expect } from 'vitest';
import { PromptEngine } from '@core';
import { QA_TEST_CASES } from '../prompt';

const MOCK_INPUTS = {
  project_context: 'Project X is a fintech app.',
  code_diff: 'diff --git a/src/auth.ts b/src/auth.ts\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1,1 +1,1 @@\n-const x = 1;\n+const x = 2;',
  documentation: '# Auth Guide\nThis is the existing documentation.',
};

describe('QA_TEST_CASES', () => {
  it('should inject all required variables exactly once at the correct positions', () => {
    const rendered = PromptEngine.render(QA_TEST_CASES, MOCK_INPUTS);
    
    expect(rendered.user).toContain(`## Context\n${MOCK_INPUTS.project_context}`);
    expect(rendered.user).toContain(`## PR code changes:\n${MOCK_INPUTS.code_diff}`);
    expect(rendered.user).toContain(`## Documentation:\n${MOCK_INPUTS.documentation}`);
  });

  it('should handle variables with special regex characters without corrupting the prompt', () => {
    const SPECIAL_INPUTS = {
      ...MOCK_INPUTS,
      project_context: 'Project [Spec] {Context} $123',
      code_diff: 'diff --git a/[spec] b/[spec]\n--- a/[spec]\n+++ b/[spec]',
      documentation: '# Guide\nContent with *stars* and [links](url)',
    };
    
    const rendered = PromptEngine.render(QA_TEST_CASES, SPECIAL_INPUTS);
    
    expect(rendered.user).toContain(`## Context\n${SPECIAL_INPUTS.project_context}`);
    expect(rendered.user).toContain(`## PR code changes:\n${SPECIAL_INPUTS.code_diff}`);
    expect(rendered.user).toContain(`## Documentation:\n${SPECIAL_INPUTS.documentation}`);
  });

  it('should be deterministic', () => {
    const render1 = PromptEngine.render(QA_TEST_CASES, MOCK_INPUTS);
    const render2 = PromptEngine.render(QA_TEST_CASES, MOCK_INPUTS);
    
    expect(render1).toEqual(render2);
  });
});
