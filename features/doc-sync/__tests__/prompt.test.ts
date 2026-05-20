import { describe, it, expect } from 'vitest';
import { PromptEngine } from '@core';
import { DocSyncPrompt } from '../prompt';

const MOCK_INPUTS = {
  code_diff: 'diff --git a/src/auth.ts b/src/auth.ts\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1,1 +1,1 @@\n-const x = 1;\n+const x = 2;',
  documentation: '# Auth Guide\nThis is the existing documentation.',
};

describe('DocSyncPrompt', () => {
  it('should inject all required variables exactly once at the correct positions', () => {
    const rendered = PromptEngine.render(DocSyncPrompt, MOCK_INPUTS);
    
    expect(rendered.user).toContain(`## PR code changes:\n${MOCK_INPUTS.code_diff}`);
    expect(rendered.user).toContain(`## Existing documentation:\n${MOCK_INPUTS.documentation}`);
  });

  it('should handle variables with special regex characters without corrupting the prompt', () => {
    const SPECIAL_INPUTS = {
      ...MOCK_INPUTS,
      code_diff: 'diff --git a/[spec] b/[spec]\n--- a/[spec]\n+++ b/[spec]',
      documentation: '# Guide\nContent with *stars* and [links](url) and $vars',
    };
    
    const rendered = PromptEngine.render(DocSyncPrompt, SPECIAL_INPUTS);
    
    expect(rendered.user).toContain(`## PR code changes:\n${SPECIAL_INPUTS.code_diff}`);
    expect(rendered.user).toContain(`## Existing documentation:\n${SPECIAL_INPUTS.documentation}`);
  });

  it('should be deterministic', () => {
    const render1 = PromptEngine.render(DocSyncPrompt, MOCK_INPUTS);
    const render2 = PromptEngine.render(DocSyncPrompt, MOCK_INPUTS);
    
    expect(render1).toEqual(render2);
  });
});
