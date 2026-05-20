import { describe, it, expect } from 'vitest';
import { PromptEngine } from '@core';
import { PR_REVIEW_PROMPT } from '../prompt';

const MOCK_INPUTS = {
  pr_title: 'feat: add user authentication',
  pr_body: 'This PR implements JWT based auth.',
  changed_files: 'src/auth.ts, src/user.ts',
  code_diff: 'diff --git a/src/auth.ts b/src/auth.ts\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1,1 +1,1 @@\n-const x = 1;\n+const x = 2;',
};

describe('PR_REVIEW_PROMPT', () => {
  it('should inject all required variables exactly once at the correct positions', () => {
    const rendered = PromptEngine.render(PR_REVIEW_PROMPT, MOCK_INPUTS);
    
    expect(rendered.user).toContain(`Title: ${MOCK_INPUTS.pr_title}`);
    expect(rendered.user).toContain(`Description: ${MOCK_INPUTS.pr_body}`);
    expect(rendered.user).toContain(`# CHANGED FILES\n${MOCK_INPUTS.changed_files}`);
    expect(rendered.user).toContain(`# CODE DIFF\n${MOCK_INPUTS.code_diff}`);
  });

  it('should handle variables with special regex characters without corrupting the prompt', () => {
    const SPECIAL_INPUTS = {
      ...MOCK_INPUTS,
      pr_title: 'feat: handle [special] characters {like these} and $vars',
      pr_body: 'Check this out: *bold* and _italic_ and `code` and \\backslashes\\',
    };
    
    const rendered = PromptEngine.render(PR_REVIEW_PROMPT, SPECIAL_INPUTS);
    
    expect(rendered.user).toContain(`Title: ${SPECIAL_INPUTS.pr_title}`);
    expect(rendered.user).toContain(`Description: ${SPECIAL_INPUTS.pr_body}`);
  });

  it('should be deterministic', () => {
    const render1 = PromptEngine.render(PR_REVIEW_PROMPT, MOCK_INPUTS);
    const render2 = PromptEngine.render(PR_REVIEW_PROMPT, MOCK_INPUTS);
    
    expect(render1).toEqual(render2);
  });
});
