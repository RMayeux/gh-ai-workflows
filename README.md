# gh-ai-workflows

`gh-ai-workflows` is a provider-agnostic library for orchestrating AI within GitHub Actions, used by GitHub Action workflows.

## Available actions

| Action name | What it does | Ref path |
| :--- | :--- | :--- |
| PR Metadata | Generates AI-driven PR titles, bodies, and labels | `gh-ai-workflows/features/pr-metadata` |
| PR Review | Performs AI-driven PR reviews | `gh-ai-workflows/features/pr-review` |
| AI Doc Sync | Synchronizes documentation with code changes | `gh-ai-workflows/features/doc-sync` |
| AI QA Test Cases | Generates QA test cases from PR changes | `gh-ai-workflows/features/qa-test-cases` |

## Setup

```bash
pnpm install
pnpm run bundle
```

## Contributing

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
