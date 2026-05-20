import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient } from '../index';

describe('GitHubClient Labels', () => {
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
});
