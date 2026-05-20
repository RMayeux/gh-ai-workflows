import { GitHubClient } from './index';
import { Logger } from '../../core';

export async function replaceBotComments(
  gh: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  identifier: string
): Promise<void> {
  try {
    const comments = await gh.listComments(owner, repo, pullNumber);
    const botComments = comments.filter(c => c.body?.includes(identifier));
    
    for (const comment of botComments) {
      await gh.deleteComment(owner, repo, comment.id);
    }
    
    if (botComments.length > 0) {
      Logger.log(`Removed ${botComments.length} previous ${identifier} comments.`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    Logger.error(`Failed to clean up old comments: ${message}`);
    // Non-critical: we still want to post the new comment
  }
}
