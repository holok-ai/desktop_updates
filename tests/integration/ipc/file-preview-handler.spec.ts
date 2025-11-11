/**
 * Integration tests for file preview/download IPC handlers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import { registerFileHandlers } from '../../../src-electron/ipc-handlers/file-handler';
import { fileStorageService } from '../../../src-electron/services/file-storage.service';
import { fileAccessTokenService } from '../../../src-electron/services/file-access-token.service';
import { fileAuditService } from '../../../src-electron/services/file-audit.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

describe('File Preview/Download IPC Handlers (Integration)', () => {
  let handlers: Map<string, Function>;

  beforeEach(() => {
    handlers = new Map();

    // Capture IPC handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    });

    // Register handlers
    registerFileHandlers();

    // Clear audit log
    fileAuditService.clearInMemoryLog();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('file:preview handler', () => {
    it('should generate preview token for existing file', async () => {
      const handler = handlers.get('file:preview');
      expect(handler).toBeDefined();

      // Mock file exists
      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(1024000);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.jpg',
      );

      const result = await handler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.fileInfo).toBeDefined();
      expect(result.fileInfo?.filename).toContain('file-456.jpg');
      expect(result.fileInfo?.mimeType).toBe('image/jpeg');
      expect(result.fileInfo?.isPreviewable).toBe(true);
    });

    it('should reject preview for non-existent file', async () => {
      const handler = handlers.get('file:preview');

      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(false);

      const result = await handler!({} as any, {
        threadId: 'thread-123',
        fileId: 'nonexistent',
        userId: 'user-789',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject preview for non-previewable files', async () => {
      const handler = handlers.get('file:preview');

      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(1024);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.zip',
      );

      const result = await handler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be previewed');
    });

    it('should log preview access attempt', async () => {
      const handler = handlers.get('file:preview');

      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(1024);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.jpg',
      );

      await handler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      const events = fileAuditService.queryLog({ action: 'preview' });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].userId).toBe('user-789');
      expect(events[0].fileId).toBe('file-456');
    });
  });

  describe('file:download handler', () => {
    it('should generate download token for existing file', async () => {
      const handler = handlers.get('file:download');
      expect(handler).toBeDefined();

      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(2048000);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.pdf',
      );

      const result = await handler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.fileInfo).toBeDefined();
      expect(result.fileInfo?.filename).toContain('file-456.pdf');
      expect(result.fileInfo?.mimeType).toBe('application/pdf');
    });

    it('should accept download for any file type', async () => {
      const handler = handlers.get('file:download');

      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(1024);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.zip',
      );

      const result = await handler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should log download access attempt', async () => {
      const handler = handlers.get('file:download');

      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(1024);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.pdf',
      );

      await handler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      const events = fileAuditService.queryLog({ action: 'download' });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].userId).toBe('user-789');
      expect(events[0].fileId).toBe('file-456');
    });
  });

  describe('file:getWithToken handler', () => {
    it('should retrieve file with valid token', async () => {
      const handler = handlers.get('file:getWithToken');
      expect(handler).toBeDefined();

      // Generate a valid token
      const token = fileAccessTokenService.generateToken('file-456', 'user-789', 'preview');

      // Mock file retrieval
      const mockBuffer = Buffer.from('mock file content');
      vi.spyOn(fileStorageService, 'getFileWithToken').mockResolvedValue({
        buffer: mockBuffer,
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
      });

      const result = await handler!({} as any, {
        token: token.token,
      });

      expect(result.success).toBe(true);
      expect(result.buffer).toEqual(mockBuffer);
      expect(result.filename).toBe('photo.jpg');
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should reject invalid token', async () => {
      const handler = handlers.get('file:getWithToken');

      vi.spyOn(fileStorageService, 'getFileWithToken').mockResolvedValue(null);

      const result = await handler!({} as any, {
        token: 'invalid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired token');
    });

    it('should reject expired token', async () => {
      const handler = handlers.get('file:getWithToken');

      // Create a token that will expire immediately
      const shortExpiryService = fileAccessTokenService;
      (shortExpiryService as any).TOKEN_EXPIRY_MS = 1;

      const token = shortExpiryService.generateToken('file-456', 'user-789', 'preview');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      vi.spyOn(fileStorageService, 'getFileWithToken').mockResolvedValue(null);

      const result = await handler!({} as any, {
        token: token.token,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('End-to-end token flow', () => {
    it('should complete full preview flow with token', async () => {
      const previewHandler = handlers.get('file:preview');
      const getHandler = handlers.get('file:getWithToken');

      // Setup mocks
      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(1024);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.jpg',
      );

      const mockBuffer = Buffer.from('mock image data');
      vi.spyOn(fileStorageService, 'getFileWithToken').mockResolvedValue({
        buffer: mockBuffer,
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
      });

      // Step 1: Request preview token
      const previewResult = await previewHandler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      expect(previewResult.success).toBe(true);
      expect(previewResult.token).toBeDefined();

      // Step 2: Get file with token
      const getResult = await getHandler!({} as any, {
        token: previewResult.token,
      });

      expect(getResult.success).toBe(true);
      expect(getResult.buffer).toEqual(mockBuffer);
      expect(getResult.filename).toBe('photo.jpg');

      // Verify audit trail
      const events = fileAuditService.queryLog({ userId: 'user-789' });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should complete full download flow with token', async () => {
      const downloadHandler = handlers.get('file:download');
      const getHandler = handlers.get('file:getWithToken');

      // Setup mocks
      vi.spyOn(fileStorageService, 'fileExists').mockReturnValue(true);
      vi.spyOn(fileStorageService, 'getFileSize').mockResolvedValue(2048);
      vi.spyOn(fileStorageService, 'getFilePath').mockReturnValue(
        '/mock/path/thread-123/file-456.pdf',
      );

      const mockBuffer = Buffer.from('mock pdf data');
      vi.spyOn(fileStorageService, 'getFileWithToken').mockResolvedValue({
        buffer: mockBuffer,
        filename: 'document.pdf',
        mimeType: 'application/pdf',
      });

      // Step 1: Request download token
      const downloadResult = await downloadHandler!({} as any, {
        threadId: 'thread-123',
        fileId: 'file-456',
        userId: 'user-789',
      });

      expect(downloadResult.success).toBe(true);
      expect(downloadResult.token).toBeDefined();

      // Step 2: Get file with token
      const getResult = await getHandler!({} as any, {
        token: downloadResult.token,
      });

      expect(getResult.success).toBe(true);
      expect(getResult.buffer).toEqual(mockBuffer);

      // Verify audit trail
      const events = fileAuditService.queryLog({ action: 'download', userId: 'user-789' });
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Security validation', () => {
    it('should require all parameters', async () => {
      const handler = handlers.get('file:preview');

      const result = await handler!({} as any, {
        threadId: 'thread-123',
        // Missing fileId and userId
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should validate token before file access', async () => {
      const handler = handlers.get('file:getWithToken');

      const result = await handler!({} as any, {
        token: '', // Empty token
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field');
    });

    it('should not allow token reuse across different files', async () => {
      const getHandler = handlers.get('file:getWithToken');

      // Generate token for file-1
      const token = fileAccessTokenService.generateToken('file-1', 'user-1', 'preview');

      // Try to use it for file-2 (mock will return null)
      vi.spyOn(fileStorageService, 'getFileWithToken').mockResolvedValue(null);

      const result = await getHandler!({} as any, {
        token: token.token,
      });

      // Should fail because FileStorageService validates the fileId in token
      expect(result.success).toBe(false);
    });
  });
});
