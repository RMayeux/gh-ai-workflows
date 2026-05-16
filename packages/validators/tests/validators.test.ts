import { describe, it, expect } from 'vitest';
import { Validator, PRMetadataSchema } from '../src/index';
import { z } from 'zod';

describe('Validator', () => {
  it('should validate correct data', () => {
    const schema = z.object({ name: z.string() });
    const result = Validator.validate(schema, { name: 'Test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Test' });
  });

  it('should return errors for invalid data', () => {
    const schema = z.object({ name: z.string() });
    const result = Validator.validate(schema, { name: 123 });
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].path).toBe('name');
  });

  it('should format errors into a human-readable string', () => {
    const errors = [
      { path: 'name', message: 'Required', code: 'invalid_type' },
      { path: 'age', message: 'Too young', code: 'too_small' },
    ];
    const formatted = Validator.formatErrors(errors);
    expect(formatted).toBe('[name] Required (invalid_type)\n[age] Too young (too_small)');
  });
});

describe('PRMetadataSchema', () => {
  it('should validate a correct PR metadata object', () => {
    const validData = {
      title: 'feat(auth): add oauth2 support',
      body: 'Implemented OAuth2 for Google login.',
      change_type: 'feat',
      breaking: false,
      doc_impact: true,
      doc_slugs: ['auth/oauth2'],
    };
    const result = PRMetadataSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail if title is too long', () => {
    const invalidData = {
      title: 'a'.repeat(73),
      body: '...',
      change_type: 'feat',
      breaking: false,
      doc_impact: false,
      doc_slugs: [],
    };
    const result = PRMetadataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should fail if change_type is invalid', () => {
    const invalidData = {
      title: 'Valid title',
      body: '...',
      change_type: 'invalid_type',
      breaking: false,
      doc_impact: false,
      doc_slugs: [],
    };
    const result = PRMetadataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
