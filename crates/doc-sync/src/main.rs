use std::path::Path;

use wfs_core::error::LlmError;
use wfs_core::fs_utils::read_matching_files;
use wfs_core::github::comments::upsert_bot_comment;
use wfs_core::github::octocrab::OctocrabClient;
use wfs_core::github::GitHubClient;
use wfs_core::llm::registry::ProviderRegistry;
use wfs_core::pipeline::{run_pipeline, FeatureHandler, PullRequestDetails, WorkflowConfig};
use wfs_core::types::GenerateRequest;

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct DocChange {
    path: String,
    action: String,
    content: String,
    explanation: String,
}

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct DocSyncOutput {
    summary: String,
    changes: Vec<DocChange>,
}

struct DocSyncHandler;

impl FeatureHandler<DocSyncOutput> for DocSyncHandler {
    fn response_schema() -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "summary": { "type": "string" },
                "changes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" },
                            "action": { "type": "string", "enum": ["create", "update", "delete"] },
                            "content": { "type": "string" },
                            "explanation": { "type": "string" }
                        }
                    }
                }
            },
            "required": ["summary", "changes"]
        })
    }

    fn build_prompt(diff: &str, _details: &PullRequestDetails) -> GenerateRequest {
        let doc_pattern = std::env::var("DOC_PATTERN").unwrap_or_else(|_| r".*\.md".to_string());
        let documentation = read_matching_files(&doc_pattern);

        GenerateRequest {
            prompt: format!(
                "## PR code changes:\n{diff}\n\n\
                 ## Existing documentation:\n{documentation}\n\n\
                 ---\n\
                 ## Rules\n\
                 - Analyze the diff to identify what features, APIs, or behaviors changed\n\
                 - Only update documentation that is directly affected by this diff\n\
                 - If a new feature was added with no existing doc, specify where a new file should be created\n\
                 - If a feature was removed, flag the doc for deletion or update\n\
                 - If only internal implementation changed with no behavior or API impact, skip it\n\
                 - If no documentation changes are needed, return an empty changes array\n\
                 ---\n\
                 ## Output format\n\
                 Return a single JSON object:\n\
                 {{\n\
                   \"summary\": \"A concise summary of the documentation updates needed\",\n\
                   \"changes\": [\n\
                     {{\"path\": \"relative/path/to/doc.md\", \"action\": \"update|create|delete\", \"content\": \"...\", \"explanation\": \"...\"}}\n\
                   ]\n\
                 }}"
            ),
            system_prompt: Some(concat!(
                "You are an expert technical writer ensuring documentation stays ",
                "synchronized with the codebase. Return ONLY valid JSON. ",
                "Maintain the existing tone, style, and structure. ",
                "Do not output reasoning, only the final JSON object."
            ).to_string()),
            temperature: None, max_tokens: None,
            json_mode: Some(true), stop_sequences: None,
        }
    }

    fn handle_result(result: &DocSyncOutput, _details: &PullRequestDetails, gh: &dyn GitHubClient) -> Result<(), LlmError> {
        let cfg = WorkflowConfig::from_env()?;
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| LlmError::Provider(format!("Runtime error: {e}")))?;

        let mut synced = 0usize;
        for change in &result.changes {
            match change.action.as_str() {
                "create" | "update" => {
                    let path = Path::new(&change.path);
                    if let Some(parent) = path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    std::fs::write(&change.path, &change.content)
                        .map_err(|e| LlmError::Provider(format!("Failed to write {}: {e}", change.path)))?;
                    synced += 1;
                }
                "delete" => {
                    if Path::new(&change.path).exists() {
                        std::fs::remove_file(&change.path)
                            .map_err(|e| LlmError::Provider(format!("Failed to delete {}: {e}", change.path)))?;
                        synced += 1;
                    }
                }
                _ => {}
            }
        }

        let mut body = format!("### 📄 Documentation Sync\n\n{}\n\n", result.summary);
        if synced > 0 {
            body.push_str(&format!("**{} file(s) synced**\n", synced));
            for change in &result.changes {
                let icon = match change.action.as_str() {
                    "create" => "✅ Created",
                    "update" => "🔄 Updated",
                    "delete" => "🗑️ Deleted",
                    _ => "?",
                };
                body.push_str(&format!("- {}: `{}` ({})\n", icon, change.path, change.explanation));
            }
        } else {
            body.push_str("No documentation changes needed.\n");
        }

        rt.block_on(upsert_bot_comment(gh, &cfg.owner, &cfg.repo, cfg.pr_number, "### 📄 Documentation Sync", &body))
            .map_err(|e| LlmError::Provider(format!("Failed to post doc sync comment: {e}")))?;

        Ok(())
    }
}

async fn run() -> Result<(), LlmError> {
    let cfg = WorkflowConfig::from_env()?;
    let gh = OctocrabClient::new(&cfg.github_token);
    let provider = ProviderRegistry::create(&cfg.llm, &cfg.api_key, &cfg.model)?;
    let result = run_pipeline::<DocSyncOutput, DocSyncHandler>(
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
