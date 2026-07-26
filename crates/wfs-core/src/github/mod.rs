pub mod comments;
pub mod labels;
pub mod mock;
pub mod octocrab;

use async_trait::async_trait;

use crate::error::LlmError;

#[derive(Debug, Clone)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct Comment {
    pub id: u64,
    pub body: String,
    pub user_login: String,
}

#[derive(Debug, Clone)]
pub struct Label {
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[async_trait]
pub trait GitHubClient: Send + Sync {
    async fn get_pr_diff(&self, owner: &str, repo: &str, number: u64) -> Result<String, LlmError>;
    async fn get_pr_details(&self, owner: &str, repo: &str, number: u64) -> Result<PullRequest, LlmError>;
    async fn get_pr_files(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<String>, LlmError>;
    async fn list_comments(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<Comment>, LlmError>;
    async fn post_comment(&self, owner: &str, repo: &str, number: u64, body: &str) -> Result<Comment, LlmError>;
    async fn update_comment(&self, owner: &str, repo: &str, comment_id: u64, body: &str) -> Result<Comment, LlmError>;
    async fn delete_comment(&self, owner: &str, repo: &str, comment_id: u64) -> Result<(), LlmError>;
    async fn add_labels(&self, owner: &str, repo: &str, number: u64, labels: &[&str]) -> Result<Vec<Label>, LlmError>;
    async fn remove_label(&self, owner: &str, repo: &str, number: u64, label: &str) -> Result<(), LlmError>;
    async fn update_pr(&self, owner: &str, repo: &str, number: u64, title: Option<&str>, body: Option<&str>) -> Result<PullRequest, LlmError>;
}
