import { describe, it, expect } from 'vitest';
import { PRMetadataSchema } from '../schema';

const VALID_METADATA = {
  title: 'feat(auth): add session rotation',
  summary: 'Add session rotation to auth module with token refresh',
  changes: [
    'Schema: Replace flat body with structured summary/changes/fixes arrays, so each part renders independently. Breaking change for anything consuming the old format.',
    'Prompt: Enforce subject-grouped bullets capped at 20 instead of per-file entries. Risk: model may misjudge significance and bury important files in group summaries.',
  ],
  fixes: [
    'Parser: Correct off-by-one error in line count that caused the last line of every file to be skipped during analysis.',
  ],
};

const VALID_MINIMAL_METADATA = {
  title: 'fix: resolve crash on login',
  summary: 'Fix null pointer exception in login flow',
  changes: [
    'Auth: Add null check before user lookup to prevent crash when user record is missing a profile. No risk — defensive check only.',
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

  it('should fail if changes exceeds 20 bullets', () => {
    const invalid = {
      title: 'valid title',
      summary: 'valid summary',
      changes: Array.from({ length: 21 }, (_, i) => `Change ${i}: some description of what changed.`),
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('changes'));
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
