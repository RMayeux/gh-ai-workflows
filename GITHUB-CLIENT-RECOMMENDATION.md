# GitHub API Client — Rust Rewrite Recommendation

## Recommendation: `octocrab` (first class), `reqwest` (escape hatch)

**`octocrab` v0.54.0** (latest) covers the exact surface the TypeScript
`GitHubClient` uses: PRs, comments, labels, issues, diffs — all via a
strongly typed semantic API backed by `tower`/`hyper`. Auth is a one-liner:

```rust
let crab = Octocrab::builder()
    .personal_token(std::env::var("GITHUB_TOKEN")?)
    .build()?;
```

## Coverage against existing operations

| Operation | octocrab API |
|---|---|
| `getPRDiff` | `.pulls(owner, repo).get_as::<String>(num)` with `application/vnd.github.diff` |
| `getPRDetails` | `.pulls(owner, repo).get(num)` |
| `getPRFiles` | `.pulls(owner, repo).list_files(num)` |
| `listPRs` / `listMergedPRs` | `.pulls(owner, repo).list().state(params::State::Open).send()` |
| `createPR` / `updatePR` | `.pulls(owner, repo).create(...)` / `.pulls(owner, repo).update(...)` |
| `postComment` / `listComments` | `.issues(owner, repo).create_comment(...)` / `.issues(owner, repo).list_comments(num)` |
| `updateComment` / `deleteComment` | `.issues(owner, repo).update_comment(...)` / `.issues(owner, repo).delete_comment(...)` |
| `addLabels` / `removeLabel` | `.issues(owner, repo).add_labels(num, &[...])` / `.issues(owner, repo).remove_label(num, name)` |

Every operation maps cleanly. The typed API is a win — no manual
`request<T>()`, no URL construction, no header boilerplate.

## Alternatives considered

| Option | Verdict |
|---|---|
| **`github-rs`** | Unmaintained since 2020. Skimpy API surface. Skip. |
| **Raw `reqwest`** | Viable, but duplicates all URL/pagination/auth plumbing octocrab already bakes. Keep as fallback for endpoints octocrab doesn't wrap (rare — it has a `_get`/`_post` raw layer). |
| **`oauth2` + hand-rolled** | Pointless: octocrab already supports personal token, OAuth app, and GitHub App installation auth. |

## Proposed trait interface

The Rust equivalent should be a trait so you can mock at the boundary in
tests. Model it on the operations the two features (`pr-review`,
`pr-metadata`) actually call — nothing speculative.

```rust
use octocrab::models;
use octocrab::params;

#[async_trait::async_trait]
pub trait GitHubClient: Send + Sync {
    async fn get_pr_diff(&self, owner: &str, repo: &str, num: u64) -> Result<String>;
    async fn get_pr_details(&self, owner: &str, repo: &str, num: u64) -> Result<models::PullRequest>;
    async fn get_pr_files(&self, owner: &str, repo: &str, num: u64) -> Result<Vec<models::FileDiff>>;
    async fn list_comments(&self, owner: &str, repo: &str, num: u64) -> Result<Vec<models::issues::Comment>>;
    async fn post_comment(&self, owner: &str, repo: &str, num: u64, body: &str) -> Result<models::issues::Comment>;
    async fn update_comment(&self, owner: &str, repo: &str, comment_id: u64, body: &str) -> Result<models::issues::Comment>;
    async fn delete_comment(&self, owner: &str, repo: &str, comment_id: u64) -> Result<()>;
    async fn add_labels(&self, owner: &str, repo: &str, num: u64, labels: &[&str]) -> Result<Vec<models::issues::Label>>;
    async fn remove_label(&self, owner: &str, repo: &str, num: u64, label: &str) -> Result<()>;
    async fn update_pr(&self, owner: &str, repo: &str, num: u64, title: Option<&str>, body: Option<&str>) -> Result<models::PullRequest>;
}
```

One implementation — `OctocrabClient` wrapping `Octocrab`. No abstract
factory, no second implementation until you write one. Feature entrypoints
take `&dyn GitHubClient`.

## Plan

1. `cargo add octocrab`
2. `src/github/client.rs` — trait, `OctocrabClient` impl (~80 lines)
3. `src/github/comments.rs` — `upsert_bot_comment` equivalent
4. `src/github/labels.rs` — `sync_labels` equivalent
5. Each feature's `handle_result` receives `&dyn GitHubClient`

## Pagination

octocrab returns `Page<T>` with `.next` links. The `list_comments` method
should loop over pages to match existing behavior (the TS client fetches all
pages at 100 per page). octocrab's `get_page()` handles this directly.

## Error handling

Return `octocrab::Error` directly from the trait (it's the crate's own
error type, not `anyhow`). Callers convert at their boundary if needed.
No custom error enum until two distinct error kinds need different handling.
