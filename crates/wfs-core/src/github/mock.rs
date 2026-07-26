use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Mutex;

use crate::error::LlmError;
use super::{Comment, GitHubClient, Label, PullRequest};

pub struct MockGitHubClient {
    inner_diff: Mutex<HashMap<String, String>>,
    inner_details: Mutex<HashMap<String, PullRequest>>,
    inner_files: Mutex<HashMap<String, Vec<String>>>,
    inner_comments: Mutex<HashMap<u64, Vec<Comment>>>,
    inner_labels: Mutex<HashMap<u64, Vec<Label>>>,
    inner_pr_updates: Mutex<Vec<(u64, Option<String>, Option<String>)>>,
}

impl Default for MockGitHubClient {
    fn default() -> Self {
        Self::new()
    }
}

impl MockGitHubClient {
    pub fn new() -> Self {
        Self {
            inner_diff: Mutex::new(HashMap::new()),
            inner_details: Mutex::new(HashMap::new()),
            inner_files: Mutex::new(HashMap::new()),
            inner_comments: Mutex::new(HashMap::new()),
            inner_labels: Mutex::new(HashMap::new()),
            inner_pr_updates: Mutex::new(Vec::new()),
        }
    }

    fn diff(&self) -> impl std::ops::Deref<Target = HashMap<String, String>> + '_ {
        self.inner_diff.lock().expect("mock diff mutex")
    }

    fn diff_mut(&self) -> impl std::ops::DerefMut<Target = HashMap<String, String>> + '_ {
        self.inner_diff.lock().expect("mock diff mutex")
    }

    fn details(&self) -> impl std::ops::Deref<Target = HashMap<String, PullRequest>> + '_ {
        self.inner_details.lock().expect("mock details mutex")
    }

    fn details_mut(&self) -> impl std::ops::DerefMut<Target = HashMap<String, PullRequest>> + '_ {
        self.inner_details.lock().expect("mock details mutex")
    }

    fn files(&self) -> impl std::ops::Deref<Target = HashMap<String, Vec<String>>> + '_ {
        self.inner_files.lock().expect("mock files mutex")
    }

    fn files_mut(&self) -> impl std::ops::DerefMut<Target = HashMap<String, Vec<String>>> + '_ {
        self.inner_files.lock().expect("mock files mutex")
    }

    fn comments_mut(&self) -> impl std::ops::DerefMut<Target = HashMap<u64, Vec<Comment>>> + '_ {
        self.inner_comments.lock().expect("mock comments mutex")
    }

    fn labels_mut(&self) -> impl std::ops::DerefMut<Target = HashMap<u64, Vec<Label>>> + '_ {
        self.inner_labels.lock().expect("mock labels mutex")
    }

    fn pr_updates(&self) -> Vec<(u64, Option<String>, Option<String>)> {
        self.inner_pr_updates.lock().expect("mock pr_updates mutex").clone()
    }

    fn pr_updates_mut(&self) -> impl std::ops::DerefMut<Target = Vec<(u64, Option<String>, Option<String>)>> + '_ {
        self.inner_pr_updates.lock().expect("mock pr_updates mutex")
    }

    pub fn set_diff(&self, key: &str, diff: String) {
        self.diff_mut().insert(key.to_string(), diff);
    }

    pub fn set_details(&self, key: &str, pr: PullRequest) {
        self.details_mut().insert(key.to_string(), pr);
    }

    pub fn set_files(&self, key: &str, files: Vec<String>) {
        self.files_mut().insert(key.to_string(), files);
    }

    pub fn add_comment(&self, number: u64, comment: Comment) {
        self.comments_mut().entry(number).or_default().push(comment);
    }

    pub fn get_pr_updates(&self) -> Vec<(u64, Option<String>, Option<String>)> {
        self.pr_updates()
    }
}

#[async_trait]
impl GitHubClient for MockGitHubClient {
    async fn get_pr_diff(&self, owner: &str, repo: &str, number: u64) -> Result<String, LlmError> {
        let key = format!("{owner}/{repo}/{number}");
        self.diff().get(&key).cloned().ok_or_else(|| LlmError::InvalidRequest(format!("No mock diff for {key}")))
    }

    async fn get_pr_details(&self, owner: &str, repo: &str, number: u64) -> Result<PullRequest, LlmError> {
        let key = format!("{owner}/{repo}/{number}");
        self.details().get(&key).cloned().ok_or_else(|| LlmError::InvalidRequest(format!("No mock details for {key}")))
    }

    async fn get_pr_files(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<String>, LlmError> {
        let key = format!("{owner}/{repo}/{number}");
        self.files().get(&key).cloned().ok_or_else(|| LlmError::InvalidRequest(format!("No mock files for {key}")))
    }

    async fn list_comments(&self, _owner: &str, _repo: &str, number: u64) -> Result<Vec<Comment>, LlmError> {
        Ok(self.inner_comments.lock().expect("mock comments mutex").get(&number).cloned().unwrap_or_default())
    }

    async fn post_comment(&self, _owner: &str, _repo: &str, number: u64, body: &str) -> Result<Comment, LlmError> {
        let mut map = self.comments_mut();
        let id = (map.get(&number).map(|c| c.len()).unwrap_or(0) + 1) as u64;
        let comment = Comment {
            id,
            body: body.to_string(),
            user_login: "mock".to_string(),
        };
        map.entry(number).or_default().push(comment.clone());
        Ok(comment)
    }

    async fn update_comment(&self, _owner: &str, _repo: &str, comment_id: u64, body: &str) -> Result<Comment, LlmError> {
        let mut map = self.comments_mut();
        for comments in map.values_mut() {
            if let Some(comment) = comments.iter_mut().find(|c| c.id == comment_id) {
                comment.body = body.to_string();
                return Ok(comment.clone());
            }
        }
        Err(LlmError::InvalidRequest(format!("Comment {comment_id} not found")))
    }

    async fn delete_comment(&self, _owner: &str, _repo: &str, comment_id: u64) -> Result<(), LlmError> {
        self.comments_mut().values_mut().for_each(|comments| comments.retain(|c| c.id != comment_id));
        Ok(())
    }

    async fn add_labels(&self, _owner: &str, _repo: &str, number: u64, labels: &[&str]) -> Result<Vec<Label>, LlmError> {
        let mut map = self.labels_mut();
        let existing = map.entry(number).or_default();
        for label in labels {
            if !existing.iter().any(|l| l.name == *label) {
                existing.push(Label {
                    name: label.to_string(),
                    color: None,
                    description: None,
                });
            }
        }
        Ok(existing.clone())
    }

    async fn remove_label(&self, _owner: &str, _repo: &str, number: u64, label: &str) -> Result<(), LlmError> {
        let mut map = self.labels_mut();
        if let Some(existing) = map.get_mut(&number) {
            existing.retain(|l| l.name != label);
        }
        Ok(())
    }

    async fn update_pr(&self, _owner: &str, _repo: &str, number: u64, title: Option<&str>, body: Option<&str>) -> Result<PullRequest, LlmError> {
        self.pr_updates_mut().push((
            number,
            title.map(String::from),
            body.map(String::from),
        ));
        Ok(PullRequest {
            number,
            title: title.unwrap_or_default().to_string(),
            body: body.map(String::from),
            state: "open".to_string(),
            additions: None,
            deletions: None,
        })
    }
}
