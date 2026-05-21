# AI Doc Sync

Synchronizes documentation with code changes.

## Inputs

| Name | Required | Default | What breaks if wrong |
| :--- | :---: | :--- | :--- |
| `llm` | Yes | | Wrong provider id causes initialization failure |
| `model` | Yes | | Wrong model name causes API error |
| `api-key` | Yes | | Wrong key causes authentication failure |
| `github-token` | Yes | | Wrong token causes GitHub API failure |
| `doc-pattern` | Yes | | Documentation files not found |
| `lookback-commits` | No | `10` | Too low misses context |
| `debug` | No | `false` | No effect on correctness |

## Outputs

| Name | Type | When it is empty |
| :--- | :--- | :--- |
| `summary` | string | Generation fails |
| `changes` | array | Generation fails |

## Example usage

```yaml
- uses: gh-ai-workflows/features/doc-sync@main
  with:
    llm: 'openai'
    model: 'gpt-4o'
    api-key: ${{ secrets.OPENAI_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    doc-pattern: 'docs/**/*.md'
```
