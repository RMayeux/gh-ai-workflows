# User Guide

Welcome to `gh-ai-workflows`! This guide will help you integrate AI-powered automation into your GitHub repository.

## Quickstart

The fastest way to get started is by using the **PR Metadata** workflow. This workflow automatically summarizes your PR, suggests labels, and detects breaking changes.

### 1. Add the Workflow
Create a file at `.github/workflows/ai-pr-metadata.yml` in your repository:

```yaml
name: AI PR Metadata
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  update-pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
      issues: write
    steps:
      - uses: your-org/gh-ai-workflows/workflows/pr-metadata@v1
        with:
          llm: 'gemini'
          model: 'gemini-1.5-pro'
          api-key: ${{ secrets.GEMINI_API_KEY }}
```

### 2. Configure Secrets
Go to **Settings > Secrets and variables > Actions** and add your provider's API key:
- `GEMINI_API_KEY`: Your Google AI Studio key.
- `OPENAI_API_KEY`: Your OpenAI key.
- `ANTHROPIC_API_KEY`: Your Anthropic key.

---

## Installation & Setup

### Requirements
- A GitHub repository.
- An API key from one of the supported providers.

### Provider Setup

| Provider | Where to get API Key | Recommended Model |
| :--- | :--- | :--- |
| **Gemini** | [Google AI Studio](https://aistudio.google.com/) | `gemini-1.5-pro` |
| **OpenAI** | [OpenAI Dashboard](https://platform.openai.com/) | `gpt-4o` |
| **Anthropic** | [Anthropic Console](https://console.anthropic.com/) | `claude-3-5-sonnet` |
| **Mistral** | [Mistral La Plateforme](https://console.mistral.ai/) | `mistral-large-latest` |

---

## Troubleshooting

### Common Issues

#### ❌ "Invalid workflow inputs"
This means one of the inputs you provided in the YAML file is missing or in the wrong format. Check that your `llm` value is one of the supported providers (`openai`, `anthropic`, `gemini`, `mistral`, `mock`) and that your `api-key` is provided.

#### ❌ "LLM request timed out"
The AI provider took too long to respond. This can happen with very large PR diffs. Try to keep your PRs smaller or ensure you are using a model with a larger context window.

#### ❌ "Max retries reached"
The LLM failed to produce a valid JSON response even after multiple correction attempts. This usually indicates a provider-side issue or a highly complex prompt.

### Debugging
To see detailed logs (including the raw prompts and LLM responses), set the `DEBUG` environment variable to `true` in your GitHub Action environment or locally:
```yaml
env:
  DEBUG: 'true'
```
*Note: Secrets are automatically masked in debug logs.*

---

## FAQ

**Q: Is my code sent to the AI provider?**
A: Yes, the workflow sends the PR diff and changed file names to the selected provider to generate the summary. Please ensure your organization's AI policy allows this.

**Q: Can I use my own prompt?**
A: Yes. You can contribute new prompt templates to the `src/core/prompts` directory of the monorepo.

**Q: Does it support monorepos?**
A: Absolutely. The diff-fetching logic is designed to handle monorepo structures efficiently.

**Q: How are secrets handled?**
A: We use GitHub Secrets. The platform never stores your keys and masks them in all output logs.
