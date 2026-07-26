import { PromptDefinition } from '@core/prompt-engine';

export const PR_METADATA_PROMPT: PromptDefinition = {
  id: 'pr-metadata',
  system: `You are a staff engineer analyzing a PR diff. Return ONLY valid JSON with this schema:
{"title":"string (max 72 chars)","summary":"string (max 150 chars, one line)","body":"string","change_type":"feat|fix|refactor|perf|docs|test|build|ci|chore"}

No code fences, no preamble, no trailing commas.
- Title: conventional commit type(domain): description, under 72 chars. Pick the domain with highest business impact.
- Summary: one line that captures what changed and why — the reader should know in one sentence. Max 150 chars.
- Body: structured markdown with these sections:
  Changes — bullet list of what changed per area, with file paths
  Fixes — bullet list of bugs fixed (omit if none)
  Verification — checkmark bullets showing how it was validated
- Change type: infer from diff intent.
- Think features not files. What can a user do differently?`,
  user: `# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}`,
  overrides: {},
};
