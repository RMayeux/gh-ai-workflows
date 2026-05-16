import { GitHubClient } from '../../src/index';
import { PRFixture } from '@gh-ai-workflows/core/testing';

export class MockGitHubClient extends GitHubClient {
  constructor(public fixture: PRFixture) {
    super('mock-token');
  }

  async getPRDiff() {
    return this.fixture.diff;
  }

  async getPRFiles() {
    return this.fixture.files;
  }

  async getPRDetails() {
    return this.fixture.details as any;
  }

  async updatePR() {
    return { status: 'success' };
  }

  async addLabels() {
    return { status: 'success' };
  }

  async postComment() {
    return { status: 'success' };
  }
}
