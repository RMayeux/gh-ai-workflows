export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: string;
  user: { login: string };
  base: { ref: string };
  head: { ref: string };
  created_at: string;
  updated_at: string;
  merged_at?: string;
  merge_commit_sha?: string;
  additions?: number;
  deletions?: number;
}

export interface GitHubComment {
  id: number;
  user: { login: string };
  body: string;
  created_at: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
  description?: string;
}

export interface GitHubResponse {
  [key: string]: unknown;
}
