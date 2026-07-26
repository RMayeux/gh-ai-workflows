use wfs_core::error::LlmError;
use wfs_core::github::comments::upsert_bot_comment;
use wfs_core::github::labels::sync_labels;
use wfs_core::github::octocrab::OctocrabClient;
use wfs_core::github::GitHubClient;
use wfs_core::llm::registry::ProviderRegistry;
use wfs_core::pipeline::{run_pipeline, FeatureHandler, PullRequestDetails, WorkflowConfig};
use wfs_core::types::GenerateRequest;

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct ReviewIssue {
    severity: String,
    status: String,
    description: String,
}

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct ResolvedIssue {
    description: String,
}

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct PrReviewOutput {
    summary: String,
    issues: Vec<ReviewIssue>,
    #[serde(rename = "resolvedIssues")]
    resolved_issues: Vec<ResolvedIssue>,
    approved: bool,
}

struct PrReviewHandler;

impl FeatureHandler<PrReviewOutput> for PrReviewHandler {
    fn response_schema() -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "summary": { "type": "string" },
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "severity": { "type": "string", "enum": ["error", "warning", "info"] },
                            "status": { "type": "string", "enum": ["new", "persisting"] },
                            "description": { "type": "string" }
                        }
                    }
                },
                "resolvedIssues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": { "type": "string" }
                        }
                    }
                },
                "approved": { "type": "boolean" }
            },
            "required": ["summary", "issues", "resolvedIssues", "approved"]
        })
    }

    fn build_prompt(diff: &str, details: &PullRequestDetails) -> GenerateRequest {
        let previous = details.previous_comments.iter()
            .find(|c| c.contains("### 🤖 AI Code Review"))
            .map(|c| {
                let truncated = if c.len() > 2000 {
                    format!("{}…\n\n_(previous comment truncated)", &c[..2000])
                } else {
                    c.clone()
                };
                format!("\n## Previous review comment:\n{}\n", truncated)
            })
            .unwrap_or_default();

        GenerateRequest {
            prompt: format!(
                "Please review the following Pull Request:\n\n\
                 Title: {title}\n\
                 Description: {body}\n\
                 {previous}\
                 # CHANGED FILES\n{files}\n\n\
                 # CODE DIFF\n{diff}\n\n\
                 Provide a summary of the changes, a list of specific issues \
                 (with severity and status), resolved issues since the last \
                 review, and a final decision on whether the PR is approved.",
                title = details.title,
                body = details.body,
                files = details.files.join("\n"),
                diff = diff
            ),
            system_prompt: Some(concat!(
                "You are a staff engineer reviewing a PR diff. Return ONLY valid JSON with this schema:\n",
                r#"{"summary":"string","issues":[{"severity":"error|warning|info","status":"new|persisting","description":"string"}],"resolvedIssues":[{"description":"string"}],"approved":boolean}"#,
                "\n\nNo code fences, no preamble, no trailing commas. Omit issues/resolvedIssues arrays if empty.\n",
                "- Summary: what the code does, soundness, dominant concern. No file lists.\n",
                "- Issues: one sentence per finding, name the behavior not the file.\n",
                "- Status: new=not in previous review, persisting=still present.\n",
                "- Approved: true iff no error-severity issues.\n",
                "- Check: logic errors, null access, security flaws, perf issues."
            ).to_string()),
            temperature: None, max_tokens: None,
            json_mode: Some(true), stop_sequences: None,
        }
    }

    fn handle_result(result: &PrReviewOutput, _details: &PullRequestDetails, gh: &dyn GitHubClient) -> Result<(), LlmError> {
        let cfg = WorkflowConfig::from_env()?;
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| LlmError::Provider(format!("Runtime error: {e}")))?;

        let mut body = "### 🤖 AI Code Review\n\n".to_string();
        body.push_str(&format!("**Summary:** {}\n\n", result.summary));

        let new_issues: Vec<_> = result.issues.iter().filter(|i| i.status == "new").collect();
        let persisting: Vec<_> = result.issues.iter().filter(|i| i.status == "persisting").collect();

        if !new_issues.is_empty() {
            body.push_str("**New issues**\n");
            for i in &new_issues {
                body.push_str(&format!("- [ ] [{}] {}\n", i.severity, i.description));
            }
            body.push('\n');
        }

        if !persisting.is_empty() {
            body.push_str("**Persisting issues**\n");
            for i in &persisting {
                body.push_str(&format!("- [ ] [{}] {}\n", i.severity, i.description));
            }
            body.push('\n');
        }

        if !result.resolved_issues.is_empty() {
            body.push_str("**Resolved issues**\n");
            for i in &result.resolved_issues {
                body.push_str(&format!("- [x] {}\n", i.description));
            }
            body.push('\n');
        }

        if result.issues.is_empty() && result.resolved_issues.is_empty() {
            body.push_str("✅ No issues found!\n");
        } else if result.issues.is_empty() {
            body.push_str("✅ All previous issues have been resolved!\n");
        }

        rt.block_on(upsert_bot_comment(gh, &cfg.owner, &cfg.repo, cfg.pr_number, "### 🤖 AI Code Review", &body))
            .map_err(|e| LlmError::Provider(format!("Failed to post review: {e}")))?;

        let labels = if result.approved { vec!["approved"] } else { vec!["needs-changes"] };
        rt.block_on(sync_labels(gh, &cfg.owner, &cfg.repo, cfg.pr_number, &labels, &[]))
            .map_err(|e| LlmError::Provider(format!("Failed to sync labels: {e}")))?;

        Ok(())
    }
}

async fn run() -> Result<(), LlmError> {
    let cfg = WorkflowConfig::from_env()?;
    let gh = OctocrabClient::new(&cfg.github_token);
    let provider = ProviderRegistry::create(&cfg.llm, &cfg.api_key, &cfg.model)?;
    let result = run_pipeline::<PrReviewOutput, PrReviewHandler>(
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
