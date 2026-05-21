import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceBotComments } from '../comments';
import { GitHubClient } from '../index';
import { Logger } from '@core/telemetry';

vi.mock('../index', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      listComments: vi.fn(),
      deleteComment: vi.fn(),
    })),
  };
});

vi.mock('@core/telemetry', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('replaceBotComments', () => {
  let ghClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    ghClient = new GitHubClient('token');
  });

  it('should remove comments that contain the identifier', async () => {
    const mockComments = [
      { id: 1, body: 'Some user comment' },
      { id: 2, body: '🤖 AI Review: Fixed' },
      { id: 3, body: '🤖 AI Review: Another one' },
      { id: 4, body: 'Another user comment' },
    ];
    
    ghClient.listComments.mockResolvedValue(mockComments);
    ghClient.deleteComment.mockResolvedValue({});

    await replaceBotComments(ghClient, 'owner', 'repo', 1, '🤖 AI Review');

    expect(ghClient.listComments).toHaveBeenCalledWith('owner', 'repo', 1);
    expect(ghClient.deleteComment).toHaveBeenCalledTimes(2);
    expect(ghClient.deleteComment).toHaveBeenCalledWith('owner', 'repo', 2);
    expect(ghClient.deleteComment).toHaveBeenCalledWith('owner', 'repo', 3);
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Removed 2 previous 🤖 AI Review comments'));
  });

  it('should do nothing if no bot comments are found', async () => {
    const mockComments = [
      { id: 1, body: 'Some user comment' },
    ];
    
    ghClient.listComments.mockResolvedValue(mockComments);

    await replaceBotComments(ghClient, 'owner', 'repo', 1, '🤖 AI Review');

    expect(ghClient.deleteComment).not.toHaveBeenCalled();
    expect(Logger.log).not.toHaveBeenCalled();
  });

  it('should log an error but not throw if listComments fails', async () => {
    ghClient.listComments.mockRejectedValue(new Error('GitHub API Failure'));

    await expect(replaceBotComments(ghClient, 'owner', 'repo', 1, '🤖 AI Review'))
      .resolves.not.toThrow();
    
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to clean up old comments: GitHub API Failure'));
  });

  it('should log an error but not throw if deleteComment fails', async () => {
    const mockComments = [
      { id: 2, body: '🤖 AI Review: Fixed' },
    ];
    ghClient.listComments.mockResolvedValue(mockComments);
    ghClient.deleteComment.mockRejectedValue(new Error('Delete Failed'));

    await expect(replaceBotComments(ghClient, 'owner', 'repo', 1, '🤖 AI Review'))
      .resolves.not.toThrow();
    
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to clean up old comments: Delete Failed'));
  });
});
