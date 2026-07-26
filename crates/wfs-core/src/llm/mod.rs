pub mod anthropic;
pub mod fallback;
pub mod gemini;
pub mod mock;
pub mod mistral;
pub mod openai;
pub mod registry;

use async_trait::async_trait;
use crate::error::LlmError;
use crate::types::{GenerateRequest, GenerateResponse, ProviderCapabilities};

#[async_trait]
pub trait LlmProvider: Send + Sync {
    fn provider_id(&self) -> &'static str;
    fn capabilities(&self) -> &ProviderCapabilities;
    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, LlmError>;
}
