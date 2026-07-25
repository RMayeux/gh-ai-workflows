# Graph Report - .  (2026-07-25)

## Corpus Check
- Corpus is ~20,585 words - fits in a single context window. You may not need a graph.

## Summary
- 350 nodes · 735 edges · 27 communities (17 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- LLM Error Types
- Doc Sync Feature
- PR Review Tests
- Prompt Engineering
- Dev Dependencies
- Feature Documentation
- Project Config
- TypeScript Config
- PR Metadata Feature
- ESLint Config
- Core Contracts
- Doc Sync Schema
- Build System
- Architecture Conventions
- Workflow Contracts
- Workflow Runner
- Test Fixtures
- Workflow Inputs
- Agent Instructions
- Provider Registration
- Governance Policies
- PR Fixtures
- Code Style Rules
- Output Format Rules
- GitHub ContextBuilder

## God Nodes (most connected - your core abstractions)
1. `GitHubClient` - 31 edges
2. `LLMProvider` - 23 edges
3. `Logger` - 22 edges
4. `GenerateResponse` - 20 edges
5. `runDocSyncWorkflow()` - 19 edges
6. `GenerateRequest` - 19 edges
7. `LLMProviderCapability` - 17 edges
8. `runQATestCasesWorkflow()` - 15 edges
9. `upsertBotComment()` - 15 edges
10. `runPRReviewWorkflow()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Architecture Core Contracts` --conceptually_related_to--> `Core Contracts`  [INFERRED]
  docs/ARCHITECTURE.md → AGENTS.md
- `runPRMetadataWorkflow()` --calls--> `syncLabels()`  [EXTRACTED]
  features/pr-metadata/index.ts → src/platform/github/labels.ts
- `runPRReviewWorkflow()` --calls--> `syncLabels()`  [EXTRACTED]
  features/pr-review/index.ts → src/platform/github/labels.ts
- `PR Metadata Action` --references--> `PR Metadata Feature`  [EXTRACTED]
  README.md → features/pr-metadata/README.md
- `Domain Documentation System` --conceptually_related_to--> `Folder Structure Contracts`  [INFERRED]
  docs/agents/domain.md → AGENTS.md

## Import Cycles
- 2-file cycle: `src/platform/github/index.ts -> src/platform/github/labels.ts -> src/platform/github/index.ts`

## Hyperedges (group relationships)
- **All Four Features** — features_doc_sync, features_pr_metadata, features_pr_review, features_qa_test_cases [EXTRACTED 1.00]
- **CI/CD Workflows** — github_workflows_bundle, github_workflows_ci, github_workflows_doc_sync, github_workflows_pr_metadata, github_workflows_pr_review, github_workflows_qa_test_cases [EXTRACTED 1.00]
- **Agent Skills Documentation** — docs_agents_domain_context, docs_agents_issue_tracker, docs_agents_triage_labels [EXTRACTED 1.00]

## Communities (27 total, 10 thin omitted)

### Community 0 - "LLM Error Types"
Cohesion: 0.08
Nodes (30): AuthenticationError, InvalidRequestError, LLMError, ProviderError, RateLimitError, ProviderConstructor, cleanJson(), StructuredGenerationOptions (+22 more)

### Community 1 - "Doc Sync Feature"
Cohesion: 0.11
Nodes (29): findAuditBaseline(), main(), runDocSyncWorkflow(), runGitCommand(), MOCK_INPUTS, MOCK_SYNC_RESULT, mockProvider, main() (+21 more)

### Community 2 - "PR Review Tests"
Cohesion: 0.11
Nodes (15): MOCK_INPUTS, MOCK_METADATA, mockProvider, MOCK_INPUTS, MOCK_REVIEW, mockProvider, ContextBuilder, GitHubContext (+7 more)

### Community 3 - "Prompt Engineering"
Cohesion: 0.10
Nodes (17): DocSyncPrompt, MOCK_INPUTS, PRReviewWorkflowInputs, PR_REVIEW_PROMPT, PRReview, PRReviewSchema, MOCK_INPUTS, VALID_MINIMAL_REVIEW (+9 more)

### Community 4 - "Dev Dependencies"
Cohesion: 0.08
Nodes (25): @changesets/cli, eslint, husky, devDependencies, @changesets/cli, eslint, husky, prettier (+17 more)

### Community 5 - "Feature Documentation"
Cohesion: 0.12
Nodes (20): GitHub Issue Tracker Conventions, Triage Label Vocabulary, Wayfinder Operations, Doc Sync Feature, Doc Sync Composite Action, PR Metadata Feature, PR Metadata Composite Action, PR Review Feature (+12 more)

### Community 6 - "Project Config"
Cohesion: 0.10
Nodes (19): dependencies, zod, zod-to-json-schema, name, packageManager, pnpm, onlyBuiltDependencies, private (+11 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): features/*, src/core/*, src/platform/*, src/**/*.ts, compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames (+10 more)

### Community 8 - "PR Metadata Feature"
Cohesion: 0.23
Nodes (7): PRMetadataWorkflowInputs, PR_METADATA_PROMPT, PRMetadata, PRMetadataSchema, MOCK_INPUTS, VALID_METADATA, VALID_MINIMAL_METADATA

### Community 9 - "ESLint Config"
Cohesion: 0.18
Nodes (10): env, es2022, node, extends, parser, plugins, root, eslint:recommended (+2 more)

### Community 10 - "Core Contracts"
Cohesion: 0.29
Nodes (8): Core Contracts, Error Handling Policy, TypeScript Strict Mode Policy, Architecture Core Contracts, generateStructured Retry Logic, LLMProvider Interface, Logger Secret Masking, Zod Env Validation

### Community 11 - "Doc Sync Schema"
Cohesion: 0.38
Nodes (5): DocSync, DocSyncInputs, DocSyncInputsSchema, DocSyncSchema, VALID_SYNC

### Community 12 - "Build System"
Cohesion: 0.40
Nodes (5): Build System, Common Setup Composite Action, Bundle Actions Workflow, CI Workflow, tsdown Bundler

### Community 13 - "Architecture Conventions"
Cohesion: 0.67
Nodes (4): Feature Creation Workflow, Folder Structure Contracts, Domain Documentation System, Architecture Folder Structure

### Community 15 - "Workflow Runner"
Cohesion: 0.50
Nodes (3): createRunner(), RunnerInputs, WorkflowFunction

## Knowledge Gaps
- **107 isolated node(s):** `root`, `parser`, `@typescript-eslint`, `eslint:recommended`, `plugin:@typescript-eslint/recommended` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GitHubClient` connect `PR Review Tests` to `PR Metadata Feature`, `Doc Sync Feature`, `Prompt Engineering`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `Logger` connect `Doc Sync Feature` to `PR Metadata Feature`, `LLM Error Types`, `PR Review Tests`, `Prompt Engineering`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `PromptEngine` connect `Prompt Engineering` to `PR Metadata Feature`, `Doc Sync Feature`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `root`, `parser`, `@typescript-eslint` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LLM Error Types` be split into smaller, more focused modules?**
  _Cohesion score 0.08115942028985507 - nodes in this community are weakly interconnected._
- **Should `Doc Sync Feature` be split into smaller, more focused modules?**
  _Cohesion score 0.10935143288084465 - nodes in this community are weakly interconnected._
- **Should `PR Review Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._