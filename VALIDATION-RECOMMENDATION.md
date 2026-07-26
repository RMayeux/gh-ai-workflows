# Rust Rewrite — Validation & Structured Output Recommendation

## 1. Input Validation — `serde` + `validator`

**TypeScript equivalent:** `z.object({...})` in `workflow-inputs.ts` — schema parsing with coercion
(`z.coerce.number()`, `z.preprocess()`).

**Rust approach:**

```
Cargo.toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
validator = { version = "0.19", features = ["derive"] }
```

| TypeScript Zod | Rust |
|---|---|
| `z.string().min(1)` | `#[validate(length(min = 1))]` |
| `z.coerce.number().int().positive()` | `deserialize_with` + `#[validate(range(min = 1))]` |
| `z.enum([...])` | `serde_repr` or custom `Deserialize` |
| `z.preprocess(...)` | Custom `deserialize_with` |

**Coercion from env strings** — GHA passes everything as strings. Use a
`deserialize_with` helper that parses `"true"` → `bool`, string digits →
`i32`, etc. One function, not a framework.

**Ponytail:** Skip `validator` for now. `serde`'s `#[serde(deserialize_with)]`
handles coercion + range checks inline. Add `validator` only when you need
cross-field validation (e.g., `end > start`).

## 2. JSON Schema Generation — `schemars`

**TypeScript equivalent:** `zod-to-json-schema` — converts runtime Zod
schemas to JSON Schema for provider `response_schema` parameter (enforced
decoding by Gemini/OpenAI).

**Rust approach:**

```
Cargo.toml
schemars = { version = "1", features = ["chrono"] }
```

```rust
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, JsonSchema)]
pub struct PRReview {
    pub summary: String,
    pub issues: Vec<Issue>,
    #[serde(default)]
    pub approved: bool,
}

#[derive(Serialize, Deserialize, JsonSchema)]
pub struct Issue {
    pub severity: String,
    pub status: String,
    pub description: String,
}
```

`schemars::schema_for::<T>()` → `serde_json::to_value()` → send as
`response_schema` to Gemini/OpenAI.

**Key difference:** Zod validates at runtime. `serde` validates at
deserialization. `schemars` is a compile-time macro, not a runtime
construct. You cannot dynamically construct schemas — each struct must
exist. This matches the existing codebase structure (one `schema.ts` per
feature → one `#[derive(JsonSchema)]` struct per feature).

## 3. Retry/Backoff Structured Generation — the core loop

**TypeScript equivalent:** `generateStructured<T>()` in
`structured-generation.ts` — the central pattern of the project:

1. Call LLM provider with `jsonMode`
2. Extract JSON from response with `cleanJson()`
3. Parse + validate with Zod schema
4. Retry on parse failure (exponential backoff, 2s/4s/8s)
5. Retry on transient HTTP errors (rate limit, 5xx)
6. Return `StructuredGenerationResult<T>` with `success`, `data`, `error`,
   `attempts`, `rawResponse`

**Rust approach:**

```rust
pub struct StructuredGenerationResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub attempts: u32,
    pub raw_response: String,
}

pub async fn generate_structured<T: DeserializeOwned>(
    provider: &dyn LlmProvider,
    request: GenerateRequest,
    options: StructuredGenerationOptions,
) -> StructuredGenerationResult<T> {
    let max_retries = options.max_retries.unwrap_or(2);
    let mut attempts = 0;
    let mut last_raw = String::new();

    while attempts <= max_retries {
        attempts += 1;
        let response = match provider.generate(&request).await {
            Ok(r) => r,
            Err(e) if e.is_retryable() && attempts <= max_retries => {
                tokio::time::sleep(Duration::from_millis(1000 * 2u64.pow(attempts))).await;
                continue;
            }
            Err(e) => return StructuredGenerationResult {
                success: false,
                error: Some(e.to_string()),
                attempts,
                raw_response: last_raw,
                data: None,
            },
        };

        last_raw = response.text.clone();
        let cleaned = clean_json(&response.text);

        match serde_json::from_str::<T>(&cleaned) {
            Ok(data) => return StructuredGenerationResult {
                success: true,
                data: Some(data),
                attempts,
                raw_response: last_raw,
                error: None,
            },
            Err(e) if attempts <= max_retries => {
                tokio::time::sleep(Duration::from_millis(1000 * 2u64.pow(attempts))).await;
                continue;
            }
            Err(e) => return StructuredGenerationResult {
                success: false,
                error: Some(format!("Parse error: {}", e)),
                attempts,
                raw_response: last_raw,
                data: None,
            },
        }
    }

    StructuredGenerationResult {
        success: false,
        error: Some("Max retries reached".into()),
        attempts,
        raw_response: last_raw,
        data: None,
    }
}
```

**Exponential backoff:** `2^attempt * 1000ms` — matches TS exactly.

## 4. JSON Extraction — `cleanJson()` equivalent

**TypeScript:** Strips markdown fences (` ```json ... ``` `), finds first
`{`/`[` and last `}`/`]`.

**Rust approach:** Same regex, same logic. One function, 40 lines.

