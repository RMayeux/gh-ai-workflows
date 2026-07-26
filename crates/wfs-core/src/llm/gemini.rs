use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashSet;

use crate::error::{normalize_llm_error, LlmError};
use crate::types::{FinishReason, GenerateRequest, GenerateResponse, ModelCapability, ProviderCapabilities, Usage};
use super::LlmProvider;

pub struct GeminiProvider {
    api_key: String,
    model: String,
    client: Client,
    caps: ProviderCapabilities,
}

impl GeminiProvider {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            client: Client::new(),
            caps: ProviderCapabilities {
                capabilities: HashSet::from([
                    ModelCapability::JsonMode,
                    ModelCapability::Streaming,
                    ModelCapability::FunctionCalling,
                    ModelCapability::Vision,
                ]),
                max_tokens: 8192,
                context_window: 1000000,
            },
        }
    }
}

#[async_trait]
impl LlmProvider for GeminiProvider {
    fn provider_id(&self) -> &'static str {
        "gemini"
    }

    fn capabilities(&self) -> &ProviderCapabilities {
        &self.caps
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let mut body = serde_json::json!({
            "contents": [{"role": "user", "parts": [{"text": &request.prompt}]}],
            "generationConfig": {
                "temperature": request.temperature.unwrap_or(0.7),
                "maxOutputTokens": request.max_tokens.unwrap_or(self.caps.max_tokens),
            }
        });

        if request.json_mode.unwrap_or(false) {
            body["generationConfig"]["responseMimeType"] = serde_json::json!("application/json");
        }

        if let Some(ref system) = request.system_prompt {
            body["system_instruction"] = serde_json::json!({"parts": [{"text": system}]});
        }

        if let Some(ref stop) = request.stop_sequences {
            if !stop.is_empty() {
                body["generationConfig"]["stopSequences"] = serde_json::json!(stop);
            }
        }

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| normalize_llm_error(&format!("Request failed: {e}")))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(normalize_llm_error(&format!("{status}: {error_text}")));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse response: {e}")))?;

        let candidate = &data["candidates"][0];

        let text = candidate["content"]["parts"]
            .as_array()
            .map(|parts| {
                parts
                    .iter()
                    .filter(|p| p.get("thought") != Some(&serde_json::Value::Bool(true)))
                    .filter_map(|p| p["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        let usage_data = data["usageMetadata"]
            .as_object()
            .or_else(|| candidate["usageMetadata"].as_object());
        let usage = match usage_data {
            Some(meta) => Usage {
                prompt_tokens: meta.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                completion_tokens: meta.get("candidatesTokenCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                total_tokens: meta.get("totalTokenCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            },
            None => Usage { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };

        let finish_reason = match candidate["finishReason"].as_str() {
            Some("STOP") => FinishReason::Stop,
            Some("MAX_TOKENS") => FinishReason::Length,
            Some("SAFETY") => FinishReason::ContentFilter,
            _ => FinishReason::Unknown,
        };

        Ok(GenerateResponse { text, usage, finish_reason })
    }
}

