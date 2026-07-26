use crate::error::LlmError;
use super::LlmProvider;
use super::anthropic::AnthropicProvider;
use super::fallback::FallbackProvider;
use super::gemini::GeminiProvider;
use super::mistral::MistralProvider;
use super::mock::MockProvider;
use super::openai::OpenAIProvider;

pub struct ProviderRegistry;

impl ProviderRegistry {
    pub fn create(
        id: &str,
        api_key: &str,
        model: &str,
    ) -> Result<Box<dyn LlmProvider>, LlmError> {
        match id {
            "openai" => Ok(Box::new(OpenAIProvider::new(
                api_key.to_string(),
                model.to_string(),
            ))),
            "anthropic" => Ok(Box::new(AnthropicProvider::new(
                api_key.to_string(),
                model.to_string(),
            ))),
            "gemini" => Ok(Box::new(GeminiProvider::new(
                api_key.to_string(),
                model.to_string(),
            ))),
            "mistral" => Ok(Box::new(MistralProvider::new(
                api_key.to_string(),
                model.to_string(),
            ))),
            "mock" => Ok(Box::new(MockProvider::new(None))),
            "fallback" => {
                let providers: Vec<Box<dyn LlmProvider>> = vec![
                    Box::new(OpenAIProvider::new(api_key.to_string(), model.to_string())),
                    Box::new(AnthropicProvider::new(api_key.to_string(), model.to_string())),
                ];
                Ok(Box::new(FallbackProvider::new(providers)))
            }
            other => Err(LlmError::InvalidRequest(format!(
                "Unknown provider: {other}"
            ))),
        }
    }
}