```rust
use regex::Regex;

pub fn clean_json(text: &str) -> String {
    let trimmed = text.trim();

    // 1. Try as-is
    if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
        return trimmed.to_string();
    }

    // 2. Extract from ```json ... ``` fence
    let fence_re = Regex::new(r"(?s)```(?:json)?\s*([\s\S]*?)\s*```").unwrap();
    if let Some(caps) = fence_re.captures(trimmed) {
        let content = caps.get(1).unwrap().as_str().trim();
        if serde_json::from_str::<serde_json::Value>(content).is_ok() {
            return content.to_string();
        }
    }

    // 3. Last resort: find first '{'/'[' and last '}'/']'
    let first_brace = trimmed.find('{');
    let first_bracket = trimmed.find('[');
    let start = match (first_brace, first_bracket) {
        (Some(b), None) | (None, Some(b)) => b,
        (Some(a), Some(b)) => a.min(b),
        _ => return trimmed.to_string(),
    };
    let end = if trimmed.as_bytes()[start] == b'{' {
        trimmed.rfind('}').unwrap_or(start)
    } else {
        trimmed.rfind(']').unwrap_or(start)
    };
    if end > start {
        let extracted = &trimmed[start..=end];
        if serde_json::from_str::<serde_json::Value>(extracted).is_ok() {
            return extracted.to_string();
        }
    }

    trimmed.to_string()
}
```

**Ponytail:** `regex` is already effectively stdlib for Rust projects. Add
when the first LLM wraps output in fences — you will hit this day one.

## 5. Error Handling — `thiserror`

**TypeScript equivalent:** Class hierarchy in `llm-errors.ts` — `LLMError`
with `retryable` flag, `RateLimitError`, `InvalidRequestError`,
`ProviderError`.

**Rust approach:**

```
Cargo.toml
thiserror = "2"
```

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LlmError {
    #[error("Rate limit exceeded")]
    RateLimit(#[source] Option<Box<dyn std::error::Error + Send>>),

    #[error("Authentication failed")]
    Authentication(#[source] Option<Box<dyn std::error::Error + Send>>),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Provider error: {0}")]
    Provider(String, #[source] Option<Box<dyn std::error::Error + Send>>),

    #[error("Timeout after {0}ms")]
    Timeout(u64),

    #[error("Parse error: {0}")]
    Parse(String, #[source] serde_json::Error),
}

impl LlmError {
    pub fn is_retryable(&self) -> bool {
        matches!(self, LlmError::RateLimit(_) | LlmError::Provider(..) | LlmError::Timeout(_))
    }
}
```

No `retryable` boolean field — encode it in the variant. `match` is
exhaustive, safer, and zero-cost.

## Package Summary

```
[profile.release]
lto = true

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
schemars = "1"
thiserror = "2"
regex = "1"
tokio = { version = "1", features = ["full"] }
validator = { version = "0.19", features = ["derive"], optional = true }
```

## Architecture Mapping

| Layer | TypeScript | Rust |
|---|---|---|
| Feature schema | `features/pr-review/schema.ts` (Zod) | `features/pr-review/model.rs` (`#[derive(Serialize, Deserialize, JsonSchema)]`) |
| Feature prompt | `prompt.ts` (string constants) | `prompt.rs` (`const` + `include_str!`) |
| Feature orchestration | `index.ts` (imports pipeline) | `mod.rs` (imports pipeline) |
| Env validation | `workflow-inputs.ts` (Zod parse) | `serde` deserialization from `env!` / `std::env::var` |
| LLM provider trait | `LLMProvider` interface | `trait LlmProvider { async fn generate(...) -> Result<..> }` |
| Structured generation | `generateStructured<T>()` | `generate_structured::<T>()` (same retry/backoff) |
| Provider registry | `ProviderRegistry.create()` | `enum ProviderKind` + factory fn |
| Error types | `LLMError` class hierarchy | `LlmError` enum (thiserror) |

## Decision: Skip `validator` Crate

`validator` adds derive macros for field-level checks (`length`, `range`,
`email`). For env-var deserialization in GHA, `serde`'s built-in
`deserialize_with` + `#[serde(try_from = "...")]` handles coercion and
bounds. `validator` justifies its weight when you have cross-field
validation (e.g., `start_date < end_date`) or complex nested structs. For
flat env-var structs — YAGNI.

Add it when you validate complex domain types inside features, not for input
parsing.

## Decision: `schemars` Is the Right Crate

Only mature Rust crate for JSON Schema generation from types. Used by
`actix-openapi`, `utoipa`, `salvo`. `#[derive(JsonSchema)]` works
alongside `#[derive(Serialize, Deserialize)]` on the same struct.

`zod-to-json-schema` is a runtime visitor over a Zod schema tree. Rust has
no runtime type information for serde — `schemars` is a proc-macro that
walks your types at compile time. The trade-off: no dynamic schema
construction. The gain: zero runtime cost, no schema "parse" step.

## Structured Generation Flow (Rust)

```
┌─────────────────────────────┐
│ generate_structured<T>()     │
│  while attempts ≤ maxRetries │
│  ┌─────────────────────────┐ │
│  │ provider.generate()     │ │
│  │  → LlmError?            │ │
│  │  → retryable? → sleep() │ │
│  │  → fatal? → return      │ │
│  ├─────────────────────────┤ │
│  │ clean_json(response)    │ │
│  │  → strip fences, braces │ │
│  ├─────────────────────────┤ │
│  │ serde_json::from_str<T> │ │
│  │  → Ok → return          │ │
│  │  → Err + retries left   │ │
│  │    → sleep(2^a * 1s)    │ │
│  │    → continue           │ │
│  │  → Err + no retries     │ │
│  │    → return error       │ │
│  └─────────────────────────┘ │
└─────────────────────────────┘
```

## Feature Folder Contract (Rust)

```
features/pr-review/
├── mod.rs       # orchestration (was index.ts)
├── prompt.rs    # string constants (was prompt.ts)
├── model.rs     # #[derive(Serialize, Deserialize, JsonSchema)] (was schema.ts)
└── action.yml   # unchanged (YAML)
```

`schemars` replaces both Zod and `zod-to-json-schema` with one derive.
`serde` replaces Zod's parse/coercion. `thiserror` replaces the class
hierarchy.
