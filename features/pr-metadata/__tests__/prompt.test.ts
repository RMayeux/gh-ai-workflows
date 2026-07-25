import { describe, it, expect } from 'vitest';
import { PromptEngine } from '@core/prompt-engine';
import { PR_METADATA_PROMPT } from '../prompt';

const MOCK_INPUTS = {
  changed_files: 'src/auth/session.ts, src/auth/token.ts',
  code_diff: 'diff --git a/src/auth/session.ts b/src/auth/session.ts\n--- a/src/auth/session.ts\n+++ b/src/auth/session.ts\n@@ -1,1 +1,1 @@\n-const x = 1;\n+const x = 2;',
  pr_title: 'feat: add session rotation',
  pr_body: 'This PR adds session rotation.',
};

describe('PR_METADATA_PROMPT', () => {
  it('should inject all required variables exactly once at the correct positions', () => {
    const rendered = PromptEngine.render(PR_METADATA_PROMPT, MOCK_INPUTS);
    
    expect(rendered.user).toContain(`# CHANGED FILES\n${MOCK_INPUTS.changed_files}`);
    expect(rendered.user).toContain(`# CODE DIFF\n${MOCK_INPUTS.code_diff}`);
  });

  it('should handle variables with special regex characters without corrupting the prompt', () => {
    const SPECIAL_INPUTS = {
      ...MOCK_INPUTS,
      changed_files: 'file.ts; some weird filename.ts',
    };
    
    const rendered = PromptEngine.render(PR_METADATA_PROMPT, SPECIAL_INPUTS);
    
    expect(rendered.user).toContain(`# CHANGED FILES\n${SPECIAL_INPUTS.changed_files}`);
  });

  it('should be deterministic', () => {
    const render1 = PromptEngine.render(PR_METADATA_PROMPT, MOCK_INPUTS);
    const render2 = PromptEngine.render(PR_METADATA_PROMPT, MOCK_INPUTS);
    
    expect(render1).toEqual(render2);
  });
});
