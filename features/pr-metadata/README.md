# PR Metadata

Generates AI-driven PR titles and structured bodies based on changes.

## Inputs

| Name | Required | Default | What breaks if wrong |
| :--- | :---: | :--- | :--- |
| `llm` | Yes | | Wrong provider id causes initialization failure |
| `model` | Yes | | Wrong model name causes API error |
| `api-key` | Yes | | Wrong key causes authentication failure |
| `github-token` | Yes | | Wrong token causes GitHub API failure |
| `max-tokens` | No | `4096` | Too low causes truncated responses |
| `debug` | No | `false` | No effect on correctness |

## Outputs

| Name | Type | When it is empty |
| :--- | :---: | :--- |
| `summary` | string | Generation fails |

## Body format

The generated PR body contains a **Changes** section with subject-grouped bullets. Each bullet describes one coherent change (schema redesign, bug fix, refactor, etc.) with its justification and risk — files touched are supporting detail, not the grouping unit. Target: 3–7 bullets regardless of file count. Changes unrelated to the PR's stated purpose are prefixed with `Unrelated:`. If bug fixes are present, a separate **Fixes** section follows the same format. An existing `## Verification` section in the PR body is copied through verbatim.

## Example usage

```yaml
- uses: gh-ai-workflows/features/pr-metadata@main
  with:
    llm: 'openai'
    model: 'gpt-4o'
    api-key: ${{ secrets.OPENAI_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```
