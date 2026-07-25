import { GitHubClient } from './github-client';

export interface GitHubContext {
  diff: string;
  files: string[];
  details: {
    title: string;
    body: string;
    additions: number;
    deletions: number;
  };
}

export class ContextBuilder {
  constructor(private gh: GitHubClient) {}

  async buildPRContext(owner: string, repo: string, pullNumber: number, options: {
    maxDiffSize?: number;
    tokenBudget?: number;
    ignoreFiles?: (file: string) => boolean;
  } = {}) {
    const [diff, files, details] = await Promise.all([
      this.gh.getPRDiff(owner, repo, pullNumber),
      this.gh.getPRFiles(owner, repo, pullNumber),
      this.gh.getPRDetails(owner, repo, pullNumber),
    ]);

    const filteredFiles = options.ignoreFiles 
      ? files.filter(f => !options.ignoreFiles!(f)) 
      : files;

    let processedDiff = diff;
    
    // Remove diff chunks related to the dist folder
    const diffChunks = diff.split(/^diff --git /m);
    const filteredChunks = diffChunks.filter(chunk => 
      !chunk.startsWith('a/dist/') && !chunk.includes('--- a/dist/')
    );
    processedDiff = filteredChunks.join('diff --git ').trim();
    if (processedDiff && !processedDiff.startsWith('diff --git')) {
      processedDiff = 'diff --git ' + processedDiff;
    }

    processedDiff = processedDiff
      .split('\n')
      .filter(l => !l.startsWith(' '))
      .join('\n');

    if (options.tokenBudget && options.tokenBudget > 0) {
      const maxChars = options.tokenBudget * 4;
      if (processedDiff.length > maxChars) {
        const cutAt = processedDiff.lastIndexOf('\n', maxChars);
        processedDiff = processedDiff.substring(0, cutAt > 0 ? cutAt : maxChars) + `\n\n... [Diff truncated to ~${options.tokenBudget} tokens] ...`;
      }
    } else {
      const maxDiffSize = options.maxDiffSize || 30000;
      if (processedDiff.length > maxDiffSize) {
        const cutAt = processedDiff.lastIndexOf('\n', maxDiffSize);
        processedDiff = processedDiff.substring(0, cutAt > 0 ? cutAt : maxDiffSize) + `\n\n... [Diff truncated to ${maxDiffSize} chars] ...`;
      }
    }

    return {
      diff: processedDiff,
      files: filteredFiles,
      details: {
        title: details.title,
        body: details.body,
        additions: details.additions || 0,
        deletions: details.deletions || 0,
      },
    };
  }
}
