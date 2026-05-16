# gh-ai-workflows

`gh-ai-workflows` is a provider-agnostic library for orchestrating AI within GitHub Actions. It provides an abstraction layer over LLM providers to prevent vendor lock-in and employs Zod schemas to ensure structured, validated outputs in CI/CD pipelines.

### Why this exists
Most AI integrations in GitHub Actions are tightly coupled to a specific provider's API and rely on raw text responses, which are prone to failure. This library decouples workflow logic from the AI provider and prompt format, allowing teams to switch models (e.g., from OpenAI to Gemini) via configuration without modifying their workflow YAML files.

---

### Available Actions

- [PR Metadata](./workflows/pr-metadata/README.md)
- [PR Review](./workflows/pr-review/README.md)

---

### Contributing

This project is managed as a pnpm monorepo.

**Technical Stack**
- TypeScript (Strict mode)
- pnpm Workspaces
- Vitest (Testing)
- Turbo (Build system)

**Process**
1. Follow the standards defined in `docs/ARCHITECTURE.md`.
2. Use `npx changeset` to document changes for versioning.
3. Ensure all new provider implementations adhere to the `LLMProvider` interface in `packages/core`.

---

### Documentation
All detailed guides are located in the `/docs` directory:
- **User Guide**: Setup and configuration.
- **Architecture**: Internal design and provider system.
- **Providers**: API specifications.
- **Release Policy**: Versioning and compatibility.
