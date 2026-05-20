import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient } from '../index';

describe('GitHubClient Comments', () => {
  const token = 'test-token';
  const client = new GitHubClient(token);

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  const mockFetchResponse = (data: unknown, ok = true, status = 200, isText = false) => {
    return Promise.resolve({
      ok,
      status,
      text: () => Promise.resolve(isText ? String(data) : JSON.stringify(data)),
      json: () => Promise.resolve(data),
    } as Response);
  };

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
