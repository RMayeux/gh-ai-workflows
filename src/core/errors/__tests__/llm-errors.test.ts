import { describe, it, expect } from 'vitest';
import { LLMError, RateLimitError, AuthenticationError, InvalidRequestError, ProviderError } from '../llm-errors';

describe('LLMError', () => {
  it('creates an error with message, code, and retryable defaulting to false', () => {
    const err = new LLMError('Something went wrong', 'UNKNOWN');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe('UNKNOWN');
    expect(err.retryable).toBe(false);
    expect(err.name).toBe('LLMError');
  });

  it('stores the original error', () => {
    const original = new Error('original');
    const err = new LLMError('wrapped', 'WRAPPED', original, false);
    expect(err.originalError).toBe(original);
  });

  it('sets retryable to true when passed', () => {
    const err = new LLMError('retry me', 'RETRY', undefined, true);
    expect(err.retryable).toBe(true);
  });
});

describe('RateLimitError', () => {
  it('creates with default message and retryable=true', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Rate limit exceeded');
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('RateLimitError');
  });

  it('creates with custom message and original error', () => {
    const original = new Error('too many');
    const err = new RateLimitError('Custom message', original);
    expect(err.message).toBe('Custom message');
    expect(err.originalError).toBe(original);
  });
});

describe('AuthenticationError', () => {
  it('creates with default message and retryable=false', () => {
    const err = new AuthenticationError();
    expect(err.message).toBe('Authentication failed');
    expect(err.code).toBe('AUTHENTICATION_FAILED');
    expect(err.retryable).toBe(false);
    expect(err.name).toBe('AuthenticationError');
  });
});

describe('InvalidRequestError', () => {
  it('creates with default message and retryable=false', () => {
    const err = new InvalidRequestError();
    expect(err.message).toBe('Invalid request');
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.retryable).toBe(false);
    expect(err.name).toBe('InvalidRequestError');
  });
});

describe('ProviderError', () => {
  it('creates with default message and retryable=true', () => {
    const err = new ProviderError();
    expect(err.message).toBe('Provider internal error');
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('ProviderError');
  });
});
