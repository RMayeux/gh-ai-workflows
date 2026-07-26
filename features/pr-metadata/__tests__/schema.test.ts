import { describe, it, expect } from 'vitest';
import { PRMetadataSchema } from '../schema';

const VALID_METADATA = {
  title: 'feat: implement user authentication',
  summary: 'Add JWT authentication to the API with refresh token rotation',
  body: 'Changes\n- src/auth: add JWT token generation and validation\n\nVerification\n- ✅ all auth tests pass',
  change_type: 'feat',
  breaking: false,
  doc_impact: true,
  doc_slugs: ['auth-guide', 'api-reference'],
};

const VALID_MINIMAL_METADATA = {
  title: 'fix: resolve crash on login',
  summary: 'Fix null pointer exception in login flow',
  body: 'Fixes\n- src/login: null check before user lookup\n\nVerification\n- ✅ login flow tested',
  change_type: 'fix',
};

describe('PRMetadataSchema', () => {
  it('should parse a valid full metadata object', () => {
    const result = PRMetadataSchema.safeParse(VALID_METADATA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(VALID_METADATA);
    }
  });

  it('should parse a valid minimal metadata object and apply defaults', () => {
    const result = PRMetadataSchema.safeParse(VALID_MINIMAL_METADATA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        ...VALID_MINIMAL_METADATA,
        breaking: false,
        doc_impact: false,
        doc_slugs: [],
      });
    }
  });

  it('should fail if title is missing', () => {
    const invalid = { summary: '...', body: '...', change_type: 'feat' };
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
      body: '...',
      change_type: 'feat',
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
      body: '...',
      change_type: 'feat',
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('summary'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if summary is missing', () => {
    const invalid = {
      title: 'valid title',
      body: '...',
      change_type: 'feat',
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('summary'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if body is missing', () => {
    const invalid = { title: '...', summary: '...', change_type: 'feat' };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('body'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if change_type is not in the enum', () => {
    const invalid = {
      title: '...',
      summary: '...',
      body: '...',
      change_type: 'invalid-type',
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('change_type'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if breaking is not a boolean', () => {
    const invalid = {
      title: '...',
      summary: '...',
      body: '...',
      change_type: 'feat',
      breaking: 'yes',
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('breaking'));
      expect(error).toBeDefined();
    }
  });

  it('should fail if doc_slugs is not an array of strings', () => {
    const invalid = {
      title: '...',
      summary: '...',
      body: '...',
      change_type: 'feat',
      doc_slugs: [123],
    };
    const result = PRMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('doc_slugs'));
      expect(error).toBeDefined();
    }
  });

  it('should fail for an empty object', () => {
    const result = PRMetadataSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
