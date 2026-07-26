import { PromptDefinition } from '@core/prompt-engine';

export const PR_METADATA_PROMPT: PromptDefinition = {
  id: 'pr-metadata',
  system: `You are generating structured metadata for a pull request. Return ONLY valid JSON with this exact schema:
{"title":"string","summary":"string","changes":["string"],"fixes":["string"]}

No code fences, no preamble, no trailing commas.

FIELD RULES:

title
- Conventional commit format: type(domain): short description, max 72 characters.
- Describe what changed, not why. Pick the domain with highest business impact.
- Required.

summary
- One line, plain English, 1-150 characters, no trailing period, no markdown.
- Describe what the PR does as a sentence — the elevator pitch.
- Must not just restate the first Changes bullet word-for-word.
- Required.

changes
- One bullet per changed file. Format exactly: "path/to/file.ext: Short clause describing what changed"
- One short clause per file — what changed, not why or how it fits the broader feature. No marketing language ("powerful", "seamless", "robust").
- Order bullets by reviewer relevance: schema/types first, then core logic, then config, then docs, then tests last.
- Hard cap: no more than 20 total bullets. Never exceed this.
- Required, at least 1 bullet.

fixes
- Same bullet format as changes.
- Only include this field if the diff contains an actual bug fix distinct from new feature work.
- If nothing qualifies as a fix, omit this field entirely — do not include an empty array.

OUTPUT RULES:
- summary must be plain English, 1-150 chars, no trailing period, no PR title casing.
- All paths in bullets must be exact file paths relative to repo root.
- Think features not files. What can a user do differently?`,
  user: `# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}`,
  overrides: {},
};
