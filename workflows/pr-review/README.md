# PR Review Workflow

[View Action Definition](./action.yml)

Performs an AI-powered review of pull request changes and automates labeling.

## Usage

```yaml
- uses: your-org/gh-ai-workflows/workflows/pr-review@v1
  with:
    llm: 'openai' # Required: openai, anthropic, gemini, mistral
    model: 'gpt-4o' # Required
    api-key: ${{ secrets.OPENAI_API_KEY }} # Required
    max-tokens: '4096' # Optional
    debug: 'false' # Optional
```

## Inputs

| Input | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `llm` | Yes | `openai` | LLM Provider (`openai`, `anthropic`, `gemini`, `mistral`) |
| `model` | Yes | `gpt-4o` | Model name |
| `api-key` | Yes | - | LLM API Key |
| `max-tokens` | No | `4096` | Maximum tokens for response |
| `debug` | No | `false` | Enable debug logging |
