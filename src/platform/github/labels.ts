import { GitHubClient } from './index';

/**
 * Synchronizes PR labels by adding new ones and removing specified old ones.
 */
export async function syncLabels(
  gh: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  { add = [], remove = [] }: { add?: string[]; remove?: string[] }
): Promise<void> {
  if (remove.length > 0) {
    for (const label of remove) {
      await gh.removeLabel(owner, repo, pullNumber, label).catch(() => {
        // Ignore if label doesn't exist
      });
    }
  }
  
  if (add.length > 0) {
    await gh.addLabels(owner, repo, pullNumber, add);
  }
}
