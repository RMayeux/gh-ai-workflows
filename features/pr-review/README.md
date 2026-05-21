# PR Review

Performs AI-driven PR reviews by analyzing code diffs and tracking issues across multiple iterations.

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
| :--- | :--- | :--- |
| `summary` | string | Generation fails |
| `issues` | array | Generation fails |
| `approved` | boolean | Generation fails |

## Example usage

```yaml
- uses: gh-ai-workflows/features/pr-review@main
  with:
    llm: 'openai'
    model: 'gpt-4o'
    api-key: ${{ secrets.OPENAI_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```