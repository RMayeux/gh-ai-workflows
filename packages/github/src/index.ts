import { Octokit } from '@octokit/rest';

export const githubVersion = '0.0.0';

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPRDiff(owner: string, repo: string, pull_number: number) {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number,
      mediaType: { format: 'diff' },
    });
    return (data as unknown) as string;
  }

  async getPRFiles(owner: string, repo: string, pull_number: number) {
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    return files
      .filter(f => (f.status as string) !== 'binary' && !f.filename.endsWith('.lock'))
      .map(f => f.filename);
  }

  async getPRDetails(owner: string, repo: string, pull_number: number) {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number,
    });
    return data;
  }

  async updatePR(owner: string, repo: string, pull_number: number, title?: string, body?: string): Promise<any> {
    return this.octokit.pulls.update({
      owner,
      repo,
      pull_number,
      title,
      body,
    });
  }

  async addLabels(owner: string, repo: string, pull_number: number, labels: string[]): Promise<any> {
    return this.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: pull_number,
      labels,
    });
  }

  async postComment(owner: string, repo: string, pull_number: number, body: string): Promise<any> {
    return this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body,
    });
  }
}

export * from './workflows/pr-metadata';
export * from './workflows/pr-review';
export * from './context';
