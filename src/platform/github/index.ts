export const githubVersion = '0.0.0';

export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`GitHub API error ${response.status}: ${errorBody}`);
    }

    // Handle cases where we expect raw text (like diffs) instead of JSON
    if (options.headers?.['Accept'] === 'application/vnd.github.diff') {
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
    const files = await this.request<any[]>(`/repos/${owner}/${repo}/pulls/${pull_number}/files`);
    return files
      .filter(f => f.status !== 'binary' && !f.filename.endsWith('.lock') && !f.filename.includes('package-lock.json'))
      .map(f => f.filename);
  }

  async getPRDetails(owner: string, repo: string, pull_number: number) {
    return this.request<any>(`/repos/${owner}/${repo}/pulls/${pull_number}`);
  }

  async updatePR(owner: string, repo: string, pull_number: number, title?: string, body?: string): Promise<any> {
    return this.request<any>(`/repos/${owner}/${repo}/pulls/${pull_number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
  }

  async addLabels(owner: string, repo: string, pull_number: number, labels: string[]): Promise<any> {
    return this.request<any>(`/repos/${owner}/${repo}/issues/${pull_number}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels }),
    });
  }

  async postComment(owner: string, repo: string, pull_number: number, body: string): Promise<any> {
    return this.request<any>(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }

  async listComments(owner: string, repo: string, pull_number: number) {
    return this.request<any[]>(`/repos/${owner}/${repo}/issues/${pull_number}/comments`);
  }

  async deleteComment(owner: string, repo: string, pull_number: number, comment_id: number): Promise<any> {
    return this.request<any>(`/repos/${owner}/${repo}/issues/${pull_number}/comments/${comment_id}`, {
      method: 'DELETE',
    });
  }

  async removeLabel(owner: string, repo: string, pull_number: number, label: string): Promise<any> {
    return this.request<any>(`/repos/${owner}/${repo}/issues/${pull_number}/labels/${label}`, {
      method: 'DELETE',
    });
  }
}

export * from './context';
