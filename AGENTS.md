# AGENTS.md

## Project
gh-ai-workflows — a provider-agnostic pnpm monorepo that orchestrates LLM providers
inside GitHub Actions. External repos reference compiled bundles in dist/ directly.

## Commands
- Install: pnpm install
- Bundle: pnpm run bundle
- Test: pnpm test
- Lint: pnpm lint
- Type check: pnpm tsc --noEmit

## After every task — non-negotiable
Run these in order before marking any task done:
1. pnpm tsc --noEmit
2. pnpm run bundle
3. pnpm test
4. pnpm lint

If any step fails, fix it. Do not output a final diff until all four pass.
Do not ask whether to run them. Always run them.

## TypeScript
- Strict mode is enabled. Never disable it, never suppress it per-file.
- Never use `any`. Use `unknown` and narrow, or model the type correctly.
- Never use non-null assertion `!` unless the value is provably non-null at the
  call site and a comment explains why.
- Never use `@ts-ignore` or `@ts-expect-error` unless accompanied by a comment
  explaining the upstream issue and a TODO linking to its resolution.
- ESM only. No CommonJS. No `require()`.
- No implicit returns in functions that declare a return type.
- Prefer `type` over `interface` unless the interface is explicitly extended elsewhere.

## Folder contracts — never violate these
- features/<name>/ contains exactly: index.ts, prompt.ts, schema.ts, action.yml
- features/<name>/index.ts — orchestration only. No business logic, no inline prompts,
  no inline schemas.
- features/<name>/prompt.ts — string constants only. No API calls, no imports from
  other features, no imports from src/core/prompts/.
- features/<name>/schema.ts — Zod schema for this feature only. Nothing else.
- src/core/ — shared logic used by 2 or more features. If a utility is used by only
  one feature, it lives in that feature's folder.
- src/platform/llm/ — provider implementations and ProviderRegistry only.
- src/platform/github/ — GitHub API wrappers and ContextBuilder only.
- No file in src/ imports from features/.
- No file in features/<name>/ imports from features/<other-name>/.
- All imports inside features/<name>/ use relative paths.
- features/ lives at the repo root, never inside src/.
- src/platform/ lives inside src/, never at the repo root.
- src/core/index.ts must not exist — no barrel files.
- src/core/types/ must not exist — types live in the file that owns them
  or co-located with the layer they describe.
- Test files live in __tests__/ inside their source folder, named after
  the source file they test. One test file per source file, no exceptions.
- core.test.ts, utils.test.ts, or any test named after a folder is forbidden.

## Adding a feature
1. Create features/<name>/ with index.ts, prompt.ts, schema.ts, action.yml.
2. action.yml using path must be '../../dist/<name>/index.js'.
3. Register nothing globally — tsdown picks up features/*/index.ts automatically.
4. Run pnpm run bundle and verify dist/<name>/index.js was produced.

## Adding a provider
1. Create src/platform/llm/implementations/<provider>.ts.
2. Implement the LLMProvider interface exactly — no extra public methods.
3. Register the provider in src/platform/llm/index.ts via ProviderRegistry.
4. Run pnpm run bundle.

## Core contracts — never break these
- LLMProvider.generate() must never throw for recoverable errors. Return a
  GenerateResponse with an error field instead.
- generateStructured() owns retry and backoff logic. Features never implement
  their own retry.
- Logger must mask every secret before any log call. Never log a raw secret,
  token, or API key anywhere in the codebase.
- Every workflow entrypoint validates all env vars with Zod before any LLM or
  GitHub call is made. If validation fails, exit code 1, no partial execution.

## Error handling
- Never silently swallow errors. Either handle explicitly or propagate.
- Never use empty catch blocks.
- All async functions that can fail must return a typed result or throw a typed
  error — no untyped promise rejections.
- Process exit must always be exit code 1 on failure, 0 on success. Never exit
  with an undeclared code.

## Tests
- One test file per source file: index.test.ts, prompt.test.ts, schema.test.ts.
- Mock at the boundary only: LLMProvider interface, GitHub platform wrappers, env vars.
- vi.stubEnv() for env vars. vi.unstubAllEnvs() in afterEach. Never mutate
  process.env directly.
- Every mock must assert exact call arguments, not just that it was called.
- Every failure mode in the source has a corresponding test that triggers it and
  asserts the exact output.
- 100% statement, branch, function, and line coverage. No exceptions without a
  source-level comment and a vitest ignore directive on that specific line only.
- Never use arbitrary timeouts or sleeps. Mock time explicitly.
- No test depends on another test. Each test sets up and tears down its own state.
- Fixture values are realistic. Never use foo, bar, test, abc, or 123 for domain
  fields. Fake secrets follow the pattern: sk-test-xxxxxxxxxxxxxxxx.

## Security
- Never log secrets, tokens, API keys, or any value sourced from env vars marked
  as sensitive.
- All GitHub Action inputs are validated before use. Never trust raw
  github.event payloads without schema validation.
- All dependencies in action.yml are pinned to commit SHAs, never to tags or
  version ranges.
- LLM requests are wrapped in timeouts. No unbounded network calls.

## Code style
- No barrel index files.
- No default exports except in files where the framework requires it.
- Named exports only.
- No commented-out code. Delete it.
- No TODO comments unless they include a tracking reference.
- Functions do one thing. If a function has more than one reason to change,
  split it.
- No function longer than 40 lines. If it exceeds this, refactor before
  submitting.
- No file longer than 200 lines. If it exceeds this, split it.

## Output format
- Output a single unified diff per task.
- Do not output full file contents unless the file is being created for the
  first time.
- Do not explain what you are about to do. Do it, then state what changed in
  one line per file.
- If a task requires a source-level change to make something testable, output
  that diff first with a one-line explanation, then the test file.