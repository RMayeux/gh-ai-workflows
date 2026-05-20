# AI QA Test Cases

Generates QA test cases from PR changes.

## Inputs

| Name | Required | Default | What breaks if wrong |
| :--- | :---: | :--- | :--- |
| `llm` | Yes | | Wrong provider id causes initialization failure |
| `model` | Yes | | Wrong model name causes API error |
| `api-key` | Yes | | Wrong key causes authentication failure |
| `github-token` | Yes | | Wrong token causes GitHub API failure |
| `project-context` | No | | Reduced accuracy of test cases |
| `doc-pattern` | No | | Missing domain context from docs |
| `debug` | No | `false` | No effect on correctness |

## Outputs

| Name | Type | When it is empty |
| :--- | :--- | :--- |
| `summary` | string | Generation fails |
| `impacted-features` | array | Generation fails |
| `total-tests` | number | Generation fails |

## Example usage

```yaml
- uses: gh-ai-workflows/features/qa-test-cases@main
  with:
    llm: 'openai'
    model: 'gpt-4o'
    api-key: ${{ secrets.OPENAI_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```
