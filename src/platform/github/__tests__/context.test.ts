import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextBuilder } from '../context';
import { GitHubClient } from '../index';

vi.mock('../index', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      getPRDiff: vi.fn(),
      getPRFiles: vi.fn(),
      getPRDetails: vi.fn(),
    })),
  };
});

describe('ContextBuilder', () => {
  let ghClient: any;
  let builder: ContextBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    ghClient = new GitHubClient('token');
    builder = new ContextBuilder(ghClient);
  });

  it('should build a complete PR context successfully', async () => {
    const mockDiff = 'diff --git a/file.ts b/file.ts\\n+ const x = 1;';
    const mockFiles = ['file.ts', 'utils.ts'];
    const mockDetails = {
      title: 'Test PR',
      body: 'Test Body',
      additions: 100,
      deletions: 50,
    };

    ghClient.getPRDiff.mockResolvedValue(mockDiff);
    ghClient.getPRFiles.mockResolvedValue(mockFiles);
    ghClient.getPRDetails.mockResolvedValue(mockDetails);

    const context = await builder.buildPRContext('owner', 'repo', 1);

    expect(context).toEqual({
      diff: mockDiff,
      files: mockFiles,
      details: {
        title: 'Test PR',
        body: 'Test Body',
        additions: 100,
        deletions: 50,
      },
    });

    expect(ghClient.getPRDiff).toHaveBeenCalledWith('owner', 'repo', 1);
    expect(ghClient.getPRFiles).toHaveBeenCalledWith('owner', 'repo', 1);
    expect(ghClient.getPRDetails).toHaveBeenCalledWith('owner', 'repo', 1);
  });

  it('should throw the original error if any GitHub API call fails', async () => {
    ghClient.getPRDiff.mockRejectedValue(new Error('GitHub Error'));

    await expect(builder.buildPRContext('owner', 'repo', 1))
      .rejects.toThrow('GitHub Error');
  });

  it('should truncate diff if it exceeds maxDiffSize', async () => {
    const longDiff = 'a'.repeat(40000);
    ghClient.getPRDiff.mockResolvedValue(longDiff);
    ghClient.getPRFiles.mockResolvedValue([]);
    ghClient.getPRDetails.mockResolvedValue({ title: 'T', body: 'B' });

    const context = await builder.buildPRContext('owner', 'repo', 1, { maxDiffSize: 100 });
    expect(context.diff.length).toBeLessThan(200); // 100 + truncation message
    expect(context.diff).toContain('[Diff truncated to 100 chars]');
  });

  it('should filter files if ignoreFiles is provided', async () => {
    ghClient.getPRDiff.mockResolvedValue('diff');
    ghClient.getPRFiles.mockResolvedValue(['src/index.ts', 'dist/index.js']);
    ghClient.getPRDetails.mockResolvedValue({ title: 'T', body: 'B' });

    const context = await builder.buildPRContext('owner', 'repo', 1, {
      ignoreFiles: (f) => f.startsWith('dist/')
    });
    expect(context.files).toEqual(['src/index.ts']);
  });
});
