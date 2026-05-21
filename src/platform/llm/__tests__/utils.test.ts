import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, withTimeout } from '../utils';
import { LLMError } from '@core/errors/llm-errors';

describe('LLM Utils', () => {
  describe('withRetry', () => {
    it('should return the value if the function succeeds on the first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry if the function throws a retryable error and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new LLMError('Transient Error', 'TRANSIENT', undefined, true))
        .mockRejectedValueOnce(new LLMError('Transient Error', 'TRANSIENT', undefined, true))
        .mockResolvedValue('success');
      
      vi.useFakeTimers();
      const promise = withRetry(fn, { maxRetries: 3, initialDelay: 100 });
      
      await vi.runAllTimersAsync();
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('should throw immediately if the error is not retryable', async () => {
      const fn = vi.fn().mockRejectedValue(new LLMError('Fatal Error', 'FATAL', undefined, false));
      
      await expect(withRetry(fn)).rejects.toThrow('Fatal Error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw the last error if max retries are reached', async () => {
      const fn = vi.fn().mockRejectedValue(new LLMError('Transient Error', 'TRANSIENT', undefined, true));
      
      vi.useFakeTimers();
      const promise = withRetry(fn, { maxRetries: 2, initialDelay: 100 });
      
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Transient Error');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
      vi.useRealTimers();
    });

    it('should throw the error if it is not an LLMError but is retryable by default', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Generic Error'));
        
        vi.useFakeTimers();
        const promise = withRetry(fn, { maxRetries: 1, initialDelay: 100 });
        
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow('Generic Error');
        expect(fn).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });
  });

  describe('withTimeout', () => {
    it('should return the value if the function completes within the timeout', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      };
      
      vi.useFakeTimers();
      const promise = withTimeout(fn, 500);
      
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe('success');
      vi.useRealTimers();
    });

    it('should throw a timeout error if the function exceeds the timeout', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      };
      
      vi.useFakeTimers();
      const promise = withTimeout(fn, 500);
      
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Operation timed out after 500ms');
      vi.useRealTimers();
    });
  });
});
