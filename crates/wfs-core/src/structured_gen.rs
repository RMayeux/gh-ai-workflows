use serde::de::DeserializeOwned;

use crate::llm::LlmProvider;
use crate::types::{GenerateRequest, ModelCapability};

pub struct StructuredGenerationOptions {
    pub max_retries: u32,
    pub json_mode: bool,
}

impl Default for StructuredGenerationOptions {
    fn default() -> Self {
        Self {
            max_retries: 2,
            json_mode: true,
        }
    }
}

pub struct StructuredGenerationResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub attempts: u32,
    pub raw_response: String,
}

pub fn clean_json(text: &str) -> String {
    let trimmed = text.trim();

    if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
        return trimmed.to_string();
    }

    let fence_re = regex::Regex::new(r"```(?:json)?\s*([\s\S]*?)\s*```").expect("invalid regex");
    if let Some(caps) = fence_re.captures(trimmed) {
        if let Some(content) = caps.get(1).map(|m| m.as_str().trim()) {
            if serde_json::from_str::<serde_json::Value>(content).is_ok() {
                return content.to_string();
            }
        }
    }

    let first_brace = trimmed.find('{');
    let first_bracket = trimmed.find('[');

    let (start, end) = match (first_brace, first_bracket) {
        (Some(b), None) => (Some(b), trimmed.rfind('}')),
        (None, Some(br)) => (Some(br), trimmed.rfind(']')),
        (Some(b), Some(br)) if b < br => (Some(b), trimmed.rfind('}')),
        (Some(_), Some(br)) => (Some(br), trimmed.rfind(']')),
        (None, None) => return trimmed.to_string(),
    };

    if let (Some(s), Some(e)) = (start, end) {
        if e > s {
            let extracted = &trimmed[s..=e];
            if serde_json::from_str::<serde_json::Value>(extracted).is_ok() {
                return extracted.to_string();
            }
        }
    }

    trimmed.to_string()
}

fn backoff_delay(attempts: u32) -> std::time::Duration {
    std::time::Duration::from_millis(1000 * 2u64.pow(attempts))
}

async fn attempt_generate<T: DeserializeOwned>(
    provider: &dyn LlmProvider,
    request: &GenerateRequest,
    options: &StructuredGenerationOptions,
    attempts: u32,
) -> Result<(T, String), AttemptOutcome> {
    let json_mode = options.json_mode && provider.capabilities().capabilities.contains(&ModelCapability::JsonMode);
    let current_request = GenerateRequest { json_mode: Some(json_mode), ..request.clone() };

    match provider.generate(&current_request).await {
        Ok(response) => {
            let cleaned = clean_json(&response.text);
            match serde_json::from_str::<T>(&cleaned) {
                Ok(data) => Ok((data, response.text)),
                Err(e) => {
                    if attempts <= options.max_retries {
                        tokio::time::sleep(backoff_delay(attempts)).await;
                        Err(AttemptOutcome::Retry)
                    } else {
                        Err(AttemptOutcome::Fail(format!("Format Error: {e}")))
                    }
                }
            }
        }
        Err(e) => {
            if e.is_retryable() && attempts <= options.max_retries {
                tokio::time::sleep(backoff_delay(attempts)).await;
                Err(AttemptOutcome::Retry)
            } else {
                Err(AttemptOutcome::Fail(e.to_string()))
            }
        }
    }
}

enum AttemptOutcome {
    Retry,
    Fail(String),
}

pub async fn generate_structured<T: DeserializeOwned>(
    provider: &dyn LlmProvider,
    request: &GenerateRequest,
    options: StructuredGenerationOptions,
) -> StructuredGenerationResult<T> {
    let mut attempts = 0u32;
    let last_raw_response = String::new();

    loop {
        attempts += 1;

        match attempt_generate::<T>(provider, request, &options, attempts).await {
            Ok((data, raw)) => {
                return StructuredGenerationResult {
                    success: true,
                    data: Some(data),
                    error: None,
                    attempts,
                    raw_response: raw,
                };
            }
            Err(AttemptOutcome::Retry) => {
                continue;
            }
            Err(AttemptOutcome::Fail(error)) => {
                return StructuredGenerationResult {
                    success: false,
                    data: None,
                    error: Some(error),
                    attempts,
                    raw_response: last_raw_response,
                };
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::LlmError;
    use serde::Deserialize;

    #[test]
    fn test_clean_json_as_is() {
        let input = r#"{"key": "value"}"#;
        assert_eq!(clean_json(input), input);
    }

    #[test]
    fn test_clean_json_fence() {
        let input = "```json\n{\"key\": \"value\"}\n```";
        assert_eq!(clean_json(input), r#"{"key": "value"}"#);
    }

    #[test]
    fn test_clean_json_fence_no_lang() {
        let input = "```\n{\"key\": \"value\"}\n```";
        assert_eq!(clean_json(input), r#"{"key": "value"}"#);
    }

    #[test]
    fn test_clean_json_braces_in_text() {
        let input = "Here is the result: {\"key\": \"value\"}";
        assert_eq!(clean_json(input), r#"{"key": "value"}"#);
    }

    #[test]
    fn test_clean_json_array() {
        let input = "Result: [1, 2, 3]";
        assert_eq!(clean_json(input), "[1, 2, 3]");
    }

    #[derive(Debug, Deserialize, PartialEq)]
    struct TestData {
        name: String,
        value: u32,
    }

    #[tokio::test]
    async fn test_structured_gen_success() {
        let provider = crate::llm::mock::MockProvider::new(Some(
            r#"{"name": "test", "value": 42}"#.to_string(),
        ));
        let request = GenerateRequest {
            prompt: "generate".to_string(),
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            json_mode: Some(true),
            stop_sequences: None,
        };
        let result = generate_structured::<TestData>(&provider, &request, StructuredGenerationOptions::default()).await;
        assert!(result.success);
        assert_eq!(result.data.unwrap(), TestData { name: "test".to_string(), value: 42 });
    }

    #[tokio::test]
    async fn test_structured_gen_retry_on_parse_failure() {
        let provider = crate::llm::mock::MockProvider::new(Some(
            "not valid json".to_string(),
        ));
        let request = GenerateRequest {
            prompt: "generate".to_string(),
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            json_mode: Some(true),
            stop_sequences: None,
        };
        let result = generate_structured::<TestData>(&provider, &request, StructuredGenerationOptions {
            max_retries: 1,
            ..Default::default()
        }).await;
        assert!(!result.success);
        assert!(result.error.unwrap().contains("Format Error"));
        assert_eq!(result.attempts, 2);
    }

    #[tokio::test]
    async fn test_structured_gen_retry_on_llm_error() {
        let provider = crate::llm::mock::MockProvider::with_failures(
            Some(r#"{"name": "ok", "value": 1}"#.to_string()),
            2,
            LlmError::RateLimit("too many".to_string()),
        );
        let request = GenerateRequest {
            prompt: "generate".to_string(),
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            json_mode: Some(true),
            stop_sequences: None,
        };
        let result = generate_structured::<TestData>(&provider, &request, StructuredGenerationOptions {
            max_retries: 3,
            ..Default::default()
        }).await;
        assert!(result.success);
        assert_eq!(result.data.unwrap(), TestData { name: "ok".to_string(), value: 1 });
    }
}
