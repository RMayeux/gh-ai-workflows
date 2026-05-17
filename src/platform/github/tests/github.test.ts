import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient } from '../index';

describe('GitHubClient', () => {
  const token = 'test-token';
  const client = new GitHubClient(token);

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  const mockFetchResponse = (data: any, ok = true, status = 200, isText = false) => {
    return Promise.resolve({
      ok,
      status,
      text: () => Promise.resolve(isText ? data : JSON.stringify(data)),
      json: () => Promise.resolve(data),
    } as Response);
  };

  describe('request core logic', () => {
    it('should throw error when response is not ok', async () => {
      vi.mocked(fetch).mockReturnValue(mockFetchResponse('Not Found', false, 404));
      
      await expect(client.getPRDetails('owner', 'repo', 1))
        .rejects.toThrow(/GitHub API error 404: (["']?Not Found["']?)/);
    });

    it('should include required headers', async () => {
      vi.mocked(fetch).mockReturnValue(mockFetchResponse({}));
      
      await client.getPRDetails('owner', 'repo', 1);
      
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
      expect(headers.get('Accept')).toBe('application/vnd.github+json');
      expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');
    });
  });

  describe('getPRDiff', () => {
    it('should request diff format and return raw text', async () => {
      const diffText = 'diff --git a/file.ts b/file.ts';
      vi.mocked(fetch).mockReturnValue(mockFetchResponse(diffText, true, 200, true));
      
      const result = await client.getPRDiff('owner', 'repo', 1);
      
      expect(result).toBe(diffText);
      const options = vi.mocked(fetch).mock.calls[0][1];
      expect((options?.headers as Headers).get('Accept')).toBe('application/vnd.github.diff');
    });
  });

  describe('getPRFiles', () => {
    it('should filter out binary and lock files', async () => {
      const mockFiles = [
        { filename: 'src/index.ts', status: 'modified' },
        { filename: 'package-lock.json', status: 'modified' },
        { filename: 'image.png', status: 'binary' },
        { filename: 'src/utils.ts', status: 'added' },
      ];
      vi.mocked(fetch).mockReturnValue(mockFetchResponse(mockFiles));
      
      const result = await client.getPRFiles('owner', 'repo', 1);
      
      expect(result).toEqual(['src/index.ts', 'src/utils.ts']);
    });
  });

  describe('getPRDetails', () => {
    it('should return parsed PR details', async () => {
      const mockDetails = { title: 'Test PR', body: 'Hello' };
      vi.mocked(fetch).mockReturnValue(mockFetchResponse(mockDetails));
      
      const result = await client.getPRDetails('owner', 'repo', 1);
      
      expect(result).toEqual(mockDetails);
    });
  });

  describe('updatePR', () => {
    it('should use PATCH method and send JSON body', async () => {
      vi.mocked(fetch).mockReturnValue(mockFetchResponse({}));
      
      await client.updatePR('owner', 'repo', 1, 'New Title', 'New Body');
      
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(options?.method).toBe('PATCH');
      expect(JSON.parse(options?.body as string)).toEqual({
        title: 'New Title',
        body: 'New Body',
      });
    });
  });

  describe('addLabels', () => {
    it('should use POST method and send labels', async () => {
      vi.mocked(fetch).mockReturnValue(mockFetchResponse({}));
      
      await client.addLabels('owner', 'repo', 1, ['bug', 'urgent']);
      
      const options = vi.mocked(fetch).mock.calls[0][1];
      expect(options?.method).toBe('POST');
      expect(JSON.parse(options?.body as string)).toEqual({
        labels: ['bug', 'urgent'],
      });
    });
  });

  describe('postComment', () => {
    it('should post a comment using POST', async () => {
      vi.mocked(fetch).mockReturnValue(mockFetchResponse({}));
      
      await client.postComment('owner', 'repo', 1, 'AI Review');
      
      const options = vi.mocked(fetch).mock.calls[0][1];
      expect(options?.method).toBe('POST');
      expect(JSON.parse(options?.body as string)).toEqual({
        body: 'AI Review',
      });
    });
  });

  describe('listComments', () => {
    it('should return a list of comments', async () => {
      const mockComments = [{ id: 1, body: 'comment 1' }, { id: 2, body: 'comment 2' }];
      vi.mocked(fetch).mockReturnValue(mockFetchResponse(mockComments));
      
      const result = await client.listComments('owner', 'repo', 1);
      
      expect(result).toEqual(mockComments);
    });
  });

  describe('deleteComment', () => {
    it('should use DELETE method', async () => {
      vi.mocked(fetch).mockReturnValue(mockFetchResponse({}));
      
      await client.deleteComment('owner', 'repo', 1, 123);
      
      const options = vi.mocked(fetch).mock.calls[0][1];
      expect(options?.method).toBe('DELETE');
    });
  });
});
