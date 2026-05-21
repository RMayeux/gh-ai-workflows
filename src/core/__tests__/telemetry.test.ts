import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../telemetry';

describe('Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset secrets by clearing the internal set via a trick or adding a reset method.
    // Since secrets is private static, we can't easily reset it.
    // However, for these tests we can use unique secrets.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mask', () => {
    it('should mask strings containing registered secrets', () => {
      const secret = 'sk-test-123456789';
      Logger.addSecret(secret);
      
      expect(Logger.mask(`API Key is ${secret}`)).toBe('API Key is ***');
      expect(Logger.mask(`Key: ${secret}, and again ${secret}`)).toBe('Key: ***, and again ***');
    });

    it('should mask secrets inside arrays', () => {
      const secret = 'secret-value';
      Logger.addSecret(secret);
      
      expect(Logger.mask(['plain', secret, 'another'])).toEqual(['plain', '***', 'another']);
    });

    it('should mask secrets inside objects', () => {
      const secret = 'secret-value';
      Logger.addSecret(secret);
      
      const obj = {
        key: secret,
        nested: {
          val: secret,
          other: 'plain'
        },
        list: [secret, 'plain']
      };
      
      expect(Logger.mask(obj)).toEqual({
        key: '***',
        nested: {
          val: '***',
          other: 'plain'
        },
        list: ['***', 'plain']
      });
    });

    it('should not mask short secrets (length <= 3)', () => {
      const shortSecret = '123';
      Logger.addSecret(shortSecret);
      expect(Logger.mask(`Value is ${shortSecret}`)).toBe(`Value is ${shortSecret}`);
    });

    it('should handle non-string values gracefully', () => {
      expect(Logger.mask(123)).toBe(123);
      expect(Logger.mask(true)).toBe(true);
      expect(Logger.mask(null)).toBe(null);
    });
  });

  describe('log methods', () => {
    it('should mask message and args in log()', () => {
      const secret = 'log-secret';
      Logger.addSecret(secret);
      
      Logger.log(`This is a ${secret}`, { key: secret });
      
      expect(console.log).toHaveBeenCalledWith('This is a ***', { key: '***' });
    });

    it('should mask message and args in error()', () => {
      const secret = 'err-secret';
      Logger.addSecret(secret);
      
      Logger.error(`Error with ${secret}`, secret);
      
      expect(console.error).toHaveBeenCalledWith('Error with ***', '***');
    });

    it('should mask message and args in warn()', () => {
      const secret = 'warn-secret';
      Logger.addSecret(secret);
      
      Logger.warn(`Warning ${secret}`, secret);
      
      expect(console.warn).toHaveBeenCalledWith('Warning ***', '***');
    });

    it('should only log debug() when DEBUG=true', () => {
      vi.stubEnv('DEBUG', 'false');
      Logger.debug('hidden');
      expect(console.log).not.toHaveBeenCalled();

      vi.stubEnv('DEBUG', 'true');
      Logger.debug('visible');
      expect(console.log).toHaveBeenCalledWith('[DEBUG] visible');
    });

    it('should mask in debugProvider()', () => {
      vi.stubEnv('DEBUG', 'true');
      const secret = 'prov-secret';
      Logger.addSecret(secret);
      
      Logger.debugProvider('openai', 'REQUEST', { apiKey: secret });
      
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG] [openai] REQUEST:', 
        { apiKey: '***' }
      );
    });
  });
});
