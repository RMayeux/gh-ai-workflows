# Cargo Workspace Recommendation — gh-ai-workflows Rust Rewrite

## Research Sources

- [Microsoft Rust Guidelines](https://microsoft.github.io/rust-guidelines/) — M-CARGO-WORKSPACE, M-CRATES-IN-WORKSPACE, M-CRATES-FLAT-FOLDER
- [Biome](https://github.com/biomejs/biome) — real monorepo, 130+ crates under `crates/`, xtask/ for tooling
- [rust-analyzer](https://github.com/rust-lang/rust-analyzer) — flat `crates/` layout, deep module split
- [Cargo Book — Workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html) — canonical reference
- [Production Rust Workspaces (Reintech)](https://reintech.io/blog/cargo-workspace-best-practices-large-rust-projects) — separation by function, not layer
- [DevPro Portal (2025)](https://devproportal.com/languages/rust/mastering-cargo-workspaces-architecting-scalable-rust-projects/) — `[workspace.dependencies]`, `[workspace.lints]`, `[workspace.package]`, feature flags

## Key Findings

### 1. Virtual workspace root (no root package)

All major monorepos (Biome, rust-analyzer, etc.) use a **virtual manifest** — the root `Cargo.toml` has `[workspace]` but no `[package]`. This avoids accidentally publishing the root and makes every member equal.

### 2. Flat `crates/` layout with glob

Both Biome and rust-analyzer use `members = ["crates/*"]` with optional entries for xtask/ tooling. Microsoft guidelines endorse a single `crates/` sibling directory for projects up to ~2 dozen crates. This repo will stay small (~7–8 crates) so flat layout is correct.

### 3. `[workspace.dependencies]` for version centralisation

Every source agrees: define all dependency versions once in the root, reference with `workspace = true` in each member. This eliminates version drift, deduplicates build artifacts, and makes `cargo update` atomic across the workspace.

### 4. Split shared lib into domain-aligned crates

The TS codebase has a `src/core/`, `src/platform/llm/`, `src/platform/github/` split. The Rust equivalent should mirror this:

| Crate | Role | Depends on |
|---|---|---|
| `wfs-core` | Domain models, pipeline orchestration, prompt rendering | — |
| `wfs-llm` | LLM provider interface + implementations (OpenAI, Anthropic, etc.) | `wfs-core` |
| `wfs-github` | GitHub API wrappers, context building | `wfs-core` |
| `pr-metadata` | Binary entrypoint | `wfs-core`, `wfs-llm`, `wfs-github` |
| `pr-review` | Binary entrypoint | `wfs-core`, `wfs-llm`, `wfs-github` |
| `doc-sync` | Binary entrypoint | `wfs-core`, `wfs-llm`, `wfs-github` |
| `qa-test-cases` | Binary entrypoint | `wfs-core`, `wfs-llm`, `wfs-github` |

Rationale: crate boundaries are compilation units. When `wfs-llm` changes, only downstream binaries rebuild, not `wfs-github`. This matches the existing TS module boundaries and keeps the crate graph a DAG.

The alternative (single `wfs-lib` crate) is simpler to start but creates a coupling point that will accumulate unrelated code. Karpathy guidelines and ponytail both say "start simpler" — so **start with a single `wfs-core` lib crate** that holds everything, then split only when the crate exceeds ~2000 lines or when you need independent versioning. The crate layout below reflects the single-lib start to keep things lazy.

### 5. Minimal binary crates

Each binary crate contains:
- `src/main.rs` — ~5 lines: validate env vars, call `wfs_core::pipeline::run()`, handle exit code
- `Cargo.toml` — depends only on `wfs-core` and maybe `tokio` (if async runtime needed)

All business logic, LLM calls, and GitHub API interactions live in `wfs-core`. This matches the existing TS contract where `features/<name>/index.ts` is orchestration-only.

### 6. Release profile + lints at workspace level

```toml
[workspace.lints.clippy]
pedantic = "warn"
unwrap_used = "deny"

[profile.release]
lto = "fat"
codegen-units = 1
strip = "symbols"
```

### 7. xtask/ for codegen and tooling

Follow Biome's pattern: `xtask/codegen` for schema generation, `xtask/coverage` for test coverage reporting. These are workspace members but not shipped.

## Recommended Directory Structure

```
/
├── Cargo.toml              # workspace root (virtual manifest)
├── Cargo.lock
├── crates/
│   ├── wfs-core/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── pipeline.rs
│   │       ├── prompt/
│   │       └── llm/
│   │       └── github/
│   ├── pr-metadata/
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   ├── pr-review/
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   ├── doc-sync/
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   └── qa-test-cases/
│       ├── Cargo.toml
│       └── src/main.rs
├── xtask/
│   └── codegen/
│       ├── Cargo.toml
│       └── src/main.rs
└── features/               # keep for reference, not compiled
```

## Recommended Cargo.toml

### Root `Cargo.toml`

```toml
[workspace]
resolver = "2"
members = [
  "crates/*",
  "xtask/codegen",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
license = "MIT"
authors = ["RMayeux"]
repository = "https://github.com/RMayeux/gh-ai-workflows"

[workspace.dependencies]
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
thiserror = "2"
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
regex = "1"
clap = { version = "4", features = ["derive"] }
zod = "0.1"  # placeholder — Rust equivalent of Zod for env validation

[workspace.lints.clippy]
pedantic = "warn"
unwrap_used = "deny"
nursery = "warn"

[profile.release]
lto = "fat"
codegen-units = 1
strip = "symbols"
```

### Member `crates/wfs-core/Cargo.toml`

```toml
[package]
name = "wfs-core"
version.workspace = true
edition.workspace = true
license.workspace = true

[lints]
workspace = true

[dependencies]
serde.workspace = true
serde_json.workspace = true
anyhow.workspace = true
thiserror.workspace = true
tracing.workspace = true
regex.workspace = true
```

### Member `crates/pr-metadata/Cargo.toml`

```toml
[package]
name = "pr-metadata"
version.workspace = true
edition.workspace = true
license.workspace = true

[lints]
workspace = true

[dependencies]
wfs-core = { path = "../wfs-core" }
tokio.workspace = true
anyhow.workspace = true
clap.workspace = true
```

## Migration Strategy

1. Create the workspace with `wfs-core` only — get cargo check passing
2. Port `src/core/` logic into `wfs-core/src/`
3. Port `src/platform/llm/` and `src/platform/github/` into `wfs-core/src/llm/` and `wfs-core/src/github/`
4. Add each binary crate one at a time, wiring to the existing Action entrypoint
5. Split `wfs-core` into `wfs-core` + `wfs-llm` + `wfs-github` **only if**:
   - `wfs-core/src/lib.rs` exceeds 2000 lines, OR
   - LLM provider changes require releasing a new version independently, OR
   - CI build times degrade from unnecessary recompilation of unrelated modules
