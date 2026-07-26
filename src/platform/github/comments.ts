import { GitHubClient } from './github-client';
import { Logger } from '../../core/telemetry';

export async function upsertBotComment(
  gh: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  identifier: string,
  body: string
): Promise<void> {
  try {
    const comments = await gh.listComments(owner, repo, pullNumber);
    const botComments = comments.filter(c => c.body?.includes(identifier));
    
    if (botComments.length > 0) {
      // Sort by date to get the most recent one
      const mostRecent = botComments.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      // Delete all except the most recent one
      for (const comment of botComments) {
        if (comment.id !== mostRecent.id) {
          await gh.deleteComment(owner, repo, comment.id);
        }
      }
      
      // Update the most recent one
      await gh.updateComment(owner, repo, mostRecent.id, body);
      Logger.log(`Updated existing ${identifier} comment.`);
    } else {
      // Create a new one
      await gh.postComment(owner, repo, pullNumber, body);
      Logger.log(`Posted new ${identifier} comment.`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    Logger.error(`Failed to upsert bot comment: ${message}`);
    throw e;
  }
}
