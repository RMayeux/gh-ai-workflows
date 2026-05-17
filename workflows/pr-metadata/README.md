# PR Metadata

Generates automated PR summaries, label suggestions, and breaking change detection.

## Usage

```yaml
- uses: RMayeux/gh-ai-workflows/workflows/pr-metadata@main
  with:
    llm: 'gemini'
    model: 'gemini-1.5-pro'
    api-key: ${{ secrets.GEMINI_API_KEY }}
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
| `max-tokens` | No | `4096` | Max tokens for generation |
| `debug` | No | `false` | Enable debug logging |
