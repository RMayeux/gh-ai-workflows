# QA Test Cases

Generates actionable QA test cases by analyzing PR diffs and matching them against documentation.

## Usage

```yaml
- uses: RMayeux/gh-ai-workflows/workflows/qa-test-cases@main
  with:
    llm: 'gemini'
    model: 'gemini-1.5-pro'
    api-key: ${{ secrets.GEMINI_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    doc-pattern: 'docs/features/.*\.md'
    project-context: 'Project description'
    debug: 'false'
```

## Inputs

| Input | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `llm` | Yes | - | Provider (`openai`, `anthropic`, `gemini`, `mistral`) |
| `model` | Yes | - | Model name |
| `api-key` | Yes | - | LLM API Key |
| `github-token` | Yes | - | GitHub Token |
| `doc-pattern` | No | - | Regex to find documentation files |
| `project-context` | No | - | General project context |
| `debug` | No | `false` | Enable debug logging |
