import { PromptDefinition } from '@core/types/llm';

export const DocSyncPrompt: PromptDefinition = {
  id: 'doc-sync',
  system: `You are an expert technical writer ensuring documentation stays perfectly synchronized with the codebase.
Your goal is the most precise, minimal set of documentation changes needed — no more, no less.
Maintain the existing tone, style, and structure of the documentation at all times.
Do not output any reasoning or analysis. Output only the final result.`,
  user: `---
## PR code changes:
{{code_diff}}

## Existing documentation:
{{documentation}}
---
## Rules
- Analyze the diff to identify what features, APIs, or behaviors changed
- Only update documentation that is directly affected by this diff
- If a new feature was added with no existing doc, specify where a new file should be created following the project's existing structure
- If a feature was removed, flag the doc for deletion or update — do not keep stale content
- If only internal implementation changed with no behavior or API impact, skip it
- Do not rewrite sections that are still accurate
- If no documentation changes are needed, return an empty changes array and a summary stating so
---
## Output format
Return a JSON object matching the following structure:

\`\`\`json
{
  "summary": "A concise summary of the documentation updates needed based on the code changes",
  "changes": [
    {
      "path": "relative/path/to/doc.md",
      "action": "update" | "create" | "delete",
      "content": "The full new content of the file (empty if action is delete)",
      "explanation": "Short explanation of why this change is needed"
    }
  ]
}
\`\`\``,
  overrides: {},
};
