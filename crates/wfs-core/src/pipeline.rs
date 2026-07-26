use crate::error::LlmError;
use crate::github::GitHubClient;
use crate::llm::LlmProvider;
use crate::structured_gen::{generate_structured, StructuredGenerationOptions, StructuredGenerationResult};
use crate::types::GenerateRequest;

pub struct WorkflowConfig {
    pub github_token: String,
    pub llm: String,
    pub model: String,
    pub api_key: String,
    pub owner: String,
    pub repo: String,
    pub pr_number: u64,
}

impl WorkflowConfig {
    pub fn from_env() -> Result<Self, LlmError> {
        fn req(key: &str) -> Result<String, LlmError> {
            std::env::var(key).map_err(|_| LlmError::InvalidRequest(format!("Missing {key}")))
        }
        let pr_number = req("GITHUB_EVENT_PULL_REQUEST_NUMBER")?
            .parse()
            .map_err(|e| LlmError::InvalidRequest(format!("Invalid PR number: {e}")))?;
        Ok(Self {
            github_token: req("GITHUB_TOKEN")?,
            llm: req("LLM")?,
            model: req("MODEL")?,
            api_key: req("API_KEY")?,
            owner: req("GITHUB_REPOSITORY_OWNER")?,
            repo: req("GITHUB_REPOSITORY_NAME")?,
            pr_number,
        })
    }
}

pub struct PullRequestDetails {
    pub title: String,
    pub body: String,
    pub files: Vec<String>,
    pub additions: u32,
    pub deletions: u32,
    pub previous_comments: Vec<String>,
}

pub trait FeatureHandler<T>: Send + Sync
where
    T: serde::de::DeserializeOwned + Send + 'static,
{
    fn response_schema() -> serde_json::Value;
    fn build_prompt(diff: &str, details: &PullRequestDetails) -> GenerateRequest;
    fn handle_result(
        result: &T,
        details: &PullRequestDetails,
        gh: &dyn GitHubClient,
    ) -> Result<(), LlmError>;
}

pub enum PipelineOutcome {
    Success,
    Failure(String),
}

pub async fn run_pipeline<T, H>(
    owner: &str,
    repo: &str,
    pr_number: u64,
    provider: &dyn LlmProvider,
    gh: &dyn GitHubClient,
) -> Result<PipelineOutcome, LlmError>
where
    T: serde::de::DeserializeOwned + Send + 'static,
    H: FeatureHandler<T>,
{
    let diff = gh.get_pr_diff(owner, repo, pr_number).await?;
    let details = gh.get_pr_details(owner, repo, pr_number).await?;
    let files = gh.get_pr_files(owner, repo, pr_number).await?;
    let comments = gh.list_comments(owner, repo, pr_number).await?;

    let pr_details = PullRequestDetails {
        title: details.title,
        body: details.body.unwrap_or_default(),
        files,
        additions: details.additions.unwrap_or(0),
        deletions: details.deletions.unwrap_or(0),
        previous_comments: comments.into_iter().map(|c| c.body).collect(),
    };

    let request = H::build_prompt(&diff, &pr_details);

    let result: StructuredGenerationResult<T> = generate_structured::<T>(
        provider,
        &request,
        StructuredGenerationOptions::default(),
    )
    .await;

    if !result.success {
        return Ok(PipelineOutcome::Failure(
            result.error.unwrap_or_else(|| "Unknown error".to_string()),
        ));
    }

    if let Some(data) = result.data {
        H::handle_result(&data, &pr_details, gh)?;
    }

    Ok(PipelineOutcome::Success)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::mock::MockGitHubClient;
    use crate::github::PullRequest as GithubPR;
    use crate::llm::mock::MockProvider;

    struct TestHandler;

    #[derive(serde::Deserialize)]
    struct TestOutput {
        title: String,
    }

    impl FeatureHandler<TestOutput> for TestHandler {
        fn response_schema() -> serde_json::Value {
            serde_json::json!({"type": "object"})
        }

        fn build_prompt(_diff: &str, _details: &PullRequestDetails) -> GenerateRequest {
            GenerateRequest {
                prompt: "test".to_string(),
                system_prompt: None,
                temperature: None,
                max_tokens: None,
                json_mode: Some(true),
                stop_sequences: None,
            }
        }

        fn handle_result(_result: &TestOutput, _details: &PullRequestDetails, _gh: &dyn GitHubClient) -> Result<(), LlmError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_pipeline_success() {
        let gh = MockGitHubClient::new();
        gh.set_diff("owner/repo/1", "test diff".to_string());
        gh.set_details("owner/repo/1", GithubPR {
            number: 1,
            title: "Test PR".to_string(),
            body: Some("body".to_string()),
            state: "open".to_string(),
            additions: Some(10),
            deletions: Some(5),
        });
        gh.set_files("owner/repo/1", vec!["file1.rs".to_string()]);

        let provider = MockProvider::new(Some(r#"{"title": "new title"}"#.to_string()));

        let result = run_pipeline::<TestOutput, TestHandler>(
            "owner", "repo", 1, &provider, &gh,
        ).await;

        assert!(result.is_ok());
        match result.unwrap() {
            PipelineOutcome::Success => {}
            PipelineOutcome::Failure(e) => panic!("Expected success, got failure: {e}"),
        }
    }

    #[tokio::test]
    async fn test_pipeline_missing_diff() {
        let gh = MockGitHubClient::new();
        let provider = MockProvider::new(None);

        let result = run_pipeline::<TestOutput, TestHandler>(
            "owner", "repo", 999, &provider, &gh,
        ).await;

        assert!(result.is_err());
    }
}
