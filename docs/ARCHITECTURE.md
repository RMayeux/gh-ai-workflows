# Repository Architecture

This is a provider-agnostic AI GitHub Actions platform implemented as a pnpm monorepo. It is designed to allow GitHub workflows to leverage various LLM providers without being locked into a specific vendor's API or prompt format.

## Core Philosophy

- **Provider Abstraction**: Workflows interact with a generic `LLMProvider` interface. The underlying provider (OpenAI, Anthropic, etc.) can be swapped via configuration without changing workflow logic.
- **Structured Outputs**: The platform emphasizes structured data (via Zod) over raw text to ensure reliability and predictability in CI/CD pipelines.
- **Security First**: Built-in secret masking, strict input validation, and minimal permissions ensure safety in public repository environments.
- **Versioned Prompts**: Prompts are treated as assets with their own versioning lifecycle, independent of the code.

## Structure

- `packages/core`: Shared types, interfaces, and base logic. Contains the `LLMProvider` interface and the `generateStructured` orchestration logic.
- `packages/providers`: Implementation of different AI providers. Maps generic requests to vendor-specific API calls.
- `packages/validators`: Zod schemas and validation logic. Ensures that both workflow inputs and LLM outputs adhere to expected formats.
- `packages/github`: GitHub-specific utilities. Wraps the GitHub API for fetching diffs, updating PRs, and managing labels.
- `packages/prompts`: Prompt templates and management. Handles versioned loading and variable interpolation.
- `packages/testing`: Shared test fixtures and utilities for consistent LLM testing.
- `packages/telemetry`: Logging, tracing, and monitoring. Includes a security-aware `Logger` for secret masking.

## Technical Deep Dives

### 1. The Provider System
The platform uses a Registry pattern. Providers are registered in `packages/providers` and instantiated via `ProviderRegistry.create(providerId, config)`. This decouples the workflow from the provider implementation.

### 2. Structured Generation Pipeline
The `generateStructured` function in `packages/core` implements a robust pipeline:
1. **Request**: Sends a prompt and a Zod schema to the provider.
2. **Parsing**: Cleans markdown fences and parses the response as JSON.
3. **Validation**: Validates the JSON against the Zod schema.
4. **Repair**: If validation fails, it automatically sends the error and the original output back to the LLM for a "self-correction" attempt (up to `maxRetries`).
5. **Fallback**: If all retries fail, it returns a structured error.

### 3. Security & Hardening
To support public usage, the following measures are implemented:
- **Secret Masking**: The `Logger` class maintains a set of secrets and automatically replaces them with `***` in all logs.
- **Input Validation**: Every workflow entry point validates environment variables using Zod before execution.
- **Execution Safety**: LLM requests are wrapped in timeouts and implement exponential backoff for rate limits.
- **Pinned Dependencies**: All GitHub Action dependencies are pinned to commit SHAs to prevent supply chain attacks.

### 4. Extensibility & Future Proofing
The platform is designed to grow without architectural rewrites through several extension points:

- **Provider Plugins**: New providers (e.g., Local LLMs via Ollama, OpenRouter) can be added by implementing the `LLMProvider` interface and registering them in the `ProviderRegistry`.
- **Fallback Logic**: The `FallbackProvider` allows wrapping multiple providers, ensuring high availability by automatically failing over to secondary models.
- **Context Builders**: The `ContextBuilder` in `packages/github` provides a reusable way to gather environment-specific data (diffs, file lists), allowing new workflows to be created quickly.
- **Cost Tracking**: `GenerateResponse` includes an optional `cost` field to allow future implementation of budget monitoring and cost reporting.
- **Scalability**: Large repositories are handled via a standard truncation and prioritization strategy in the `ContextBuilder`, preventing token limit overflows.

## Engineering Standards

### TypeScript
- Strict mode enabled.
- ESM only.
- Project references via `tsconfig.base.json`.

### Package Exports
Packages use the `exports` field in `package.json` to define a clean public API:
```json
"exports": {
  ".": "./dist/index.js"
}
```

### Shared Utilities
Shared logic should reside in `packages/core` or a specialized package (e.g., `packages/validators`). Packages should depend on each other explicitly via `pnpm` workspace references.

### Tooling
- **Turbo**: For fast builds, tests, and linting.
- **Vitest**: For unit and integration testing.
- **ESLint & Prettier**: For code quality and formatting.
- **Changesets**: For versioning and publishing.
