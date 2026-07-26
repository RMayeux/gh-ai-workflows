use async_trait::async_trait;
use reqwest::Client;

use crate::error::LlmError;
use super::{Comment, GitHubClient, Label, PullRequest};

fn u64_to_u32(val: u64) -> Option<u32> {
    val.try_into().ok()
}

pub struct OctocrabClient {
    token: String,
    client: Client,
}

impl OctocrabClient {
    pub fn new(token: &str) -> Self {
        Self {
            token: token.to_string(),
            client: Client::new(),
        }
    }

    fn headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {}", self.token)
                .parse()
                .expect("valid header value"),
        );
        headers.insert(
            reqwest::header::ACCEPT,
            "application/vnd.github+json"
                .parse()
                .expect("valid header value"),
        );
        headers.insert(
            reqwest::header::HeaderName::from_static("x-github-api-version"),
            "2022-11-28"
                .parse()
                .expect("valid header value"),
        );
        headers
    }

    fn url(&self, path: &str) -> String {
        format!("https://api.github.com{path}")
    }
}

#[async_trait]
impl GitHubClient for OctocrabClient {
    async fn get_pr_diff(&self, owner: &str, repo: &str, number: u64) -> Result<String, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/pulls/{number}"));
        let response = self
            .client
            .get(&url)
            .header(reqwest::header::AUTHORIZATION, format!("Bearer {}", self.token))
            .header(reqwest::header::ACCEPT, "application/vnd.github.diff")
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        response
            .text()
            .await
            .map_err(|e| LlmError::Provider(format!("Failed to read diff: {e}")))
    }

    async fn get_pr_details(&self, owner: &str, repo: &str, number: u64) -> Result<PullRequest, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/pulls/{number}"));
        let response = self
            .client
            .get(&url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse PR: {e}")))?;

        Ok(PullRequest {
            number: data["number"].as_u64().unwrap_or(number),
            title: data["title"].as_str().unwrap_or("").to_string(),
            body: data["body"].as_str().map(|s| s.to_string()),
            state: data["state"].as_str().unwrap_or("").to_string(),
            additions: data["additions"].as_u64().and_then(u64_to_u32),
            deletions: data["deletions"].as_u64().and_then(u64_to_u32),
        })
    }

    async fn get_pr_files(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<String>, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/pulls/{number}/files"));
        let response = self
            .client
            .get(&url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        let data: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse files: {e}")))?;

        Ok(data
            .iter()
            .filter_map(|f| f["filename"].as_str())
            .map(|s| s.to_string())
            .filter(|name| {
                !name.starts_with("dist/")
                    && !name.ends_with(".lock") && !name.ends_with(".LOCK")
                    && name != "package-lock.json"
            })
            .collect())
    }

    async fn list_comments(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<Comment>, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/issues/{number}/comments?per_page=100"));
        let response = self
            .client
            .get(&url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        let data: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse comments: {e}")))?;

        Ok(data
            .iter()
            .map(|c| Comment {
                id: c["id"].as_u64().unwrap_or(0),
                body: c["body"].as_str().unwrap_or("").to_string(),
                user_login: c["user"]["login"].as_str().unwrap_or("").to_string(),
            })
            .collect())
    }

    async fn post_comment(&self, owner: &str, repo: &str, number: u64, body: &str) -> Result<Comment, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/issues/{number}/comments"));
        let response = self
            .client
            .post(&url)
            .headers(self.headers())
            .json(&serde_json::json!({"body": body}))
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse comment: {e}")))?;

        Ok(Comment {
            id: data["id"].as_u64().unwrap_or(0),
            body: body.to_string(),
            user_login: String::new(),
        })
    }

    async fn update_comment(&self, owner: &str, repo: &str, comment_id: u64, body: &str) -> Result<Comment, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/issues/comments/{comment_id}"));
        let response = self
            .client
            .patch(&url)
            .headers(self.headers())
            .json(&serde_json::json!({"body": body}))
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        Ok(Comment {
            id: comment_id,
            body: body.to_string(),
            user_login: String::new(),
        })
    }

    async fn delete_comment(&self, owner: &str, repo: &str, comment_id: u64) -> Result<(), LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/issues/comments/{comment_id}"));
        let response = self
            .client
            .delete(&url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        Ok(())
    }

    async fn add_labels(&self, owner: &str, repo: &str, number: u64, labels: &[&str]) -> Result<Vec<Label>, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/issues/{number}/labels"));
        let response = self
            .client
            .post(&url)
            .headers(self.headers())
            .json(&serde_json::json!({"labels": labels}))
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        let data: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse labels: {e}")))?;

        Ok(data
            .iter()
            .map(|l| Label {
                name: l["name"].as_str().unwrap_or("").to_string(),
                color: l["color"].as_str().map(|s| s.to_string()),
                description: l["description"].as_str().map(|s| s.to_string()),
            })
            .collect())
    }

    async fn remove_label(&self, owner: &str, repo: &str, number: u64, label: &str) -> Result<(), LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/issues/{number}/labels/{label}"));
        let response = self
            .client
            .delete(&url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() && response.status().as_u16() != 404 {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        Ok(())
    }

    async fn update_pr(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        title: Option<&str>,
        body: Option<&str>,
    ) -> Result<PullRequest, LlmError> {
        let url = self.url(&format!("/repos/{owner}/{repo}/pulls/{number}"));
        let mut patch_body = serde_json::Map::new();
        if let Some(t) = title {
            patch_body.insert("title".to_string(), serde_json::json!(t));
        }
        if let Some(b) = body {
            patch_body.insert("body".to_string(), serde_json::json!(b));
        }

        let response = self
            .client
            .patch(&url)
            .headers(self.headers())
            .json(&patch_body)
            .send()
            .await
            .map_err(|e| LlmError::Provider(format!("GitHub API error: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Provider(format!("GitHub API error {status}: {text}")));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| LlmError::Parse(format!("Failed to parse PR: {e}")))?;

        Ok(PullRequest {
            number: data["number"].as_u64().unwrap_or(number),
            title: data["title"].as_str().unwrap_or("").to_string(),
            body: data["body"].as_str().map(|s| s.to_string()),
            state: data["state"].as_str().unwrap_or("").to_string(),
            additions: data["additions"].as_u64().and_then(u64_to_u32),
            deletions: data["deletions"].as_u64().and_then(u64_to_u32),
        })
    }
}
