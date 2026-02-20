/**
 * FileAccessTokenService
 *
 * Generates and validates time-limited tokens for secure file access.
 * Prevents direct file path exposure and provides audit trail.
 */

import crypto from 'crypto';

export interface FileAccessToken {
  token: string;
  fileId: string;
  userId: string;
  expiresAt: number;
  action: 'preview' | 'download';
}

interface TokenPayload {
  fileId: string;
  userId: string;
  expiresAt: number;
  action: 'preview' | 'download';
  signature: string;
}

export class FileAccessTokenService {
  private readonly SECRET_KEY: string;
  private readonly TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
  private readonly tokens: Map<string, TokenPayload> = new Map();

  constructor(secretKey?: string) {
    // Use provided key or generate a secure random key
    this.SECRET_KEY = secretKey || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a secure access token for a file
   */
  generateToken(fileId: string, userId: string, action: 'preview' | 'download'): FileAccessToken {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.TOKEN_EXPIRY_MS;

    // Create payload with signature
    const payload: TokenPayload = {
      fileId,
      userId,
      expiresAt,
      action,
      signature: this.createSignature(token, fileId, userId, expiresAt, action),
    };

    // Store token in memory
    this.tokens.set(token, payload);

    // Schedule cleanup
    setTimeout(() => {
      this.tokens.delete(token);
    }, this.TOKEN_EXPIRY_MS);

    return {
      token,
      fileId,
      userId,
      expiresAt,
      action,
    };
  }

  /**
   * Validate a token and return its payload if valid
   */
  validateToken(token: string): TokenPayload | null {
    const payload = this.tokens.get(token);

    if (!payload) {
      return null; // Token not found
    }

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      this.tokens.delete(token);
      return null; // Token expired
    }

    // Verify signature
    const expectedSignature = this.createSignature(
      token,
      payload.fileId,
      payload.userId,
      payload.expiresAt,
      payload.action,
    );

    if (payload.signature !== expectedSignature) {
      this.tokens.delete(token);
      return null; // Invalid signature
    }

    return payload;
  }

  /**
   * Create HMAC signature for token integrity
   */
  private createSignature(
    token: string,
    fileId: string,
    userId: string,
    expiresAt: number,
    action: string,
  ): string {
    const data = `${token}:${fileId}:${userId}:${expiresAt}:${action}`;
    return crypto.createHmac('sha256', this.SECRET_KEY).update(data).digest('hex');
  }
}

// Singleton export
export const fileAccessTokenService = new FileAccessTokenService();
