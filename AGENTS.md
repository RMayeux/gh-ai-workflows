# AGENTS.md

## Project
gh-ai-workflows — provider-agnostic pnpm monorepo orchestrating LLM providers inside GitHub Actions. External repos consume compiled dist/ bundles.

## Graphify
Before exploring code structure, query the graph: `/graphify query "<q>"` or `/graphify explain "<Symbol>"`. If graphify-out/graph.json is missing/stale after structural changes, run `graphify init` (or `/graphify .`) first. Never commit graphify-out/ (see .graphifyignore).

## After every task — non-negotiable
Run these in order before marking any task done. If any step fails, fix it. Do not output a final diff until all four pass. Do not ask whether to run them. Always run them.
1. `pnpm tsc --noEmit`
2. `pnpm test`
3. `pnpm lint`

Bundle handled by `pnpm bundle` inside `.github/composites/setup/action.yml` (runs at CI setup). After a local task, bundle is only needed if you changed feature code — `pnpm run bundle` (or `pnpm run build:<feature>` for one).

## TypeScript
Strict always on. No `any`, no `!` (unless provably safe + comment), no `@ts-ignore`/`@ts-expect-error` without linked TODO. ESM only, no `require()`. No implicit returns. Prefer `type` over `interface`.

## Folder contracts — never violate these
- `features/<name>/`: exactly `index.ts` (orchestration only), `prompt.ts` (string constants only), `schema.ts` (Zod only), `action.yml`. Relative imports only inside a feature; never import across features; `src/` never imports `features/`.
- `src/core/` = logic shared by 2+ features.
- `src/platform/llm/` = providers + ProviderRegistry.
- `src/platform/github/` = GitHub wrappers + ContextBuilder.
- No barrels (`src/core/index.ts`), no `src/core/types/`.
- Tests in `__tests__/` beside their source, one file per source file — no `core.test.ts`/`utils.test.ts`.

## Core contracts
- `generate()` never throws for recoverable errors — return `GenerateResponse` with `error` field; `generateStructured()` owns all retry/backoff.
- Logger masks every secret before logging.
- Every entrypoint validates env with Zod before any LLM/GitHub call; fail → exit 1, no partial execution.

## Error handling
Never swallow errors or use empty catch blocks. Fallible async fns return a typed result or throw a typed error. Exit 1 on failure, 0 on success only.

## Security
Pin `action.yml` deps to commit SHAs. Validate all Action inputs; never trust raw `github.event` unvalidated. Wrap LLM calls in timeouts.

## Tests
Mock only at boundaries (LLMProvider, GitHub wrappers, env vars). Assert exact call args. 100% coverage (statement/branch/function/line). Mock time, no sleeps. Realistic fixtures (no foo/bar/123); fake secrets: `sk-test-xxxxxxxxxxxxxxxx`.

## Code style
No barrels, no default exports (except framework-required), named exports only, no commented-out code, no untracked TODOs. Max 40 lines/function, 200 lines/file.

## Output format
One unified diff per task. Full contents only for new files. No preamble — do the change, then one line per file stating what changed.
