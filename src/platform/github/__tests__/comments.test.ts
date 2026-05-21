import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertBotComment } from '../comments';
import { GitHubClient } from '../index';
import { Logger } from '@core/telemetry';

vi.mock('../index', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      listComments: vi.fn(),
      deleteComment: vi.fn(),
      updateComment: vi.fn(),
      postComment: vi.fn(),
    })),
  };
});

vi.mock('@core/telemetry', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('upsertBotComment', () => {
  let ghClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    ghClient = new GitHubClient('token');
  });

  it('should update the most recent bot comment and delete older ones', async () => {
    const mockComments = [
      { id: 1, body: '🤖 AI Review: Old', created_at: '2023-01-01T00:00:00Z' },
      { id: 2, body: 'Some user comment', created_at: '2023-01-02T00:00:00Z' },
      { id: 3, body: '🤖 AI Review: Newest', created_at: '2023-01-03T00:00:00Z' },
      { id: 4, body: '🤖 AI Review: Mid', created_at: '2023-01-02T00:00:00Z' },
    ];
    
    ghClient.listComments.mockResolvedValue(mockComments);
    ghClient.deleteComment.mockResolvedValue({});
    ghClient.updateComment.mockResolvedValue({});

    await upsertBotComment(ghClient, 'owner', 'repo', 1, '🤖 AI Review', 'New Content');

    expect(ghClient.listComments).toHaveBeenCalledWith('owner', 'repo', 1);
    // Should delete id 1 and id 4
    expect(ghClient.deleteComment).toHaveBeenCalledTimes(2);
    expect(ghClient.deleteComment).toHaveBeenCalledWith('owner', 'repo', 1);
    expect(ghClient.deleteComment).toHaveBeenCalledWith('owner', 'repo', 4);
    // Should update id 3
    expect(ghClient.updateComment).toHaveBeenCalledWith('owner', 'repo', 3, 'New Content');
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Updated existing 🤖 AI Review comment'));
  });

  it('should post a new comment if no bot comments are found', async () => {
    const mockComments = [
      { id: 1, body: 'Some user comment' },
    ];
    
    ghClient.listComments.mockResolvedValue(mockComments);
    ghClient.postComment.mockResolvedValue({});

    await upsertBotComment(ghClient, 'owner', 'repo', 1, '🤖 AI Review', 'New Content');

    expect(ghClient.deleteComment).not.toHaveBeenCalled();
    expect(ghClient.updateComment).not.toHaveBeenCalled();
    expect(ghClient.postComment).toHaveBeenCalledWith('owner', 'repo', 1, 'New Content');
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Posted new 🤖 AI Review comment'));
  });

  it('should throw if listComments fails', async () => {
    ghClient.listComments.mockRejectedValue(new Error('GitHub API Failure'));

    await expect(upsertBotComment(ghClient, 'owner', 'repo', 1, '🤖 AI Review', 'New Content'))
      .rejects.toThrow('GitHub API Failure');
    
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to upsert bot comment: GitHub API Failure'));
  });

  it('should throw if updateComment fails', async () => {
    const mockComments = [
      { id: 2, body: '🤖 AI Review: Fixed', created_at: '2023-01-01T00:00:00Z' },
    ];
    ghClient.listComments.mockResolvedValue(mockComments);
    ghClient.updateComment.mockRejectedValue(new Error('Update Failed'));

    await expect(upsertBotComment(ghClient, 'owner', 'repo', 1, '🤖 AI Review', 'New Content'))
      .rejects.toThrow('Update Failed');
    
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to upsert bot comment: Update Failed'));
  });
});
