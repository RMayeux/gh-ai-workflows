# Developing New AI Workflows

This guide provides the "Golden Path" for adding new AI-powered capabilities to the `gh-ai-workflows` platform.

## 🏗️ Architecture Overview

The platform follows a strict layered architecture to ensure statelessness and provider-agnosticism:
`Composite Action (.yml)` $\rightarrow$ `Runner Script (.ts)` $\rightarrow$ `Feature Logic (.ts)` $\rightarrow$ `Core Orchestration`

## 🚀 The 5-Step Blueprint

### 1. Define the Schema
Create `src/features/[name]/schema.ts`. Use Zod to define exactly what the LLM should return. 
- **Tip**: Use `.describe()` on Zod fields to provide hints to the LLM.

### 2. Create the Prompt
Add a `PromptDefinition` in `src/core/prompts/[name].ts` and register it in `src/core/prompts/loader.ts`.
- **Project Standards**:
    - **No Noise**: Do not ask for reasoning or preambles.
    - **Business First**: No technical jargon or API details in the output.
    - **Incremental**: Only analyze what is NEW or CHANGED.
    - **Structured**: Ask for specific JSON keys matching your schema.

### 3. Implement the Logic
Implement the main function in `src/features/[name]/index.ts`. 
- **Use Shared Utilities**:
    - `replaceBotComments()`: For cleaning up old AI comments.
    - `syncLabels()`: For managing PR status labels.
    - `formatAIList()`: For rendering structured AI data into Markdown.
- **Workflow Flow**: Gather context $\rightarrow$ Render prompt $\rightarrow$ `generateStructured` $\rightarrow$ Execute GitHub actions.

### 4. Create the Entry-point
Create a script in `scripts/[name].ts` using the shared runner:
```typescript
import { createRunner } from '@core/workflow-runner';
import { runMyWorkflow } from '@features/my-new-workflow';

createRunner(runMyWorkflow).run();
```

### 5. Define the Action & Trigger
Create `workflows/[name]/action.yml` and `.github/workflows/[name].yml`.
- **Automatic Trigger**: Use `on: pull_request: types: [opened]` for the initial run.
- **Manual Trigger**: Use `on: workflow_dispatch` with `pull_number` input for re-triggers.
- **Standardized Inputs**: Always include `pull_number`, `owner`, and `repo` in your dispatch configuration.

## ✅ Developer Checklist
- [ ] Does the prompt explicitly forbid "reasoning" or "analysis"?
- [ ] Is the Zod schema strictly validated?
- [ ] Are GitHub permissions (e.g., `pull-requests: write`) declared in the `.yml`?
- [ ] Is the documentation updated in `workflows/[name]/README.md`?
- [ ] Does the workflow handle cases where no matching documentation is found?
