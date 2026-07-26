use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashSet;

use crate::error::LlmError;
use crate::types::{FinishReason, GenerateRequest, GenerateResponse, ModelCapability, ProviderCapabilities, Usage};
use super::LlmProvider;

pub struct OpenAIProvider {
    api_key: String,
    model: String,
    client: Client,
    caps: ProviderCapabilities,
}

impl OpenAIProvider {
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
                max_tokens: 4096,
                context_window: 128000,
            },
        }
    }
}

#[async_trait]
impl LlmProvider for OpenAIProvider {
    fn provider_id(&self) -> &'static str {
        "openai"
    }

    fn capabilities(&self) -> &ProviderCapabilities {
        &self.caps
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError> {
        let mut messages = Vec::new();
        if let Some(ref system) = request.system_prompt {
            messages.push(serde_json::json!({"role": "system", "content": system}));
        }
        messages.push(serde_json::json!({"role": "user", "content": &request.prompt}));

        let mut body = serde_json::json!({
            "model": self.model,
            "messages": messages,
            "temperature": request.temperature.unwrap_or(0.7),
            "max_tokens": request.max_tokens.unwrap_or(self.caps.max_tokens),
        });

        if request.json_mode.unwrap_or(false) {
            body["response_format"] = serde_json::json!({"type": "json_object"});
        }

        if let Some(ref stop) = request.stop_sequences {
            if !stop.is_empty() {
                body["stop"] = serde_json::json!(stop);
            }
        }

        let response = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| normalize_error(&format!("Request failed: {e}")))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(normalize_error(&format!("{status}: {error_text}")));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse response: {e}")))?;

        let choice = data["choices"][0].clone();
        let text = choice["message"]["content"]
            .as_str()
            .unwrap_or("")
            .trim()
            .to_string();

        let usage = Usage {
            prompt_tokens: data["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: data["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: data["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        };

        let finish_reason = match choice["finish_reason"].as_str() {
            Some("stop") => FinishReason::Stop,
            Some("length") => FinishReason::Length,
            Some("content_filter") => FinishReason::ContentFilter,
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
    } else if msg.contains("400") || msg.contains("422") {
        LlmError::InvalidRequest(msg.to_string())
    } else if msg.contains("timeout") || msg.to_lowercase().contains("timed out") {
        LlmError::Timeout(msg.to_string())
    } else {
        LlmError::Provider(msg.to_string())
    }
}
