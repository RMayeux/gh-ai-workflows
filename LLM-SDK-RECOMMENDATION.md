# LLM Provider SDK Recommendation (Rust)

**Date:** 2026-07-26
**Branch:** `research/rust-rewrite`
**Context:** Port of `gh-ai-workflows` from TypeScript → Rust. The TS version wraps OpenAI, Anthropic, Gemini, and Mistral behind a unified `LLMProvider` trait.

---

## 1. SDK-by-SDK Findings

### OpenAI — `async-openai` v0.41.1

| Aspect | Assessment |
|--------|-----------|
| **Crate** | [`async-openai`](https://crates.io/crates/async-openai) |
| **Stars / Maintenance** | 1.9k ⭐, 110 contributors, 107 releases, last push June 2026 |
| **Maturity** | Production-grade. Auto-generated from the OpenAI OpenAPI spec, covers Chat, Responses, Streaming, Assistants v2, Audio, Images, Embeddings, Batch, Realtime, and Administration APIs. |
| **Streaming** | SSE streaming via `eventsource-stream` and `tokio-stream`. Ergonomic `Stream` of chunks. Works on WASM (non-streaming). |
| **Error handling** | `thiserror`-based `OpenAIError` enum. Rate-limit retry with exponential backoff built in. Tower middleware for custom retry/logging. |
| **Recommendation** | **Use it.** The de-facto standard Rust OpenAI SDK. Feature-gated — pull only the APIs you need (`chat-completion`). |

**Cargo entry:**
```toml
async-openai = { version = "0.41", features = ["chat-completion"], default-features = false }
```

---

### Anthropic — Raw HTTP over `anthropic_rust` / `anthropic-rs-sdk`

| Aspect | Assessment |
|--------|-----------|
| **Official SDK?** | No. Anthropic has not released a Rust SDK ([issue #1559](https://github.com/anthropics/anthropic-sdk-python/issues/1559), open May 2026). |
| **Community crates** | Three notable ones: |
| `anthropic-rs` (roushou) | v0.1.7, last updated Sep 2024 — stale, Claude 3 only. |
| `anthropic_rust` (anthropics org) | v0.1.3, last updated Sep 2025 — published under the Anthropic GitHub org but not widely advertised; streaming, tools, multimodal. |
| `anthropic-rs-sdk` (epsjunior) | v0.1.0, May 2026 — early port of the Go SDK, non-streaming only, best type design (`secrecy::SecretString`, `wiremock` tests). |
| `anthropic-sdk-rust` (dimichgh) | v0.1.1, Jun 2025 — broadest feature coverage (streaming, tools, vision, files, batches), single maintainer. |
| **Recommendation** | **Raw HTTP** for this project. The crate landscape is fragmented, all crates are ≤v0.1, and our needs are simple (one-off chat completions with JSON mode). A 60-line `reqwest` wrapper avoids dependency churn and gives us full control over error handling. If Anthropic ships an official SDK, swap to it. |

**Minimal HTTP wrapper pattern (already done in TS — replicate in Rust):**
```rust
use reqwest::Client;
use serde_json::{json, Value};

struct AnthropicProvider {
    client: Client,
    api_key: secrecy::SecretString,
    model: String,
}

impl AnthropicProvider {
    async fn generate(&self, req: GenerateRequest) -> Result<GenerateResponse, LlmError> {
        let body = json!({
            "model": self.model,
            "max_tokens": req.max_tokens.unwrap_or(4096),
            "messages": [{"role": "user", "content": req.prompt}],
            "system": req.system_prompt,
        });
        let resp = self.client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", self.api_key.expose_secret())
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await?;
        // parse, normalise, return
    }
}
```

---

### Gemini — `gemini-rust` (or `gemini_client_rs` for transport)

| Aspect | Assessment |
|--------|-----------|
| **Crates** | `gemini-rust` ([flachesis/gemini-rust](https://github.com/flachesis/gemini-rust)) v1.7.1 — 32k downloads, 6 months active, feature-rich. `gemini_client_rs` ([adriftdev/gemini-client](https://github.com/adriftdev/gemini-client)) v0.10.0 — 13 stars, transport-focused, lower-level. `google-gemini-rs` v0.4.1 — 3.7k downloads, stalled since Jul 2025. |
| **Maturity** | `gemini-rust` is the clear leader: 1.7.1, 32k downloads, streaming, structured output, thinking modes, content caching, batch, embeddings. |
| **Streaming** | SSE-based, `Stream<Item = GenerationResponse>` chunks. |
| **Error handling** | Typed `GeminiError` enum via `thiserror`. |
| **Recommendation** | **Use `gemini-rust`.** The broadest API surface, most downloads, actively maintained. Feature-gate to `interactions` API for the modern path. |

**Cargo entry:**
```toml
gemini-rust = "1.7"
```

---

### Mistral — `mistralrs` (local inference SDK) vs raw HTTP (API client)

| Aspect | Assessment |
|--------|-----------|
| **Crate** | [`mistralrs`](https://crates.io/crates/mistralrs) v0.8.1 |
| **What it is** | A local LLM inference engine (candle-based), not an API client. Supports Mistral, Llama, Gemma, Phi, etc. locally via CUDA/Metal/CPU. |
| **For API access** | Mistral's API is OpenAI-compatible. Use `async-openai` with a custom base URL (`https://api.mistral.ai/v1`) and Mistral's model names. No separate SDK needed. |
| **Recommendation** | **Do NOT use `mistralrs`.** It's a local inference engine (7500⭐, very active) but wrong for this project — we call the Mistral API, not run models locally. Use `async-openai` pointed at Mistral's API. |

---

## 2. Unified Trait vs Per-Provider Types

**Recommendation: Unified trait, same pattern as the current TS codebase.**

All four providers serve the same job: `prompt → text + usage + finish_reason`. A single `LLMProvider` trait with per-provider structs implementing it keeps the architecture identical to the TS version and makes the `FallbackProvider` / `MockProvider` trivial.

**Proposed Rust trait:**

```rust
// src/llm/types.rs

use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ModelCapability {
    JsonMode,
    Streaming,
    FunctionCalling,
    Vision,
}

#[derive(Debug, Clone)]
pub struct ProviderCapabilities {
    pub capabilities: HashSet<ModelCapability>,
    pub max_tokens: u32,
    pub context_window: u32,
}

#[derive(Debug, Clone)]
pub struct GenerateRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub json_mode: bool,
    pub stop_sequences: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone)]
pub enum FinishReason {
    Stop,
    Length,
    ContentFilter,
    Error,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct GenerateResponse {
    pub text: String,
    pub usage: Usage,
    pub finish_reason: FinishReason,
}

#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync {
    fn provider_id(&self) -> &'static str;
    fn capabilities(&self) -> &ProviderCapabilities;

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError>;
}
```

**Error type:**

```rust
// src/llm/error.rs

#[derive(Debug, thiserror::Error)]
pub enum LlmError {
    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Rate limited: {0}")]
    RateLimit(String),

    #[error("Authentication failed: {0}")]
    Authentication(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Timeout after {0}s")]
    Timeout(u64),

    #[error("All fallback providers failed: {0}")]
    AllFallbackFailed(String),
}
```

---

## 3. Fallback / Mock Provider Pattern

**FallbackProvider** — same chain-of-responsibility as TS:
```rust
pub struct FallbackProvider {
    providers: Vec<Box<dyn LLMProvider>>,
}

#[async_trait]
impl LLMProvider for FallbackProvider {
    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError> {
        for provider in &self.providers {
            match provider.generate(request).await {
                Ok(resp) => return Ok(resp),
                Err(e) if matches!(&e, LlmError::RateLimit(_) | LlmError::Timeout(_)) => continue,
                Err(e) => return Err(e),
            }
        }
        Err(LlmError::AllFallbackFailed("all providers exhausted".into()))
    }
}
```

**MockProvider** — deterministic responses for CI:
```rust
pub struct MockProvider {
    response_text: String,
}

#[async_trait]
impl LLMProvider for MockProvider {
    fn provider_id(&self) -> &'static str { "mock" }
    fn capabilities(&self) -> &ProviderCapabilities { /* all capabilities */ }

    async fn generate(&self, _request: &GenerateRequest) -> Result<GenerateResponse, LlmError> {
        Ok(GenerateResponse {
            text: self.response_text.clone(),
            usage: Usage { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            finish_reason: FinishReason::Stop,
        })
    }
}
```

---

## 4. Architecture Diagram (Rust)

```
┌─────────────────────────────────────────────┐
│                 features/*/                  │
│          (index.ts → index.rs)               │
│    imports src/llm::{ LLMProvider, etc }     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              src/llm/                         │
│  trait LLMProvider + GenerateRequest/Response │
│  FallbackProvider ──── MockProvider           │
│  LlmError enum                                │
│  ProviderRegistry (BTreeMap<&str, Box<dyn>>) │
└───┬──────────┬──────────┬──────────┬──────────┘
    │          │          │          │
    ▼          ▼          ▼          ▼
 OpenAI    Anthropic   Gemini     Mistral
 (crate)   (reqwest)  (crate)    (async-openai
           raw HTTP              + base_url)
```

---

## 5. Summary Table

| Provider | SDK Approach | Crate | Version | Lines of wrapper code |
|----------|-------------|-------|---------|----------------------|
| OpenAI | `async-openai` (chat-completion feature) | `async-openai` | 0.41 | ~20 (config/newtype) |
| Anthropic | Raw HTTP via `reqwest` | — | — | ~60 |
| Gemini | `gemini-rust` (interactions feature) | `gemini-rust` | 1.7 | ~20 (config/newtype) |
| Mistral | `async-openai` with custom base URL | `async-openai` | 0.41 | ~15 (config) |
| Fallback | Chain-of-responsibility | crate-local | — | ~30 |
| Mock | Deterministic stub | crate-local | — | ~20 |

**Key decisions:**
1. Use `async-openai` for both OpenAI and Mistral (Mistral API is OpenAI-compatible).
2. Use raw HTTP for Anthropic — no mature SDK, and a thin wrapper is 60 lines.
3. Use `gemini-rust` for Gemini — most mature, 32k downloads, streaming + structured output.
4. Keep the unified `LLMProvider` trait matching the current TS architecture.
5. FallbackProvider and MockProvider remain in-crate, no external deps.
