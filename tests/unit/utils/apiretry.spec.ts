/**
 * Retry Utility Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApiRetry,
  DEFAULT_RETRY_CONFIG,
  RetryExhaustedError,
} from '../../../src-electron/utils/apiretry.js';

describe('API Retry Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApiRetry.execute - Success Cases', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should succeed after 2 failures (3 attempts total)', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const result = await ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should retry on 500 status code', async () => {
      const error = new Error('Server error') as Error & { status: number };
      error.status = 500;

      const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const result = await ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ECONNRESET error', async () => {
      const error = new Error('Connection reset') as { code?: string };
      error.code = 'ECONNRESET';

      const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const result = await ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('ApiRetry.execute - Failure Cases', () => {
    it('should throw RetryExhaustedError after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test')).rejects.toThrow(
        RetryExhaustedError,
      );

      expect(fn).toHaveBeenCalledTimes(3); // maxAttempts
    });

    it('should not retry on non-retryable error (400)', async () => {
      const error = new Error('Bad request') as Error & { status: number };
      error.status = 400;

      const fn = vi.fn().mockRejectedValue(error);

      await expect(ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test')).rejects.toThrow(
        'Bad request',
      );

      expect(fn).toHaveBeenCalledTimes(1); // Only 1 attempt
    });

    it('should not retry on authentication error', async () => {
      const error = new Error('Not authenticated');

      const fn = vi.fn().mockRejectedValue(error);

      await expect(ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test')).rejects.toThrow(
        'Not authenticated',
      );

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should include last error in RetryExhaustedError', async () => {
      const originalError = new Error('Network error');
      const fn = vi.fn().mockRejectedValue(originalError);

      try {
        await ApiRetry.execute(fn, DEFAULT_RETRY_CONFIG, 'test');
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
        expect((error as RetryExhaustedError).lastError).toBe(originalError);
        expect((error as RetryExhaustedError).attempts).toBe(3);
      }
    });
  });

  describe('ApiRetry.execute - Retry Configuration', () => {
    it('should respect custom maxAttempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));
      const customConfig = {
        ...DEFAULT_RETRY_CONFIG,
        maxAttempts: 5,
        baseDelayMs: 10, // Much faster for testing
      };

      await expect(ApiRetry.execute(fn, customConfig, 'test')).rejects.toThrow(RetryExhaustedError);

      expect(fn).toHaveBeenCalledTimes(5);
    }, 5000); // 5 second timeout

    it('should respect custom retryable statuses', async () => {
      const error = new Error('Rate limited') as Error & { status: number };
      error.status = 429;

      const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const customConfig = {
        ...DEFAULT_RETRY_CONFIG,
        retryableStatuses: [429], // Add 429 as retryable
      };

      const result = await ApiRetry.execute(fn, customConfig, 'test');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not use jitter when disabled', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const customConfig = {
        ...DEFAULT_RETRY_CONFIG,
        useJitter: false,
        baseDelayMs: 100,
      };

      const startTime = Date.now();
      await ApiRetry.execute(fn, customConfig, 'test');
      const duration = Date.now() - startTime;

      // Should be ~100ms (no jitter) - allow for execution overhead
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(250);
    });
  });

  describe('ApiRetry.execute - Exponential Backoff', () => {
    it('should use exponential backoff (1s, 2s, 4s)', async () => {
      const error = new Error('Network error');
      const fn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const config = {
        ...DEFAULT_RETRY_CONFIG,
        useJitter: false, // Disable jitter for predictable timing
        baseDelayMs: 100, // Use smaller delays for testing
      };

      const startTime = Date.now();
      await ApiRetry.execute(fn, config, 'test');
      const duration = Date.now() - startTime;

      // First retry: 100ms, Second retry: 200ms = ~300ms total
      expect(duration).toBeGreaterThanOrEqual(280);
      expect(duration).toBeLessThan(500);
    });

    it('should cap delay at maxDelayMs', async () => {
      const error = new Error('Network error');
      const fn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const config = {
        ...DEFAULT_RETRY_CONFIG,
        useJitter: false,
        baseDelayMs: 1000,
        maxDelayMs: 1500, // Cap at 1.5s
      };

      const startTime = Date.now();
      await ApiRetry.execute(fn, config, 'test');
      const duration = Date.now() - startTime;

      // First retry: 1000ms, Second retry: capped at 1500ms = ~2500ms total
      expect(duration).toBeGreaterThanOrEqual(2400);
      expect(duration).toBeLessThan(3500);
    });
  });
});
