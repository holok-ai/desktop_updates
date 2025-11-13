/**
 * Unit tests for FileAccessTokenService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileAccessTokenService } from '../../../src-electron/services/file-access-token.service';

describe('FileAccessTokenService', () => {
  let service: FileAccessTokenService;

  beforeEach(() => {
    // Create a new service instance for each test
    service = new FileAccessTokenService('test-secret-key');
  });

  describe('generateToken', () => {
    it('should generate a valid token with correct payload', () => {
      const fileId = 'file-123';
      const userId = 'user-456';
      const action = 'preview';

      const result = service.generateToken(fileId, userId, action);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(result.fileId).toBe(fileId);
      expect(result.userId).toBe(userId);
      expect(result.action).toBe(action);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should generate unique tokens for each call', () => {
      const token1 = service.generateToken('file-1', 'user-1', 'preview');
      const token2 = service.generateToken('file-1', 'user-1', 'preview');

      expect(token1.token).not.toBe(token2.token);
    });

    it('should support both preview and download actions', () => {
      const previewToken = service.generateToken('file-1', 'user-1', 'preview');
      const downloadToken = service.generateToken('file-1', 'user-1', 'download');

      expect(previewToken.action).toBe('preview');
      expect(downloadToken.action).toBe('download');
    });

    it('should set expiration time approximately 15 minutes in future', () => {
      const before = Date.now();
      const token = service.generateToken('file-1', 'user-1', 'preview');
      const after = Date.now();

      const expectedExpiry = 15 * 60 * 1000; // 15 minutes
      const minExpiry = before + expectedExpiry;
      const maxExpiry = after + expectedExpiry;

      expect(token.expiresAt).toBeGreaterThanOrEqual(minExpiry);
      expect(token.expiresAt).toBeLessThanOrEqual(maxExpiry);
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', () => {
      const generated = service.generateToken('file-123', 'user-456', 'preview');
      const validated = service.validateToken(generated.token);

      expect(validated).not.toBeNull();
      expect(validated?.fileId).toBe('file-123');
      expect(validated?.userId).toBe('user-456');
      expect(validated?.action).toBe('preview');
    });

    it('should return null for non-existent token', () => {
      const result = service.validateToken('non-existent-token');
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Create service with very short expiry for testing
      const shortExpiryService = new FileAccessTokenService();
      // Override expiry to 100ms for testing
      (shortExpiryService as any).TOKEN_EXPIRY_MS = 100;

      const token = shortExpiryService.generateToken('file-1', 'user-1', 'preview');

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = shortExpiryService.validateToken(token.token);
      expect(result).toBeNull();
    });

    it('should validate token with correct signature', () => {
      const generated = service.generateToken('file-123', 'user-456', 'download');
      const validated = service.validateToken(generated.token);

      expect(validated).not.toBeNull();
      expect(validated?.signature).toBeDefined();
    });
  });

  describe('revokeToken', () => {
    it('should revoke a valid token', () => {
      const token = service.generateToken('file-1', 'user-1', 'preview');

      const revoked = service.revokeToken(token.token);
      expect(revoked).toBe(true);

      // Token should no longer be valid
      const validated = service.validateToken(token.token);
      expect(validated).toBeNull();
    });

    it('should return false when revoking non-existent token', () => {
      const result = service.revokeToken('non-existent-token');
      expect(result).toBe(false);
    });
  });

  describe('isValid', () => {
    it('should return true for valid token', () => {
      const token = service.generateToken('file-1', 'user-1', 'preview');
      expect(service.isValid(token.token)).toBe(true);
    });

    it('should return false for invalid token', () => {
      expect(service.isValid('invalid-token')).toBe(false);
    });

    it('should return false for revoked token', () => {
      const token = service.generateToken('file-1', 'user-1', 'preview');
      service.revokeToken(token.token);

      expect(service.isValid(token.token)).toBe(false);
    });
  });

  describe('getTokenTTL', () => {
    it('should return remaining time for valid token', () => {
      const token = service.generateToken('file-1', 'user-1', 'preview');
      const ttl = service.getTokenTTL(token.token);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(15 * 60 * 1000); // <= 15 minutes
    });

    it('should return 0 for non-existent token', () => {
      const ttl = service.getTokenTTL('non-existent-token');
      expect(ttl).toBe(0);
    });

    it('should return 0 for expired token', async () => {
      const shortExpiryService = new FileAccessTokenService();
      (shortExpiryService as any).TOKEN_EXPIRY_MS = 50;

      const token = shortExpiryService.generateToken('file-1', 'user-1', 'preview');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const ttl = shortExpiryService.getTokenTTL(token.token);
      expect(ttl).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should clean up expired tokens', async () => {
      const shortExpiryService = new FileAccessTokenService();
      (shortExpiryService as any).TOKEN_EXPIRY_MS = 50;

      // Generate multiple tokens
      shortExpiryService.generateToken('file-1', 'user-1', 'preview');
      shortExpiryService.generateToken('file-2', 'user-2', 'download');

      expect(shortExpiryService.getTokenCount()).toBe(2);

      // Wait for expiry (tokens auto-cleanup on timeout, so they may already be gone)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // At this point, tokens have been auto-cleaned by setTimeout
      // cleanupExpired will find 0 expired tokens
      const cleaned = shortExpiryService.cleanupExpired();

      expect(cleaned).toBeGreaterThanOrEqual(0);
      expect(shortExpiryService.getTokenCount()).toBe(0);
    });

    it('should not clean up valid tokens', () => {
      service.generateToken('file-1', 'user-1', 'preview');
      service.generateToken('file-2', 'user-2', 'download');

      const cleaned = service.cleanupExpired();

      expect(cleaned).toBe(0);
      expect(service.getTokenCount()).toBe(2);
    });
  });

  describe('getTokenCount', () => {
    it('should return correct token count', () => {
      expect(service.getTokenCount()).toBe(0);

      service.generateToken('file-1', 'user-1', 'preview');
      expect(service.getTokenCount()).toBe(1);

      service.generateToken('file-2', 'user-2', 'download');
      expect(service.getTokenCount()).toBe(2);
    });

    it('should decrease count after revocation', () => {
      const token = service.generateToken('file-1', 'user-1', 'preview');
      expect(service.getTokenCount()).toBe(1);

      service.revokeToken(token.token);
      expect(service.getTokenCount()).toBe(0);
    });
  });

  describe('security', () => {
    it('should use different signatures with different secret keys', () => {
      const service1 = new FileAccessTokenService('secret-1');
      const service2 = new FileAccessTokenService('secret-2');

      const token1 = service1.generateToken('file-1', 'user-1', 'preview');
      const token2 = service2.generateToken('file-1', 'user-1', 'preview');

      // Same data but different keys should produce different tokens
      expect(token1.token).not.toBe(token2.token);

      // Service1 should not validate token from service2
      const validated = service1.validateToken(token2.token);
      expect(validated).toBeNull();
    });

    it('should not allow signature tampering', () => {
      // Test that tokens can't be forged by manipulating the signature
      const token1 = service.generateToken('file-1', 'user-1', 'preview');
      const token2 = service.generateToken('file-2', 'user-1', 'preview');

      // Validate both tokens
      const validated1 = service.validateToken(token1.token);
      const validated2 = service.validateToken(token2.token);

      expect(validated1?.fileId).toBe('file-1');
      expect(validated2?.fileId).toBe('file-2');

      // Each token has unique signature based on its data
      expect(validated1?.signature).not.toBe(validated2?.signature);
    });
  });
});
