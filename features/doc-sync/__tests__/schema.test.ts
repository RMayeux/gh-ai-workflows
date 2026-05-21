import { describe, it, expect } from 'vitest';
import { DocSyncSchema, DocSyncInputsSchema } from '../schema';

const VALID_SYNC = {
  summary: 'Update authentication docs to reflect the new session rotation flow.',
  changes: [
    {
      path: 'docs/auth.md',
      action: 'update',
      content: '# Auth Guide\nUpdated content...',
      explanation: 'Updated the session rotation section.',
    },
    {
      path: 'docs/old-auth.md',
      action: 'delete',
      content: '',
      explanation: 'Deprecated file.',
    }
  ],
};

describe('DocSyncSchema', () => {
  it('should parse a valid sync result', () => {
    const result = DocSyncSchema.safeParse(VALID_SYNC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(VALID_SYNC);
    }
  });

  it('should fail if summary is missing', () => {
    const invalid = { changes: [] };
    const result = DocSyncSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if changes is not an array', () => {
    const invalid = { summary: '...', changes: 'no changes' };
    const result = DocSyncSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if a change has an invalid action', () => {
    const invalid = {
      summary: '...',
      changes: [
        { path: 'a.md', action: 'invalid', content: '', explanation: '...' }
      ],
    };
    const result = DocSyncSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if any required change field is missing', () => {
    const invalid = {
      summary: '...',
      changes: [
        { path: 'a.md', action: 'update' } // missing content, explanation
      ],
    };
    const result = DocSyncSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if there are extra fields (strict mode)', () => {
    const invalid = {
      summary: '...',
      changes: [],
      extra: 'field',
    };
    const result = DocSyncSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('DocSyncInputsSchema', () => {
  const VALID_INPUTS = {
    githubToken: 'ghp_token',
    llm: 'openai',
    model: 'gpt-4',
    apiKey: 'sk-key',
    owner: 'owner',
    repo: 'repo',
    docPattern: '.*\\.md',
  };

  it('should parse valid minimal inputs', () => {
    const result = DocSyncInputsSchema.safeParse(VALID_INPUTS);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lookbackCommits).toBe(10);
    }
  });

  it('should parse valid full inputs', () => {
    const result = DocSyncInputsSchema.safeParse({
      ...VALID_INPUTS,
      pullNumber: 1,
      lookbackCommits: 20,
      debug: true,
    });
    expect(result.success).toBe(true);
  });

  it('should fail if a required field is missing', () => {
    const { githubToken, ...invalid } = VALID_INPUTS;
    const result = DocSyncInputsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should fail if pullNumber is not a positive integer', () => {
    const result = DocSyncInputsSchema.safeParse({
      ...VALID_INPUTS,
      pullNumber: -1,
    });
    expect(result.success).toBe(false);
  });
});
