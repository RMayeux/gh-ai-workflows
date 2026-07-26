use wfs_core::error::LlmError;
use wfs_core::github::labels::sync_labels;
use wfs_core::github::octocrab::OctocrabClient;
use wfs_core::github::GitHubClient;
use wfs_core::llm::registry::ProviderRegistry;
use wfs_core::pipeline::{run_pipeline, FeatureHandler, PullRequestDetails};
use wfs_core::types::GenerateRequest;

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct PrMetadataOutput {
    title: String,
    body: String,
    #[serde(rename = "change_type")]
    change_type: String,
    breaking: bool,
    #[serde(rename = "doc_impact")]
    doc_impact: bool,
}

struct PrMetadataHandler;

impl FeatureHandler<PrMetadataOutput> for PrMetadataHandler {
    fn response_schema() -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "title": { "type": "string", "minLength": 1, "maxLength": 72 },
                "body": { "type": "string", "minLength": 1 },
                "change_type": {
                    "type": "string",
                    "enum": ["feat", "fix", "refactor", "perf", "docs", "test", "build", "ci", "chore"]
                },
                "breaking": { "type": "boolean" },
                "doc_impact": { "type": "boolean" }
            },
            "required": ["title", "body", "change_type"]
        })
    }

    fn build_prompt(diff: &str, details: &PullRequestDetails) -> GenerateRequest {
        GenerateRequest {
            prompt: format!(
                "# CHANGED FILES\n{}\n\n# CODE DIFF\n{}",
                details.files.join("\\n"),
                diff
            ),
            system_prompt: Some(concat!(
                "You are a staff engineer analyzing a PR diff. Return ONLY valid JSON with this schema:\n",
                r#"{"title":"string (max 72 chars)","body":"string","change_type":"feat|fix|refactor|perf|docs|test|build|ci|chore"}"#,
                "\n\nNo code fences, no preamble, no trailing commas.\n",
                "- Title: conventional commit type(domain): description, under 72 chars. Pick the domain with highest business impact.\n",
                "- Body: \"## What changed\" (one paragraph, feature-focused, no file lists). If behavioral features changed add \"## Impacted features\" table (Domain | Feature | Impact).\n",
                "- Change type: infer from diff intent.\n",
                "- Think features not files. What can a user do differently?\n",
                "- Never list files, routes, or dependency bumps. No hallucination."
            ).to_string()),
            temperature: None,
            max_tokens: None,
            json_mode: Some(true),
            stop_sequences: None,
        }
    }

    fn handle_result(result: &PrMetadataOutput, details: &PullRequestDetails, gh: &dyn GitHubClient) -> Result<(), LlmError> {
        let owner = std::env::var("GITHUB_REPOSITORY_OWNER").unwrap_or_default();
        let repo = std::env::var("GITHUB_REPOSITORY_NAME").unwrap_or_default();
        let pr_number: u64 = std::env::var("GITHUB_EVENT_PULL_REQUEST_NUMBER")
            .unwrap_or_default()
            .parse()
            .map_err(|e| LlmError::InvalidRequest(format!("Invalid PR number: {e}")))?;

        let owner_c = owner.clone();
        let repo_c = repo.clone();

        let rt = tokio::runtime::Runtime::new().map_err(|e| LlmError::Provider(format!("Runtime error: {e}")))?;

        rt.block_on(gh.update_pr(&owner_c, &repo_c, pr_number, Some(&result.title), Some(&result.body)))
            .map_err(|e| LlmError::Provider(format!("Failed to update PR: {e}")))?;

        let mut labels_to_add = vec![result.change_type.as_str()];
        if result.breaking {
            labels_to_add.push("breaking-change");
        }
        if result.doc_impact {
            labels_to_add.push("doc-impact");
        }

        let changed = (details.additions + details.deletions) as u64;
        let size_label = if changed < 50 {
            "size/XS"
        } else if changed < 200 {
            "size/S"
        } else if changed < 500 {
            "size/M"
        } else if changed < 1000 {
            "size/L"
        } else {
            "size/XL"
        };
        labels_to_add.push(size_label);

        rt.block_on(sync_labels(gh, &owner, &repo, pr_number, &labels_to_add, &[]))
            .map_err(|e| LlmError::Provider(format!("Failed to sync labels: {e}")))?;

        Ok(())
    }
}

#[tokio::main]
async fn main() {
    let required = [
        "GITHUB_TOKEN", "LLM", "MODEL", "API_KEY",
        "GITHUB_REPOSITORY_OWNER", "GITHUB_REPOSITORY_NAME",
        "GITHUB_EVENT_PULL_REQUEST_NUMBER",
    ];
    let mut missing = Vec::new();
    for var in &required {
        if std::env::var(var).is_ok() {
            continue;
        }
        missing.push(*var);
    }
    if !missing.is_empty() {
        eprintln!("Missing required environment variables: {}", missing.join(", "));
        std::process::exit(1);
    }

    let token = std::env::var("GITHUB_TOKEN").expect("already validated");
    let llm = std::env::var("LLM").expect("already validated");
    let model = std::env::var("MODEL").expect("already validated");
    let api_key = std::env::var("API_KEY").expect("already validated");
    let owner = std::env::var("GITHUB_REPOSITORY_OWNER").expect("already validated");
    let repo = std::env::var("GITHUB_REPOSITORY_NAME").expect("already validated");
    let pr_number: u64 = match std::env::var("GITHUB_EVENT_PULL_REQUEST_NUMBER")
        .expect("already validated")
        .parse()
    {
        Ok(n) => n,
        Err(_) => 0,
    };

    let gh = OctocrabClient::new(&token);
    let provider = ProviderRegistry::create(&llm, &api_key, &model).unwrap_or_else(|e| {
        eprintln!("Failed to create provider: {e}");
        std::process::exit(1);
    });

    let result = run_pipeline::<PrMetadataOutput, PrMetadataHandler>(
        &owner,
        &repo,
        pr_number,
        provider.as_ref(),
        &gh,
    )
    .await;

    match result {
        Ok(outcome) => match outcome {
            wfs_core::pipeline::PipelineOutcome::Success => {
                std::process::exit(0);
            }
            wfs_core::pipeline::PipelineOutcome::Failure(e) => {
                eprintln!("Pipeline failed: {e}");
                std::process::exit(1);
            }
        },
        Err(e) => {
            eprintln!("Pipeline error: {e}");
            std::process::exit(1);
        }
    }
}
