# Workflow Lifecycle Documentation

Workflows in `gh-ai-workflows` are designed as modular, reusable composite actions that orchestrate the interaction between GitHub data and AI providers.

## Anatomy of a Workflow

A typical workflow consists of three layers:
1. **GitHub Action Definition** (`action.yml`): Defines the public API (inputs/outputs).
2. **Execution Script** (`scripts/*.ts`): Handles environment setup, input validation, and process orchestration.
3. **Workflow Logic** (`packages/github/src/workflows/*.ts`): Contains the domain-specific logic for interacting with GitHub and the AI.

## Execution Flow

Every workflow follows a strict execution pipeline to ensure reliability and security:

### 1. Input Validation
Before any logic runs, all inputs are validated against a Zod schema. If validation fails, the workflow terminates immediately with a detailed error message.
- **Validated fields**: LLM provider, Model name, API Key format, Prompt version, etc.

### 2. Context Gathering
The workflow fetches the necessary data from the GitHub API:
- **PR Metadata**: Title, body, labels.
- **PR Diff**: The actual code changes (with size-based truncation to avoid token limit overflow).
- **File List**: A list of changed files for the LLM to understand the scope.

### 3. Prompt Engineering
The `PromptEngine` is used to build the final prompt:
- **Template Loading**: Loads the correct version of the prompt from `/prompts`.
- **Interpolation**: Injects the gathered GitHub context into placeholders (e.g., `__CODE_DIFF__`).
- **Provider Overrides**: Applies provider-specific wording if configured.

### 4. Structured Generation
The prompt is sent to the `generateStructured` pipeline:
- **JSON Mode**: Requests JSON output if supported by the provider.
- **Parsing & Validation**: Parsed as JSON and validated against a target Zod schema.
- **Self-Repair**: If validation fails, the LLM is asked to correct the output based on the error.

### 5. GitHub Integration
The validated AI output is used to perform actions on GitHub:
- **Updates**: Updating PR titles or descriptions.
- **Labeling**: Applying labels based on AI classification.
- **Comments**: Posting summaries or reports.

## Error Handling

Workflows implement a tiered error strategy:
- **Transient Errors**: `RateLimitError` triggers an exponential backoff retry.
- **Structural Errors**: JSON parsing errors trigger the self-repair loop.
- **Fatal Errors**: `AuthenticationError` or `InvalidRequestError` fail the workflow immediately.
- **Timeouts**: A global timeout prevents jobs from running indefinitely.
