use async_trait::async_trait;
use std::collections::HashSet;

use crate::error::LlmError;
use crate::types::{GenerateRequest, GenerateResponse, ProviderCapabilities};
use super::LlmProvider;

pub struct FallbackProvider {
    providers: Vec<Box<dyn LlmProvider>>,
    caps: ProviderCapabilities,
}

impl FallbackProvider {
    pub fn new(providers: Vec<Box<dyn LlmProvider>>) -> Self {
        let caps = providers
            .first()
            .map(|p| p.capabilities().clone())
            .unwrap_or(ProviderCapabilities {
                capabilities: HashSet::new(),
                max_tokens: 0,
                context_window: 0,
            });
        Self { providers, caps }
    }
}

#[async_trait]
impl LlmProvider for FallbackProvider {
    fn provider_id(&self) -> &'static str {
        "fallback"
    }

    fn capabilities(&self) -> &ProviderCapabilities {
        &self.caps
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError> {
        let mut errors = Vec::new();

        for provider in &self.providers {
            match provider.generate(request).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    errors.push(e.to_string());
                }
            }
        }

        Err(LlmError::Provider(format!(
            "All providers failed: {}",
            errors.join("; ")
        )))
    }
}
