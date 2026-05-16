export class LLMError extends Error {
  constructor(
    public message: string,
    public code: string,
    public originalError?: unknown,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class RateLimitError extends LLMError {
  constructor(message = 'Rate limit exceeded', originalError?: unknown) {
    super(message, 'RATE_LIMIT_EXCEEDED', originalError, true);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends LLMError {
  constructor(message = 'Authentication failed', originalError?: unknown) {
    super(message, 'AUTHENTICATION_FAILED', originalError, false);
    this.name = 'AuthenticationError';
  }
}

export class InvalidRequestError extends LLMError {
  constructor(message = 'Invalid request', originalError?: unknown) {
    super(message, 'INVALID_REQUEST', originalError, false);
    this.name = 'InvalidRequestError';
  }
}

export class ProviderError extends LLMError {
  constructor(message = 'Provider internal error', originalError?: unknown) {
    super(message, 'PROVIDER_ERROR', originalError, true);
    this.name = 'ProviderError';
  }
}
