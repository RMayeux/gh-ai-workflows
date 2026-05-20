# Architecture

## Folder structure

- `features/` — Action definitions and implementation logic
- `src/core/` — Shared interfaces, orchestration, and telemetry
- `src/platform/github/` — GitHub API wrappers
- `src/platform/llm/` — LLM provider implementations
- `dist/` — Compiled Action bundles

## Adding a feature

1. Create a folder in `features/<name>`.
2. Define `action.yml` with required inputs.
3. Implement logic in `features/<name>/index.ts`.
4. Define prompt in `features/<name>/prompt.ts`.
5. Define output schema in `features/<name>/schema.ts`.
6. Run `pnpm run bundle`.

## Adding a provider

1. Create implementation in `src/platform/llm/implementations/<provider>.ts`.
2. Implement `LLMProvider` interface.
3. Register provider in `src/platform/llm/index.ts`.
4. Run `pnpm run bundle`.

## Core contracts

| Name | What it does | What breaks if wrong |
| :--- | :--- | :--- |
| `LLMProvider` | Interface for LLM API interaction | Provider registration fails or `generate` throws |
| `GenerateResponse` | Standardized LLM output format | Workflow parsing fails |
| `ProviderConfig` | LLM credentials and model settings | API authentication fails |

## Build system

Command: `pnpm run bundle` (via `tsdown`)
Entry glob: `features/*/index.ts`
Output: `dist/`
Reason for committing `dist/`: Allows external repos to reference bundles without a build step.
