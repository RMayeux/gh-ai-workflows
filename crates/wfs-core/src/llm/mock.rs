use async_trait::async_trait;
use std::collections::HashSet;
use std::sync::atomic::{AtomicU32, Ordering};

use crate::error::LlmError;
use crate::types::{FinishReason, GenerateRequest, GenerateResponse, ModelCapability, ProviderCapabilities, Usage};
use super::LlmProvider;

pub struct MockProvider {
    response_text: Option<String>,
    caps: ProviderCapabilities,
    fail_count: u32,
    fail_with: Option<LlmError>,
    call_count: AtomicU32,
}

impl MockProvider {
    pub fn new(response_text: Option<String>) -> Self {
        Self {
            response_text,
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
            fail_count: 0,
            fail_with: None,
            call_count: AtomicU32::new(0),
        }
    }

    pub fn with_failures(response_text: Option<String>, fail_count: u32, fail_with: LlmError) -> Self {
        Self {
            response_text,
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
            fail_count,
            fail_with: Some(fail_with),
            call_count: AtomicU32::new(0),
        }
    }

    pub fn call_count(&self) -> u32 {
        self.call_count.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl LlmProvider for MockProvider {
    fn provider_id(&self) -> &'static str {
        "mock"
    }

    fn capabilities(&self) -> &ProviderCapabilities {
        &self.caps
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError> {
        let call = self.call_count.fetch_add(1, Ordering::SeqCst);

        if let Some(ref fail_with) = self.fail_with {
            if call < self.fail_count {
                return Err(fail_with.clone());
            }
        }

        Ok(GenerateResponse {
            text: self
                .response_text
                .clone()
                .unwrap_or_else(|| format!("Mock response to: {}", request.prompt)),
            usage: Usage {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
            finish_reason: FinishReason::Stop,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::GenerateRequest;

    #[tokio::test]
    async fn test_mock_provider_basic() {
        let provider = MockProvider::new(Some("test response".to_string()));
        let request = GenerateRequest {
            prompt: "hello".to_string(),
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            json_mode: None,
            stop_sequences: None,
        };
        let response = provider.generate(&request).await.unwrap();
        assert_eq!(response.text, "test response");
        assert_eq!(response.usage.total_tokens, 30);
    }

    #[tokio::test]
    async fn test_mock_provider_fail_then_succeed() {
        let provider = MockProvider::with_failures(
            Some("success".to_string()),
            2,
            LlmError::RateLimit("test".to_string()),
        );
        let request = GenerateRequest {
            prompt: "hello".to_string(),
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            json_mode: None,
            stop_sequences: None,
        };

        // First call fails
        let result = provider.generate(&request).await;
        assert!(result.is_err());

        // Second call fails
        let result = provider.generate(&request).await;
        assert!(result.is_err());

        // Third call succeeds
        let result = provider.generate(&request).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().text, "success");

        assert_eq!(provider.call_count(), 3);
    }
}
