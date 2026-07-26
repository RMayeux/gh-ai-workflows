use crate::error::LlmError;
use super::GitHubClient;

pub async fn upsert_bot_comment(
    gh: &dyn GitHubClient,
    owner: &str,
    repo: &str,
    pr_number: u64,
    identifier: &str,
    body: &str,
) -> Result<(), LlmError> {
    let comments = gh.list_comments(owner, repo, pr_number).await?;
    let mut bot_comments: Vec<_> = comments
        .into_iter()
        .filter(|c| c.body.contains(identifier))
        .collect();

    if bot_comments.is_empty() {
        gh.post_comment(owner, repo, pr_number, body).await?;
    } else {
        bot_comments.sort_by_key(|c| std::cmp::Reverse(c.id));
        let most_recent = bot_comments.remove(0);
        for old in bot_comments {
            if let Err(e) = gh.delete_comment(owner, repo, old.id).await {
                eprintln!("Warning: failed to delete stale comment {}: {e}", old.id);
            }
        }
        gh.update_comment(owner, repo, most_recent.id, body).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::mock::MockGitHubClient;
    use crate::github::Comment;

    #[tokio::test]
    async fn test_upsert_creates_new_comment() {
        let gh = MockGitHubClient::new();
        upsert_bot_comment(&gh, "owner", "repo", 1, "bot-tag", "new body").await.unwrap();
        let comments = gh.list_comments("owner", "repo", 1).await.unwrap();
        assert_eq!(comments.len(), 1);
        assert_eq!(comments[0].body, "new body");
    }

    #[tokio::test]
    async fn test_upsert_updates_existing_comment() {
        let gh = MockGitHubClient::new();
        gh.add_comment(1, Comment {
            id: 1,
            body: "old body with bot-tag".to_string(),
            user_login: "bot".to_string(),
        });
        upsert_bot_comment(&gh, "owner", "repo", 1, "bot-tag", "updated body").await.unwrap();
        let comments = gh.list_comments("owner", "repo", 1).await.unwrap();
        assert_eq!(comments.len(), 1);
        assert!(comments[0].body.contains("updated body"));
    }
}
