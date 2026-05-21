import { GitHubFile, GitHubPR, GitHubComment, GitHubLabel, GitHubResponse } from './types';

export const githubVersion = '0.0.0';

export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers({
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    });

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`GitHub API error ${response.status}: ${errorBody}`);
    }

    // Handle cases where we expect raw text (like diffs) instead of JSON
    if (headers.get('Accept') === 'application/vnd.github.diff') {
      return (await response.text()) as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  async getPRDiff(owner: string, repo: string, pull_number: number) {
    return this.request<string>(`/repos/${owner}/${repo}/pulls/${pull_number}`, {
      headers: { 'Accept': 'application/vnd.github.diff' },
    });
  }

  async getPRFiles(owner: string, repo: string, pull_number: number) {
    const files = await this.request<GitHubFile[]>(`/repos/${owner}/${repo}/pulls/${pull_number}/files`);
    return files
      .filter(f => 
        f.status !== 'binary' && 
        !f.filename.startsWith('dist/') &&
        !f.filename.endsWith('.lock') && 
        !f.filename.includes('package-lock.json')
      )
      .map(f => f.filename);
  }

  async getPRDetails(owner: string, repo: string, pull_number: number) {
    return this.request<GitHubPR>(`/repos/${owner}/${repo}/pulls/${pull_number}`);
  }

  async listMergedPRs(owner: string, repo: string, state: string = 'closed') {
    return this.request<GitHubPR[]>(`/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc`);
  }

  async listPRs(owner: string, repo: string, head: string, state: string = 'open') {
    return this.request<GitHubPR[]>(`/repos/${owner}/${repo}/pulls?head=${head}&state=${state}`);
  }

  async createPR(owner: string, repo: string, title: string, head: string, base: string, body?: string): Promise<GitHubPR> {
    return this.request<GitHubPR>(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, head, base, body }),
    });
  }

  async updatePR(owner: string, repo: string, pull_number: number, title?: string, body?: string): Promise<GitHubPR> {
    return this.request<GitHubPR>(`/repos/${owner}/${repo}/pulls/${pull_number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
  }

  async addLabels(owner: string, repo: string, pull_number: number, labels: string[]): Promise<GitHubLabel[]> {
    return this.request<GitHubLabel[]>(`/repos/${owner}/${repo}/issues/${pull_number}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels }),
    });
  }

  async postComment(owner: string, repo: string, pull_number: number, body: string): Promise<GitHubComment> {
    return this.request<GitHubComment>(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }

  async listComments(owner: string, repo: string, pull_number: number) {
    let comments: GitHubComment[] = [];
    let page = 1;
    while (true) {
      const pageComments = await this.request<GitHubComment[]>(
        `/repos/${owner}/${repo}/issues/${pull_number}/comments?page=${page}&per_page=100`
      );
      if (pageComments.length === 0) break;
      comments.push(...pageComments);
      if (pageComments.length < 100) break;
      page++;
    }
    return comments;
  }

  async deleteComment(owner: string, repo: string, comment_id: number): Promise<GitHubResponse> {
    return this.request<GitHubResponse>(`/repos/${owner}/${repo}/issues/comments/${comment_id}`, {
      method: 'DELETE',
    });
  }

  async updateComment(owner: string, repo: string, comment_id: number, body: string): Promise<GitHubComment> {
    return this.request<GitHubComment>(`/repos/${owner}/${repo}/issues/comments/${comment_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }

  async removeLabel(owner: string, repo: string, pull_number: number, label: string): Promise<GitHubResponse> {
    return this.request<GitHubResponse>(`/repos/${owner}/${repo}/issues/${pull_number}/labels/${label}`, {
      method: 'DELETE',
    });
  }
}

export * from './context';
export { upsertBotComment } from './comments';
export { syncLabels } from './labels';
