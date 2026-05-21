import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncLabels } from '../labels';
import { GitHubClient } from '../index';

vi.mock('../index', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      addLabels: vi.fn().mockResolvedValue([]),
      removeLabel: vi.fn().mockResolvedValue({}),
    })),
  };
});

describe('syncLabels', () => {
  let ghClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    ghClient = new GitHubClient('token');
  });

  it('should add labels when provided', async () => {
    const addLabels = ['label1', 'label2'];
    await syncLabels(ghClient, 'owner', 'repo', 1, { add: addLabels });

    expect(ghClient.addLabels).toHaveBeenCalledWith('owner', 'repo', 1, addLabels);
    expect(ghClient.removeLabel).not.toHaveBeenCalled();
  });

  it('should remove labels when provided', async () => {
    const removeLabels = ['old1', 'old2'];
    await syncLabels(ghClient, 'owner', 'repo', 1, { remove: removeLabels });

    expect(ghClient.removeLabel).toHaveBeenCalledTimes(2);
    expect(ghClient.removeLabel).toHaveBeenCalledWith('owner', 'repo', 1, 'old1');
    expect(ghClient.removeLabel).toHaveBeenCalledWith('owner', 'repo', 1, 'old2');
    expect(ghClient.addLabels).not.toHaveBeenCalled();
  });

  it('should do both adding and removing', async () => {
    await syncLabels(ghClient, 'owner', 'repo', 1, { 
      add: ['new'], 
      remove: ['old'] 
    });

    expect(ghClient.addLabels).toHaveBeenCalledWith('owner', 'repo', 1, ['new']);
    expect(ghClient.removeLabel).toHaveBeenCalledWith('owner', 'repo', 1, 'old');
  });

  it('should ignore errors when removing a label that does not exist', async () => {
    ghClient.removeLabel.mockRejectedValue(new Error('Label not found'));
    
    await expect(syncLabels(ghClient, 'owner', 'repo', 1, { remove: ['missing'] }))
      .resolves.not.toThrow();
    
    expect(ghClient.removeLabel).toHaveBeenCalledWith('owner', 'repo', 1, 'missing');
  });

  it('should do nothing when neither add nor remove is provided', async () => {
    await syncLabels(ghClient, 'owner', 'repo', 1, {});
    expect(ghClient.addLabels).not.toHaveBeenCalled();
    expect(ghClient.removeLabel).not.toHaveBeenCalled();
  });
});
