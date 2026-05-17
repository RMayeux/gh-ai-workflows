# Development Guide

This guide provides instructions for contributing to `gh-ai-workflows` and setting up the local development environment.

## Local Setup

### Prerequisites
- **Node.js**: v20+
- **pnpm**: v8+

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```

### Running Tests
The project uses **Vitest** for testing. Run the following command to execute all tests:
```bash
pnpm test
```
To run tests for a specific feature:
```bash
pnpm test src/features/pr-metadata
```

---

## Extending the Platform

### Adding a New Prompt
1. Create a new prompt file in `src/core/prompts/[prompt-id].ts`.
2. Define a `PromptDefinition` constant.
3. Export the constant and register it in `src/core/prompts/loader.ts` by adding it to the `PROMPTS_REGISTRY`.

### Adding a New LLM Provider
1. Create a new provider class in `src/platform/llm/implementations/`.
2. Implement the `LLMProvider` interface, specifically the `generate` method.
3. Register the provider in `src/platform/llm/index.ts` within the `registerAllProviders` function.
4. Add unit tests in `src/platform/llm/tests/` to verify the integration.

### Creating a New Workflow
1. Define the Zod schema for inputs and outputs in `src/features/[feature-name]/schema.ts`.
2. Implement the workflow logic in `src/features/[feature-name]/index.ts`.
3. Create a corresponding script in `scripts/[feature-name].ts` that calls the workflow function.
4. Define the GitHub Action in `workflows/[feature-name]/action.yml`.

---

## Debugging

To enable detailed logging during development:
- Set the `DEBUG` environment variable to `true`:
  ```bash
  DEBUG=true pnpm test
  ```
- The `Logger` will then output raw LLM requests and responses, as well as detailed telemetry.

## Build Process
The project uses `tsup` to bundle scripts into self-contained files in the `dist/` directory.
- To build manually: `pnpm run build` (if a build script is configured in package.json) or run the `tsup` command directly.
- Bundles are committed to git to ensure the Actions run without needing a build step in the GitHub runner.
