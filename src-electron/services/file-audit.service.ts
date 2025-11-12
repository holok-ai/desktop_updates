/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * FileAuditService
 *
 * Logs file access events (preview, download) for audit trail and compliance.
 * Tracks user, timestamp, file info, and action type.
 */

import log from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';

export interface FileAuditEvent {
  id: string;
  userId: string;
  fileId: string;
  filename: string;
  action: 'preview' | 'download' | 'upload' | 'delete';
  timestamp: number;
  threadId?: string;
  fileSize?: number;
  mimeType?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export class FileAuditService {
  private readonly auditLogPath: string;
  private readonly inMemoryLog: FileAuditEvent[] = [];
  private readonly MAX_IN_MEMORY_EVENTS = 1000;

  constructor() {
    // Audit log path: <userData>/holokai/desktop/logs/file-audit.log
    let userDataPath: string;
    try {
      if (app && typeof app.getPath === 'function') {
        userDataPath = app.getPath('userData');
      } else {
        throw new Error('app.getPath not available');
      }
    } catch (err) {
      // Running in test or non-Electron environment — fall back to temp dir
      userDataPath = process.env.HOLOKAI_USER_DATA || os.tmpdir();
      log.warn('[FileAuditService] Falling back to temp userData path', {
        userDataPath,
        error: err,
      });
    }

    const logsDir = path.join(userDataPath, 'holokai', 'desktop', 'logs');
    this.auditLogPath = path.join(logsDir, 'file-audit.log');
    this.ensureLogDirectory(logsDir);
  }

  /**
   * Log a file preview event
   */
  logPreview(
    userId: string,
    fileId: string,
    filename: string,
    options?: {
      threadId?: string;
      fileSize?: number;
      mimeType?: string;
      success?: boolean;
      errorMessage?: string;
    },
  ): void {
    this.logEvent({
      userId,
      fileId,
      filename,
      action: 'preview',
      success: options?.success ?? true,
      threadId: options?.threadId,
      fileSize: options?.fileSize,
      mimeType: options?.mimeType,
      errorMessage: options?.errorMessage,
    });
  }

  /**
   * Log a file download event
   */
  logDownload(
    userId: string,
    fileId: string,
    filename: string,
    options?: {
      threadId?: string;
      fileSize?: number;
      mimeType?: string;
      success?: boolean;
      errorMessage?: string;
    },
  ): void {
    this.logEvent({
      userId,
      fileId,
      filename,
      action: 'download',
      success: options?.success ?? true,
      threadId: options?.threadId,
      fileSize: options?.fileSize,
      mimeType: options?.mimeType,
      errorMessage: options?.errorMessage,
    });
  }

  /**
   * Log a file upload event
   */
  logUpload(
    userId: string,
    fileId: string,
    filename: string,
    options?: {
      threadId?: string;
      fileSize?: number;
      mimeType?: string;
      success?: boolean;
      errorMessage?: string;
    },
  ): void {
    this.logEvent({
      userId,
      fileId,
      filename,
      action: 'upload',
      success: options?.success ?? true,
      threadId: options?.threadId,
      fileSize: options?.fileSize,
      mimeType: options?.mimeType,
      errorMessage: options?.errorMessage,
    });
  }

  /**
   * Log a file delete event
   */
  logDelete(
    userId: string,
    fileId: string,
    filename: string,
    options?: {
      threadId?: string;
      success?: boolean;
      errorMessage?: string;
    },
  ): void {
    this.logEvent({
      userId,
      fileId,
      filename,
      action: 'delete',
      success: options?.success ?? true,
      threadId: options?.threadId,
      errorMessage: options?.errorMessage,
    });
  }

  /**
   * Core event logging method
   */
  private logEvent(params: {
    userId: string;
    fileId: string;
    filename: string;
    action: 'preview' | 'download' | 'upload' | 'delete';
    success: boolean;
    threadId?: string;
    fileSize?: number;
    mimeType?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const event: FileAuditEvent = {
      id: this.generateEventId(),
      userId: params.userId,
      fileId: params.fileId,
      filename: params.filename,
      action: params.action,
      timestamp: Date.now(),
      threadId: params.threadId,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      success: params.success,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    };

    // Add to in-memory log
    this.inMemoryLog.push(event);

    // Trim in-memory log if too large
    if (this.inMemoryLog.length > this.MAX_IN_MEMORY_EVENTS) {
      this.inMemoryLog.shift();
    }

    // Write to file (async, non-blocking)
    this.writeToFile(event).catch((error) => {
      log.error('[FileAuditService] Failed to write audit log to file', {
        event,
        error,
      });
    });

    // Also log to electron-log for immediate visibility
    log.info('[FileAuditService] File access event', event);
  }

  /**
   * Write audit event to file
   */
  private async writeToFile(event: FileAuditEvent): Promise<void> {
    try {
      const logLine = JSON.stringify(event) + '\n';
      await fs.promises.appendFile(this.auditLogPath, logLine, 'utf-8');
    } catch (error) {
      // If file write fails, at least we have it in memory and electron-log
      log.error('[FileAuditService] Failed to write to audit log file', {
        event,
        error,
      });
    }
  }

  /**
   * Query audit log (in-memory only)
   */
  queryLog(filters?: {
    userId?: string;
    fileId?: string;
    action?: 'preview' | 'download' | 'upload' | 'delete';
    startTime?: number;
    endTime?: number;
  }): FileAuditEvent[] {
    let results = [...this.inMemoryLog];

    if (filters) {
      if (filters.userId) {
        results = results.filter((e) => e.userId === filters.userId);
      }
      if (filters.fileId) {
        results = results.filter((e) => e.fileId === filters.fileId);
      }
      if (filters.action) {
        results = results.filter((e) => e.action === filters.action);
      }
      if (filters.startTime) {
        results = results.filter((e) => e.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        results = results.filter((e) => e.timestamp <= filters.endTime!);
      }
    }

    return results;
  }

  /**
   * Get recent events (last N)
   */
  getRecentEvents(limit = 100): FileAuditEvent[] {
    return this.inMemoryLog.slice(-limit);
  }

  /**
   * Clear in-memory log (file log persists)
   */
  clearInMemoryLog(): void {
    this.inMemoryLog.length = 0;
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string {
    return this.auditLogPath;
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log.info('[FileAuditService] Log directory created', { path: dirPath });
      }
    } catch (error) {
      log.warn('[FileAuditService] Could not create log directory', {
        path: dirPath,
        error,
      });
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Singleton export
export const fileAuditService = new FileAuditService();
