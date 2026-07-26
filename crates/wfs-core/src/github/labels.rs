use crate::error::LlmError;
use super::GitHubClient;

pub async fn sync_labels(
    gh: &dyn GitHubClient,
    owner: &str,
    repo: &str,
    pr_number: u64,
    add: &[&str],
    remove: &[&str],
) -> Result<(), LlmError> {
    for label in remove {
        let _ = gh.remove_label(owner, repo, pr_number, label).await;
    }

    if !add.is_empty() {
        gh.add_labels(owner, repo, pr_number, add).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::mock::MockGitHubClient;

    #[tokio::test]
    async fn test_sync_labels_add() {
        let gh = MockGitHubClient::new();
        sync_labels(&gh, "owner", "repo", 1, &["bug", "feature"], &[]).await.unwrap();
        let result = gh.add_labels("owner", "repo", 1, &[]).await.unwrap();
        assert!(result.iter().any(|l| l.name == "bug"));
        assert!(result.iter().any(|l| l.name == "feature"));
        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn test_sync_labels_remove() {
        let gh = MockGitHubClient::new();
        gh.add_labels("owner", "repo", 1, &["bug", "wontfix"]).await.unwrap();
        sync_labels(&gh, "owner", "repo", 1, &[], &["wontfix"]).await.unwrap();
        let labels = gh.add_labels("owner", "repo", 1, &[]).await.unwrap();
        assert!(labels.iter().any(|l| l.name == "bug"));
        assert!(!labels.iter().any(|l| l.name == "wontfix"));
    }
}
