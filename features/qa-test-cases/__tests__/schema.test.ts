import { describe, it, expect } from 'vitest';
import { QATestCasesSchema, QATestCasesInputsSchema } from '../schema';

const VALID_QA = {
  summary: 'Added a new authentication flow with session rotation.',
  impactedFeatures: [
    {
      featureSlug: 'auth-session',
      testCases: [
        'User logs in → session rotated → old token is invalid',
        'User requests token refresh → new token issued → expiry extended',
      ],
    },
    {
      featureSlug: 'user-profile',
      testCases: [
        'User updates profile → session not invalidated → access maintained',
      ],
    },
  ],
  unchangedTestCases: ['Some old test case'],
  retiredTestCases: ['Some retired test case'],
  totalTests: 4,
};

describe('QATestCasesSchema', () => {
  it('should parse valid QA test cases', () => {
    const result = QATestCasesSchema.safeParse(VALID_QA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(VALID_QA);
    }
  });

  it('should fail if summary is missing', () => {
    const invalid = { impactedFeatures: [], totalTests: 0 };
    const result = QATestCasesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if impactedFeatures is not an array', () => {
    const invalid = { summary: '...', impactedFeatures: 'none', totalTests: 0 };
    const result = QATestCasesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if a feature is missing featureSlug', () => {
    const invalid = {
      summary: '...',
      impactedFeatures: [
        { testCases: ['test 1'] }
      ],
      totalTests: 1,
    };
    const result = QATestCasesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if testCases is not an array', () => {
    const invalid = {
      summary: '...',
      impactedFeatures: [
        { featureSlug: 'feat', testCases: 'test 1' }
      ],
      totalTests: 1,
    };
    const result = QATestCasesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if totalTests is not a number', () => {
    const invalid = {
      summary: '...',
      impactedFeatures: [],
      totalTests: '3',
    };
    const result = QATestCasesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail for an empty object', () => {
    const result = QATestCasesSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('QATestCasesInputsSchema', () => {
  const VALID_INPUTS = {
    githubToken: 'ghp_token',
    llm: 'openai',
    model: 'gpt-4',
    apiKey: 'sk-key',
    owner: 'owner',
    repo: 'repo',
    pullNumber: 123,
  };

  it('should parse valid minimal inputs', () => {
    const result = QATestCasesInputsSchema.safeParse(VALID_INPUTS);
    expect(result.success).toBe(true);
  });

  it('should parse valid full inputs', () => {
    const result = QATestCasesInputsSchema.safeParse({
      ...VALID_INPUTS,
      projectContext: 'Project X is a fintech app.',
      docPattern: '.*\\.md',
      debug: true,
    });
    expect(result.success).toBe(true);
  });

  it('should fail if pullNumber is missing or invalid', () => {
    const { pullNumber, ...invalid } = VALID_INPUTS;
    expect(QATestCasesInputsSchema.safeParse(invalid).success).toBe(false);
    expect(QATestCasesInputsSchema.safeParse({ ...invalid, pullNumber: -1 }).success).toBe(false);
  });
});
