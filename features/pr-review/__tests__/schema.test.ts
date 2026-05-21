import { describe, it, expect } from 'vitest';
import { PRReviewSchema } from '../schema';

const VALID_REVIEW = {
  summary: 'This PR implements a new caching layer for user sessions to reduce database load.',
  issues: [
    {
      severity: 'error',
      description: 'The cache key does not include the user ID, leading to session leakage between users.'
    },
    {
      severity: 'warning',
      description: 'The cache TTL is set to 24 hours, which might be too long for session data.'
    },
    {
      severity: 'info',
      description: 'Consider using a more descriptive name for the CacheManager class.'
    }
  ],
  approved: false,
};

const VALID_MINIMAL_REVIEW = {
  summary: 'This PR fixes a typo in the README.',
  approved: true,
};

describe('PRReviewSchema', () => {
  it('should parse a valid full review', () => {
    const result = PRReviewSchema.safeParse(VALID_REVIEW);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(VALID_REVIEW);
    }
  });

  it('should parse a valid minimal review and apply defaults', () => {
    const result = PRReviewSchema.safeParse(VALID_MINIMAL_REVIEW);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        ...VALID_MINIMAL_REVIEW,
        issues: [],
      });
    }
  });

  it('should fail if summary is missing', () => {
    const invalid = { approved: true };
    const result = PRReviewSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('summary'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if summary is empty string', () => {
    const invalid = { summary: '', approved: true };
    const result = PRReviewSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('summary'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if approved is not a boolean', () => {
    const invalid = { summary: 'Fixed bug', approved: 'yes' };
    const result = PRReviewSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('approved'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if issues is not an array', () => {
    const invalid = { summary: 'Fixed bug', issues: 'no issues' };
    const result = PRReviewSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('issues'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if an issue has an invalid severity', () => {
    const invalid = {
      summary: 'Fixed bug',
      issues: [
        { severity: 'critical', description: 'Should be error' }
      ],
    };
    const result = PRReviewSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('severity'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if an issue is missing description', () => {
    const invalid = {
      summary: 'Fixed bug',
      issues: [
        { severity: 'error' }
      ],
    };
    const result = PRReviewSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('description'));
      expect(error).toBeDefined();
    }
  });

  it('should fail for an empty object', () => {
    const result = PRReviewSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
