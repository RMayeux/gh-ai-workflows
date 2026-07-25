import { describe, it, expect } from 'vitest';
import { formatTimestamp } from '../date';

describe('formatTimestamp', () => {
  it('formats a given date in French UTC format', () => {
    const date = new Date('2026-05-21T21:01:00Z');
    const result = formatTimestamp(date);
    expect(result).toMatch(/21 mai 2026 \u00e0 21:01 UTC/);
  });

  it('includes UTC at the end', () => {
    const date = new Date('2025-01-01T00:00:00Z');
    const result = formatTimestamp(date);
    expect(result).toMatch(/UTC$/);
  });

  it('uses current date when no argument is passed', () => {
    const result = formatTimestamp();
    expect(result).toMatch(/UTC$/);
  });

  it('formats a date at midnight correctly', () => {
    const date = new Date('2026-12-31T23:59:00Z');
    const result = formatTimestamp(date);
    expect(result).toMatch(/31 décembre 2026 \u00e0 23:59 UTC/);
  });
});
