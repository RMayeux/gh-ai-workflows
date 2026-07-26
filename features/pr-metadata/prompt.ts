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
- Describe what the PR does and the unifying reason why, if there is one — the elevator pitch.
- Must not just restate the first Changes bullet word-for-word.
- Required.

changes
- Group bullets by SUBJECT/DECISION, not by file. A subject = one coherent change: a schema redesign, a bug fix, a refactor, a new capability, an unrelated cleanup. Files touched are supporting detail inside the bullet, not the bullet's unit.
- Each bullet format:
  "Short label: what changed. Why it was needed (the problem solved or goal served). Risk/impact, if any (breaking change, silent failure mode, judgment call the model made, something that deserves a second look)."
- 1-3 sentences per bullet — brief, not padded.
- Target 3-7 bullets total regardless of file count. If a PR touches many files but represents few real subjects, collapse them under the subject they serve.
- If a change looks unrelated to the PR's stated purpose (e.g. a stray deleted file, an unrelated config tweak), prefix the bullet with "Unrelated:" so a reviewer notices.
- Do not include verification results, test status, build status, or checkmarks anywhere in the output.
- Required, at least 1 bullet.

fixes
- Same subject-grouped format as changes. One bullet per distinct bug fix, not per file.
- Only include this field if the diff contains an actual bug fix distinct from new feature work.
- If nothing qualifies as a fix, omit this field entirely — do not include an empty array.

OUTPUT RULES:
- summary must be plain English, 1-150 chars, no trailing period, no PR title casing.
- Think features not files. What can a user do differently?`,
  user: `# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}`,
  overrides: {},
};
