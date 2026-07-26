use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashSet;

use crate::error::LlmError;
use crate::types::{FinishReason, GenerateRequest, GenerateResponse, ModelCapability, ProviderCapabilities, Usage};
use super::LlmProvider;

pub struct AnthropicProvider {
    api_key: String,
    model: String,
    client: Client,
    caps: ProviderCapabilities,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            client: Client::new(),
            caps: ProviderCapabilities {
                capabilities: HashSet::from([
                    ModelCapability::JsonMode,
                    ModelCapability::Streaming,
                    ModelCapability::Vision,
                ]),
                max_tokens: 4096,
                context_window: 200000,
            },
        }
    }
}

#[async_trait]
impl LlmProvider for AnthropicProvider {
    fn provider_id(&self) -> &'static str {
        "anthropic"
    }

    fn capabilities(&self) -> &ProviderCapabilities {
        &self.caps
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError> {
        let mut body = serde_json::json!({
            "model": self.model,
            "messages": [{"role": "user", "content": &request.prompt}],
            "max_tokens": request.max_tokens.unwrap_or(self.caps.max_tokens),
            "temperature": request.temperature.unwrap_or(0.7),
        });

        if let Some(ref system) = request.system_prompt {
            body["system"] = serde_json::json!(system);
        }

        if let Some(ref stop) = request.stop_sequences {
            if !stop.is_empty() {
                body["stop_sequences"] = serde_json::json!(stop);
            }
        }

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("Request failed: {e}")))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(normalize_error(&format!("{status}: {error_text}")));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse response: {e}")))?;

        let text = data["content"]
            .as_array()
            .map(|blocks| {
                blocks
                    .iter()
                    .filter(|b| b["type"] == "text")
                    .filter_map(|b| b["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        let input_tokens = data["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
        let output_tokens = data["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;

        let usage = Usage {
            prompt_tokens: input_tokens,
            completion_tokens: output_tokens,
            total_tokens: input_tokens + output_tokens,
        };

        let finish_reason = match data["stop_reason"].as_str() {
            Some("end_turn" | "stop_sequence") => FinishReason::Stop,
            Some("max_tokens") => FinishReason::Length,
            _ => FinishReason::Unknown,
        };

        Ok(GenerateResponse { text, usage, finish_reason })
    }
}

fn normalize_error(msg: &str) -> LlmError {
    if msg.contains("429") || msg.to_lowercase().contains("rate limit") {
        LlmError::RateLimit(msg.to_string())
    } else if msg.contains("401") || msg.contains("403") {
        LlmError::Authentication(msg.to_string())
    } else if msg.contains("400") {
        LlmError::InvalidRequest(msg.to_string())
    } else if msg.contains("timeout") || msg.to_lowercase().contains("timed out") {
        LlmError::Timeout(msg.to_string())
    } else {
        LlmError::Provider(msg.to_string())
    }
}
