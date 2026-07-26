use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum LlmError {
    #[error("Rate limit: {0}")]
    RateLimit(String),
    #[error("Authentication: {0}")]
    Authentication(String),
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("Provider error: {0}")]
    Provider(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    #[error("Parse error: {0}")]
    Parse(String),
}

impl LlmError {
    pub fn is_retryable(&self) -> bool {
        matches!(self, LlmError::RateLimit(_) | LlmError::Timeout(_) | LlmError::Provider(_))
    }
}

#[derive(Error, Debug)]
pub enum PipelineError {
    #[error("GitHub API error: {0}")]
    GitHub(String),
    #[error("LLM error: {0}")]
    Llm(#[from] LlmError),
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("Environment error: {0}")]
    Env(String),
}
