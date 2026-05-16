# PR Metadata Workflow

[View Action Definition](./action.yml)

Generates automated PR metadata including summaries, label suggestions, and breaking change detection.

## Usage

```yaml
- uses: your-org/gh-ai-workflows/workflows/pr-metadata@v1
  with:
    llm: 'gemini' # Required: openai, anthropic, gemini, mistral
    model: 'gemini-1.5-pro' # Required
    api-key: ${{ secrets.GEMINI_API_KEY }} # Required
    prompt-version: '1.0.0' # Optional
    max-tokens: '4096' # Optional
    debug: 'false' # Optional
```

## Inputs

| Input | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `llm` | Yes | - | LLM provider (`openai`, `anthropic`, `gemini`, `mistral`) |
| `model` | Yes | - | LLM model name |
| `api-key` | Yes | - | LLM API Key |
| `prompt-version` | No | `1.0.0` | Version of the prompt to use |
| `max-tokens` | No | `4096` | Maximum tokens for generation |
| `debug` | No | `false` | Enable debug logging |
