import { PromptDefinition } from '@core/types/llm';

export const QA_TEST_CASES: PromptDefinition = {
  id: 'qa-test-cases',
  system: `You are a senior QA lead reviewing a pull request before it goes to QA.
Your goal is the most focused, actionable test list possible.
Do not output any reasoning or analysis. Output only the final result.`,
  user: `---
## Context
{{project_context}}

## PR code changes:
{{code_diff}}

## Impacted feature documentation (optionnal):
{{impacted_docs}}
---
## Rules
- Read the diff to understand what changed
- Read the feature docs to understand the business rules behind those changes
- If feature docs are empty, infer business rules from the diff alone and flag each assumption with "(assumed)"
- ONLY generate tests for rules that are NEW or CHANGED in this PR
- Assume everything untouched was already tested — do not include it
- If a rule was only rephrased with no behavior change, skip it
- Group related checks into one TC when possible
- Include at least one negative or edge-case TC per feature when the diff shows a guard, validation, or error path changed
- One line per TC: starting condition → action → expected result
- No jargon, no code, no technical details
- Skip permission checks unless permissions explicitly changed in this PR
---
## Output format
List impacted features first, then test cases grouped by feature.
Count the total TCs after generating them.

---
**[domain/feature-slug], [domain/feature-slug] — [total TC count] tests**
_[One sentence: what changed and why it matters to QA]_
- [ ] [Starting condition] → [Action] → [Expected result]
---
### Good TC examples:
- [ ] Session has completed steps → AI scores step → Score AND confidence level (1–5) both appear
- [ ] Form has required field empty → User submits → Field is highlighted and submission is blocked

### Bad TC examples (never do this):
- [ ] Verify that the system handles the AI failure correctly  ← too vague, no condition or expected result
- [ ] Call POST /api/score with missing body → Check 400 response  ← technical, not behavior-level
- [ ] User can still log in  ← untouched behavior, not in scope`,
  overrides: {}, // Use to override model, temperature, or max_tokens per environment
};