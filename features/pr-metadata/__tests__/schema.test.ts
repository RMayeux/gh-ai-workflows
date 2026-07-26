import { describe, it, expect } from 'vitest';
import { PRMetadataSchema } from '../schema';

const VALID_METADATA = {
  title: 'feat(auth): add session rotation',
  summary: 'Add session rotation to auth module with token refresh',
  changes: [
    'features/pr-metadata/schema.ts: Replace body with structured summary/changes/fixes',
    'features/pr-metadata/prompt.ts: Rewrite system prompt with new schema rules',
  ],
  fixes: [
    'src/core/parser.ts: Correct off-by-one error in line count',
  ],
};

const VALID_MINIMAL_METADATA = {
  title: 'fix: resolve crash on login',
  summary: 'Fix null pointer exception in login flow',
  changes: [
    'src/login/auth.ts: Add null check before user lookup',
  ],
};

describe('PRMetadataSchema', () => {
  it('should parse a valid full metadata object', () => {
    const result = PRMetadataSchema.safeParse(VALID_METADATA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(VALID_METADATA);
    }
  });

  it('should parse a valid minimal metadata object without fixes', () => {
    const result = PRMetadataSchema.safeParse(VALID_MINIMAL_METADATA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        ...VALID_MINIMAL_METADATA,
        fixes: undefined,
      });
    }
  });

  it('should fail if title is missing', () => {
    const invalid = { summary: '...', changes: ['path: clause'] };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('title'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if title exceeds 72 characters', () => {
    const invalid = {
      title: 'a'.repeat(73),
      summary: 'valid summary',
      changes: ['path: clause'],
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('title'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if summary exceeds 150 characters', () => {
    const invalid = {
      title: 'valid title',
      summary: 'a'.repeat(151),
      changes: ['path: clause'],
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('summary'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if summary is missing', () => {
    const invalid = { title: 'valid title', changes: ['path: clause'] };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('summary'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if changes is an empty array', () => {
    const invalid = {
      title: 'valid title',
      summary: 'valid summary',
      changes: [],
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('changes'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if changes has non-string elements', () => {
    const invalid = {
      title: 'valid title',
      summary: 'valid summary',
      changes: [123],
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('changes'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if fixes has non-string elements', () => {
    const invalid = {
      title: 'valid title',
      summary: 'valid summary',
      changes: ['path: clause'],
      fixes: [true],
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('fixes'));
      expect(error).toBeDefined();
    }
  });

  it('should fail for an empty object', () => {
    const result = PRMetadataSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
