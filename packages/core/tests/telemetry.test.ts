import { describe, it, expect } from 'vitest';
import { Logger } from '../src/telemetry';

describe('Logger Secret Masking', () => {
  it('should mask registered secrets in log messages', () => {
    const secret = 'sk-1234567890abcdef';
    Logger.addSecret(secret);
    
    const message = `The API key is ${secret}`;
    const masked = Logger.mask(message);
    
    expect(masked).not.toContain(secret);
    expect(masked).toContain('***');
  });

  it('should not mask non-secret text', () => {
    const message = 'This is a normal log message';
    const masked = Logger.mask(message);
    expect(masked).toBe(message);
  });
});
