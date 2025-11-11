/**
 * Unit tests for FileAuditService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FileAuditService } from '../../../src-electron/services/file-audit.service';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

vi.mock('../../../src-electron/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('FileAuditService', () => {
  let service: FileAuditService;

  beforeEach(() => {
    service = new FileAuditService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.clearInMemoryLog();
  });

  describe('logPreview', () => {
    it('should log a successful preview event', () => {
      service.logPreview('user-123', 'file-456', 'photo.jpg', {
        threadId: 'thread-789',
        fileSize: 1024000,
        mimeType: 'image/jpeg',
        success: true,
      });

      const events = service.queryLog({ userId: 'user-123' });

      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe('user-123');
      expect(events[0].fileId).toBe('file-456');
      expect(events[0].filename).toBe('photo.jpg');
      expect(events[0].action).toBe('preview');
      expect(events[0].success).toBe(true);
      expect(events[0].threadId).toBe('thread-789');
      expect(events[0].fileSize).toBe(1024000);
      expect(events[0].mimeType).toBe('image/jpeg');
    });

    it('should log a failed preview event', () => {
      service.logPreview('user-123', 'file-456', 'photo.jpg', {
        success: false,
        errorMessage: 'File not found',
      });

      const events = service.queryLog();

      expect(events[0].success).toBe(false);
      expect(events[0].errorMessage).toBe('File not found');
    });
  });

  describe('logDownload', () => {
    it('should log a successful download event', () => {
      service.logDownload('user-123', 'file-456', 'document.pdf', {
        threadId: 'thread-789',
        fileSize: 2048000,
        mimeType: 'application/pdf',
        success: true,
      });

      const events = service.queryLog({ action: 'download' });

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('download');
      expect(events[0].success).toBe(true);
    });

    it('should log a failed download event', () => {
      service.logDownload('user-123', 'file-456', 'document.pdf', {
        success: false,
        errorMessage: 'Download failed',
      });

      const events = service.queryLog();

      expect(events[0].success).toBe(false);
      expect(events[0].errorMessage).toBe('Download failed');
    });
  });

  describe('logUpload', () => {
    it('should log a successful upload event', () => {
      service.logUpload('user-123', 'file-456', 'image.png', {
        threadId: 'thread-789',
        fileSize: 512000,
        mimeType: 'image/png',
        success: true,
      });

      const events = service.queryLog({ action: 'upload' });

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('upload');
      expect(events[0].filename).toBe('image.png');
    });
  });

  describe('logDelete', () => {
    it('should log a successful delete event', () => {
      service.logDelete('user-123', 'file-456', 'temp.txt', {
        threadId: 'thread-789',
        success: true,
      });

      const events = service.queryLog({ action: 'delete' });

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('delete');
      expect(events[0].success).toBe(true);
    });
  });

  describe('queryLog', () => {
    beforeEach(() => {
      // Create test events
      service.logPreview('user-1', 'file-1', 'photo.jpg', { success: true });
      service.logDownload('user-1', 'file-2', 'doc.pdf', { success: true });
      service.logPreview('user-2', 'file-3', 'image.png', { success: false });
      service.logUpload('user-1', 'file-4', 'video.mp4', { success: true });
    });

    it('should return all events when no filters provided', () => {
      const events = service.queryLog();
      expect(events).toHaveLength(4);
    });

    it('should filter by userId', () => {
      const events = service.queryLog({ userId: 'user-1' });
      expect(events).toHaveLength(3);
      expect(events.every((e) => e.userId === 'user-1')).toBe(true);
    });

    it('should filter by fileId', () => {
      const events = service.queryLog({ fileId: 'file-2' });
      expect(events).toHaveLength(1);
      expect(events[0].fileId).toBe('file-2');
    });

    it('should filter by action', () => {
      const previewEvents = service.queryLog({ action: 'preview' });
      expect(previewEvents).toHaveLength(2);
      expect(previewEvents.every((e) => e.action === 'preview')).toBe(true);
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const startTime = now - 1000;
      const endTime = now + 1000;

      const events = service.queryLog({ startTime, endTime });
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((e) => e.timestamp >= startTime && e.timestamp <= endTime)).toBe(true);
    });

    it('should combine multiple filters', () => {
      const events = service.queryLog({
        userId: 'user-1',
        action: 'preview',
      });

      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe('user-1');
      expect(events[0].action).toBe('preview');
    });
  });

  describe('getRecentEvents', () => {
    it('should return the most recent N events', () => {
      // Create multiple events
      for (let i = 0; i < 10; i++) {
        service.logPreview(`user-${i}`, `file-${i}`, `file${i}.jpg`, { success: true });
      }

      const recent = service.getRecentEvents(5);

      expect(recent).toHaveLength(5);
      // Should be most recent (last 5 added)
      expect(recent[4].userId).toBe('user-9');
    });

    it('should return all events if limit exceeds count', () => {
      service.logPreview('user-1', 'file-1', 'file1.jpg', { success: true });
      service.logPreview('user-2', 'file-2', 'file2.jpg', { success: true });

      const recent = service.getRecentEvents(100);

      expect(recent).toHaveLength(2);
    });
  });

  describe('clearInMemoryLog', () => {
    it('should clear all in-memory events', () => {
      service.logPreview('user-1', 'file-1', 'file.jpg', { success: true });
      service.logDownload('user-2', 'file-2', 'doc.pdf', { success: true });

      expect(service.queryLog()).toHaveLength(2);

      service.clearInMemoryLog();

      expect(service.queryLog()).toHaveLength(0);
    });
  });

  describe('getLogFilePath', () => {
    it('should return the log file path', () => {
      const path = service.getLogFilePath();

      expect(path).toBeDefined();
      expect(path).toContain('file-audit.log');
    });
  });

  describe('event structure', () => {
    it('should generate unique IDs for each event', () => {
      service.logPreview('user-1', 'file-1', 'file.jpg', { success: true });
      service.logPreview('user-1', 'file-1', 'file.jpg', { success: true });

      const events = service.queryLog();

      expect(events[0].id).not.toBe(events[1].id);
    });

    it('should include timestamp for each event', () => {
      const before = Date.now();
      service.logPreview('user-1', 'file-1', 'file.jpg', { success: true });
      const after = Date.now();

      const events = service.queryLog();

      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should support metadata field', () => {
      // Add an event first
      service.logPreview('user-1', 'file-1', 'file.jpg', {
        success: true,
      });

      const events = service.queryLog();

      // Event structure supports metadata (may be undefined if not passed)
      expect(events[0]).toHaveProperty('metadata');
    });
  });

  describe('in-memory log limits', () => {
    it('should maintain a maximum number of events', () => {
      const MAX_EVENTS = 1000;

      // Add more than max events
      for (let i = 0; i < MAX_EVENTS + 100; i++) {
        service.logPreview(`user-${i}`, `file-${i}`, `file${i}.jpg`, { success: true });
      }

      const events = service.queryLog();

      // Should not exceed max
      expect(events.length).toBeLessThanOrEqual(MAX_EVENTS);
    });
  });

  describe('audit trail compliance', () => {
    it('should log all required fields for audit trail', () => {
      service.logDownload('user-123', 'file-456', 'sensitive-doc.pdf', {
        threadId: 'thread-789',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        success: true,
      });

      const events = service.queryLog();
      const event = events[0];

      // Required audit fields
      expect(event.id).toBeDefined();
      expect(event.userId).toBe('user-123');
      expect(event.fileId).toBe('file-456');
      expect(event.filename).toBe('sensitive-doc.pdf');
      expect(event.action).toBe('download');
      expect(event.timestamp).toBeDefined();
      expect(event.success).toBe(true);
      expect(event.threadId).toBe('thread-789');
      expect(event.fileSize).toBe(1024000);
      expect(event.mimeType).toBe('application/pdf');
    });

    it('should preserve event order (chronological)', () => {
      service.logPreview('user-1', 'file-1', 'first.jpg', { success: true });
      service.logDownload('user-1', 'file-2', 'second.pdf', { success: true });
      service.logUpload('user-1', 'file-3', 'third.png', { success: true });

      const events = service.queryLog();

      expect(events[0].filename).toBe('first.jpg');
      expect(events[1].filename).toBe('second.pdf');
      expect(events[2].filename).toBe('third.png');
      expect(events[0].timestamp).toBeLessThanOrEqual(events[1].timestamp);
      expect(events[1].timestamp).toBeLessThanOrEqual(events[2].timestamp);
    });
  });
});
