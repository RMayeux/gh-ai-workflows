use wfs_core::error::LlmError;
use wfs_core::github::labels::sync_labels;
use wfs_core::github::octocrab::OctocrabClient;
use wfs_core::github::GitHubClient;
use wfs_core::llm::registry::ProviderRegistry;
use wfs_core::pipeline::{run_pipeline, FeatureHandler, PullRequestDetails, WorkflowConfig};
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

fn make_size_label(changed: u64) -> &'static str {
    if changed < 50 { "size/XS" }
    else if changed < 200 { "size/S" }
    else if changed < 500 { "size/M" }
    else if changed < 1000 { "size/L" }
    else { "size/XL" }
}

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
                details.files.join("\\n"), diff
            ),
            system_prompt: Some(concat!(
                "You are a staff engineer analyzing a PR diff. Return ONLY valid JSON with this schema:\n",
                r#"{"title":"string (max 72 chars)","body":"string","change_type":"feat|fix|refactor|perf|docs|test|build|ci|chore"}"#,
                "\n\nNo code fences, no preamble, no trailing commas.\n",
                "- Title: conventional commit type(domain): description, under 72 chars.\n",
                "- Body: \"## What changed\" (one paragraph, feature-focused, no file lists).\n",
                "- Change type: infer from diff intent.\n",
                "- Think features not files.\n",
                "- Never list files, routes, or dependency bumps. No hallucination."
            ).to_string()),
            temperature: None, max_tokens: None,
            json_mode: Some(true), stop_sequences: None,
        }
    }

    fn handle_result(result: &PrMetadataOutput, details: &PullRequestDetails, gh: &dyn GitHubClient) -> Result<(), LlmError> {
        let cfg = WorkflowConfig::from_env()?;
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| LlmError::Provider(format!("Runtime error: {e}")))?;

        rt.block_on(gh.update_pr(&cfg.owner, &cfg.repo, cfg.pr_number,
            Some(&result.title), Some(&result.body)))
            .map_err(|e| LlmError::Provider(format!("Failed to update PR: {e}")))?;

        let mut labels = vec![result.change_type.as_str()];
        if result.breaking { labels.push("breaking-change"); }
        if result.doc_impact { labels.push("doc-impact"); }
        let changed = (details.additions + details.deletions) as u64;
        labels.push(make_size_label(changed));

        rt.block_on(sync_labels(gh, &cfg.owner, &cfg.repo, cfg.pr_number, &labels, &[]))
            .map_err(|e| LlmError::Provider(format!("Failed to sync labels: {e}")))?;

        Ok(())
    }
}

async fn run() -> Result<(), LlmError> {
    let cfg = WorkflowConfig::from_env()?;
    let gh = OctocrabClient::new(&cfg.github_token);
    let provider = ProviderRegistry::create(&cfg.llm, &cfg.api_key, &cfg.model)?;
    let result = run_pipeline::<PrMetadataOutput, PrMetadataHandler>(
        &cfg.owner, &cfg.repo, cfg.pr_number, provider.as_ref(), &gh,
    ).await?;
    match result {
        wfs_core::pipeline::PipelineOutcome::Success => Ok(()),
        wfs_core::pipeline::PipelineOutcome::Failure(e) => {
            Err(LlmError::Provider(format!("Pipeline failed: {e}")))
        }
    }
}

#[tokio::main]
async fn main() {
    match run().await {
        Ok(_) => std::process::exit(0),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}
