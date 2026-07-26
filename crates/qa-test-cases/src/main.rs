use wfs_core::error::LlmError;
use wfs_core::github::comments::upsert_bot_comment;
use wfs_core::github::octocrab::OctocrabClient;
use wfs_core::github::GitHubClient;
use wfs_core::llm::registry::ProviderRegistry;
use wfs_core::pipeline::{run_pipeline, FeatureHandler, PullRequestDetails, WorkflowConfig};
use wfs_core::types::GenerateRequest;

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct ImpactedFeature {
    #[serde(rename = "featureSlug")]
    feature_slug: String,
    #[serde(rename = "testCases")]
    test_cases: Vec<String>,
}

#[derive(serde::Deserialize, schemars::JsonSchema)]
struct QATestCasesOutput {
    summary: String,
    #[serde(rename = "impactedFeatures")]
    impacted_features: Vec<ImpactedFeature>,
    #[serde(rename = "unchangedTestCases")]
    unchanged_test_cases: Vec<String>,
    #[serde(rename = "retiredTestCases")]
    retired_test_cases: Vec<String>,
    #[serde(rename = "totalTests")]
    total_tests: u32,
}

struct QATestCasesHandler;

impl FeatureHandler<QATestCasesOutput> for QATestCasesHandler {
    fn response_schema() -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "summary": { "type": "string" },
                "impactedFeatures": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "featureSlug": { "type": "string" },
                            "testCases": { "type": "array", "items": { "type": "string" } }
                        }
                    }
                },
                "unchangedTestCases": { "type": "array", "items": { "type": "string" } },
                "retiredTestCases": { "type": "array", "items": { "type": "string" } },
                "totalTests": { "type": "integer" }
            },
            "required": ["summary", "impactedFeatures", "unchangedTestCases", "retiredTestCases", "totalTests"]
        })
    }

    fn build_prompt(diff: &str, details: &PullRequestDetails) -> GenerateRequest {
        let project_context = std::env::var("PROJECT_CONTEXT").unwrap_or_default();
        let doc_pattern = std::env::var("DOC_PATTERN").ok();

        // ponytail: simple file read for matched docs, no glob crate needed
        let documentation = if let Some(ref pattern) = doc_pattern {
            read_matching_files(pattern)
        } else {
            String::new()
        };

        let previous = details.previous_comments.iter()
            .find(|c| c.contains("🧪 QA Test Cases"))
            .cloned()
            .unwrap_or_default();

        GenerateRequest {
            prompt: format!(
                "## Context\n{project_context}\n\n\
                 ## PR code changes:\n{diff}\n\n\
                 ## Documentation:\n{documentation}\n\n\
                 ## Previous QA comment (if any):\n{previous}\n\n\
                 ---\n\
                 ## Rules\n\
                 - Read the diff to understand what changed\n\
                 - Use the documentation to understand the intent and business rules\n\
                 - ONLY generate tests for rules that are NEW or CHANGED in this PR\n\
                 - Group related checks into one TC when possible\n\
                 - Include at least one negative or edge-case TC per feature\n\
                 - Test cases must follow: starting condition → action → expected result\n\
                 - No jargon, no code, no technical details\n\
                 - When a previous comment exists, parse existing TCs, mark unchanged/retired\n\
                 \n\
                 ## Output Format (JSON object):\n\
                 {{\n\
                   \"summary\": \"...\",\n\
                   \"impactedFeatures\": [{{\"featureSlug\": \"...\", \"testCases\": [...]}}],\n\
                   \"unchangedTestCases\": [...],\n\
                   \"retiredTestCases\": [...],\n\
                   \"totalTests\": 0\n\
                 }}"
            ),
            system_prompt: Some(concat!(
                "You are a senior QA lead reviewing a pull request. ",
                "Return ONLY valid JSON. Do not add extra keys. ",
                "Test cases must follow: starting condition → action → expected result. ",
                "No code, no jargon, no technical details."
            ).to_string()),
            temperature: None, max_tokens: None,
            json_mode: Some(true), stop_sequences: None,
        }
    }

    fn handle_result(result: &QATestCasesOutput, _details: &PullRequestDetails, gh: &dyn GitHubClient) -> Result<(), LlmError> {
        let cfg = WorkflowConfig::from_env()?;
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| LlmError::Provider(format!("Runtime error: {e}")))?;

        let mut body = format!("### 🧪 QA Test Cases\n\n> {} (**Total active tests: {}**)\n\n",
            result.summary, result.total_tests);

        if !result.impacted_features.is_empty() {
            body.push_str("**New / updated**\n");
            for feature in &result.impacted_features {
                body.push_str(&format!("**{}**\n", feature.feature_slug));
                for tc in &feature.test_cases {
                    body.push_str(&format!("- [ ] {tc}\n"));
                }
                body.push('\n');
            }
        }

        if !result.unchanged_test_cases.is_empty() {
            body.push_str("**Already covered**\n");
            for tc in &result.unchanged_test_cases {
                body.push_str(&format!("- [ ] {tc}\n"));
            }
            body.push('\n');
        }

        if !result.retired_test_cases.is_empty() {
            body.push_str("**Retired**\n");
            for tc in &result.retired_test_cases {
                body.push_str(&format!("~~- {tc}~~\n"));
            }
        }

        rt.block_on(upsert_bot_comment(gh, &cfg.owner, &cfg.repo, cfg.pr_number, "🧪 QA Test Cases", &body))
            .map_err(|e| LlmError::Provider(format!("Failed to post QA comment: {e}")))?;

        Ok(())
    }
}

/// ponytail: simple glob-free doc reader, reads files matching a pattern from cwd
fn read_matching_files(pattern: &str) -> String {
    let Ok(entries) = std::fs::read_dir(".") else { return String::new() };
    let mut result = String::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.to_str() {
                if path.extension().map_or(false, |e| e == "md") {
                    // ponytail: simple name contains check instead of full regex
                    if name.contains(pattern.trim_matches('.'))
                        || pattern == ".*\\.md"
                    {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            result.push_str(&format!("\n--- {} ---\n{content}\n", name));
                        }
                    }
                }
            }
        }
    }
    result
}

async fn run() -> Result<(), LlmError> {
    let cfg = WorkflowConfig::from_env()?;
    let gh = OctocrabClient::new(&cfg.github_token);
    let provider = ProviderRegistry::create(&cfg.llm, &cfg.api_key, &cfg.model)?;
    let result = run_pipeline::<QATestCasesOutput, QATestCasesHandler>(
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
