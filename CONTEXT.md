# gh-ai-workflows

A provider-agnostic monorepo that packages LLM-powered logic into GitHub Actions.

## Language

**Feature**:
A directory under `features/` containing `index.ts`, `prompt.ts`, `schema.ts`, and `action.yml`. A feature is the unit of implementation and bundling. It provides exactly one action.
_Avoid_: Action (when referring to the directory), plugin, module

**Action**:
A GitHub Actions composite action (`action.yml` with `runs.using: composite`). Consumed by workflows inside `.github/workflows/` and by external repos. One action per feature.
_Avoid_: Feature (when referring to the YAML entrypoint), workflow

**Provider**:
An LLM backend implementation (OpenAI, Anthropic, Gemini, Mistral) registered in `ProviderRegistry`. Implements the `LLMProvider` interface. Identified by a string key like `"openai"`.
_Avoid_: LLM (when referring to the identifier; `LLM` is a misnamed env var that should have been `PROVIDER`), model (for the service); model is the specific model name like `gpt-4o`

**Prompt**:
A `PromptDefinition` object exported from a feature's `prompt.ts`. Contains `system`, `user`, and optional `overrides` fields. Rendered by `PromptEngine.render()` with variable interpolation and provider-specific overrides.
_Avoid_: Template, message (when referring to the exported constant)

**Workflow** (in this project):
A `.yml` file under `.github/workflows/` that configures when and how an action runs. A workflow consumes one or more actions.
_Avoid_: Action, pipeline (when referring to the CI/CD configuration)

**Runner**:
The internal entry-point wrapper that maps environment variables to typed `RunnerInputs` and calls the action's main function. Defined in `src/core/workflow-runner.ts`. All action `index.ts` files use `createRunner()`.
_Avoid_: WorkflowFunction (the type alias is a misnomer), workflow handler

**WorkflowContract**:
A typed contract defining required inputs and outputs for an action. Defined in `src/core/workflow-contracts.ts`. Used for validation before execution.
_Avoid_: Schema (belongs to Zod schemas in `features/<name>/schema.ts`)
