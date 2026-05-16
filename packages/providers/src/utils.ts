import { LLMProvider, GenerateRequest, GenerateResponse } from '@gh-ai-workflows/core';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; initialDelay: number } = { maxRetries: 3, initialDelay: 1000 }
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      if (e.retryable === false) throw e;
      
      const delay = options.initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}
