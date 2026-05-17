# PR Review

Performs an AI-powered review of PR changes and automates labeling.

## Usage

```yaml
- uses: RMayeux/gh-ai-workflows/workflows/pr-review@main
  with:
    llm: 'openai'
    model: 'gpt-4o'
    api-key: ${{ secrets.OPENAI_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    max-tokens: '4096'
    debug: 'false'
```

## Inputs

| Input | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `llm` | Yes | - | Provider (`openai`, `anthropic`, `gemini`, `mistral`) |
| `model` | Yes | - | Model name |
| `api-key` | Yes | - | LLM API Key |
| `github-token` | Yes | - | GitHub Token |
| `max-tokens` | No | `4096` | Max tokens for response |
| `debug` | No | `false` | Enable debug logging |
