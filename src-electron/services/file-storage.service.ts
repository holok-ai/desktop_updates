/* eslint-disable security/detect-object-injection */

/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * FileStorageService
 * Manages local file persistence for attachments in userData directory
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Attachment } from '../../src-shared/types/attachment.types.js';
import log from '../utils/logger.js';
import { fileAccessTokenService } from './file-access-token.service.js';

export class FileStorageService {
  private readonly baseStoragePath: string;

  constructor() {
    // Storage path: <userData>/holokai/desktop/attachments
    const userDataPath = app.getPath('userData');
    this.baseStoragePath = path.join(userDataPath, 'holokai', 'desktop', 'attachments');
    this.ensureBaseDirectory();
  }

  /**
   * Save file buffer to disk and return attachment metadata
   */
  async saveFile(
    threadId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    fileId?: string,
  ): Promise<Attachment> {
    try {
      // Use provided file ID or generate unique file ID
      const actualFileId = fileId || randomUUID();

      // Extract extension from original filename
      const extension = path.extname(originalName) || this.getExtensionFromMimeType(mimeType);

      // Build file path: <baseStoragePath>/<threadId>/<fileId>.<ext>
      const threadDir = path.join(this.baseStoragePath, threadId);
      this.ensureDirectory(threadDir);

      const fileName = `${actualFileId}${extension}`;
      const filePath = path.join(threadDir, fileName);

      // Write file to disk
      await fs.promises.writeFile(filePath, fileBuffer);

      log.info('[FileStorageService] File saved', {
        fileId: actualFileId,
        threadId,
        filename: originalName,
        size: fileBuffer.length,
        mimeType,
        path: filePath,
      });

      // Return attachment metadata
      const attachment: Attachment = {
        id: actualFileId,
        filename: originalName,
        mimeType,
        size: fileBuffer.length,
        uploadedAt: Date.now(),
        status: 'success',
        localPath: filePath,
        // URL will be generated when needed (file:// protocol)
      };

      return attachment;
    } catch (error) {
      log.error('[FileStorageService] Failed to save file', {
        threadId,
        filename: originalName,
        error,
      });
      throw new Error(
        `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Retrieve file buffer by ID
   */
  async getFile(threadId: string, fileId: string): Promise<Buffer | null> {
    try {
      const filePath = this.findFilePath(threadId, fileId);

      if (!filePath) {
        log.warn('[FileStorageService] File not found', { threadId, fileId });
        return null;
      }

      const buffer = await fs.promises.readFile(filePath);

      log.info('[FileStorageService] File retrieved', {
        threadId,
        fileId,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      log.error('[FileStorageService] Failed to retrieve file', {
        threadId,
        fileId,
        error,
      });
      return null;
    }
  }

  /**
   * Delete file from disk
   */
  async deleteFile(threadId: string, fileId: string): Promise<boolean> {
    try {
      const filePath = this.findFilePath(threadId, fileId);

      if (!filePath) {
        log.warn('[FileStorageService] File not found for deletion', { threadId, fileId });
        return false;
      }

      await fs.promises.unlink(filePath);

      log.info('[FileStorageService] File deleted', { threadId, fileId, path: filePath });

      return true;
    } catch (error) {
      log.error('[FileStorageService] Failed to delete file', {
        threadId,
        fileId,
        error,
      });
      return false;
    }
  }

  /**
   * Delete all files for a thread (cleanup on thread deletion)
   */
  async deleteThreadFiles(threadId: string): Promise<void> {
    try {
      const threadDir = path.join(this.baseStoragePath, threadId);

      // Check if directory exists
      if (!fs.existsSync(threadDir)) {
        log.info('[FileStorageService] Thread directory does not exist', { threadId });
        return;
      }

      // Read all files in directory
      const files = await fs.promises.readdir(threadDir);

      // Delete each file
      for (const file of files) {
        const filePath = path.join(threadDir, file);
        await fs.promises.unlink(filePath);
      }

      // Delete directory
      await fs.promises.rmdir(threadDir);

      log.info('[FileStorageService] Thread files deleted', {
        threadId,
        fileCount: files.length,
      });
    } catch (error) {
      log.error('[FileStorageService] Failed to delete thread files', {
        threadId,
        error,
      });
    }
  }

  /**
   * Get file path for a given thread and file ID
   */
  getFilePath(threadId: string, fileId: string, extension?: string): string {
    const fileName = extension ? `${fileId}${extension}` : fileId;
    return path.join(this.baseStoragePath, threadId, fileName);
  }

  /**
   * Check if file exists
   */
  fileExists(threadId: string, fileId: string): boolean {
    const filePath = this.findFilePath(threadId, fileId);
    return filePath !== null;
  }

  /**
   * Get file size
   */
  async getFileSize(threadId: string, fileId: string): Promise<number | null> {
    try {
      const filePath = this.findFilePath(threadId, fileId);

      if (!filePath) {
        return null;
      }

      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error) {
      log.error('[FileStorageService] Failed to get file size', {
        threadId,
        fileId,
        error,
      });
      return null;
    }
  }

  /**
   * Get file with token-based access (secure retrieval)
   * Returns file buffer and metadata if token is valid
   */
  async getFileWithToken(
    token: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
    try {
      // Validate token
      const payload = fileAccessTokenService.validateToken(token);

      if (!payload) {
        log.warn('[FileStorageService] Invalid or expired token', { token });
        return null;
      }

      // Extract fileId and userId from payload
      // fileId format: "threadId/fileId" or just "fileId" (we need to find it)
      const { fileId, userId } = payload;

      // Find the file (search across all thread directories)
      const fileInfo = await this.findFileById(fileId);

      if (!fileInfo) {
        log.warn('[FileStorageService] File not found for token', { fileId, userId });
        return null;
      }

      // Read file buffer
      const buffer = await fs.promises.readFile(fileInfo.filePath);

      log.info('[FileStorageService] File retrieved with token', {
        fileId,
        userId,
        action: payload.action,
        size: buffer.length,
      });

      // Optionally revoke token after use (one-time access)
      // fileAccessTokenService.revokeToken(token);

      return {
        buffer,
        filename: fileInfo.filename,
        mimeType: fileInfo.mimeType,
      };
    } catch (error) {
      log.error('[FileStorageService] Failed to retrieve file with token', {
        token,
        error,
      });
      return null;
    }
  }

  /**
   * Find file by ID across all thread directories
   * Returns file path and metadata if found
   */
  private async findFileById(
    fileId: string,
  ): Promise<{ filePath: string; filename: string; mimeType: string } | null> {
    try {
      // Check if base storage path exists
      if (!fs.existsSync(this.baseStoragePath)) {
        return null;
      }

      // Read all thread directories
      const threadDirs = await fs.promises.readdir(this.baseStoragePath);

      for (const threadDir of threadDirs) {
        const threadPath = path.join(this.baseStoragePath, threadDir);

        // Skip if not a directory
        const stats = await fs.promises.stat(threadPath);
        if (!stats.isDirectory()) {
          continue;
        }

        // Find file in this thread directory
        const files = await fs.promises.readdir(threadPath);
        const matchingFile = files.find((file) => file.startsWith(fileId));

        if (matchingFile) {
          const filePath = path.join(threadPath, matchingFile);
          const extension = path.extname(matchingFile);

          // Derive MIME type from extension
          const mimeType = this.getMimeTypeFromExtension(extension);

          return {
            filePath,
            filename: matchingFile,
            mimeType,
          };
        }
      }

      return null;
    } catch (error) {
      log.error('[FileStorageService] Error finding file by ID', {
        fileId,
        error,
      });
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const extToMime: Record<string, string> = {
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',

      // Documents
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',

      // Data
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // Archives
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
    };

    return extToMime[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Ensure base storage directory exists
   */
  private ensureBaseDirectory(): void {
    this.ensureDirectory(this.baseStoragePath);
  }

  /**
   * Ensure directory exists, create if not
   */
  private ensureDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log.info('[FileStorageService] Directory created', { path: dirPath });
      }
    } catch (error) {
      // If directory creation fails (e.g., test environment with mocked paths),
      // log and continue — service methods will handle missing files gracefully.
      log.warn('[FileStorageService] Could not create directory, continuing', {
        path: dirPath,
        error,
      });
    }
  }

  /**
   * Find file path by searching for file with given ID
   * (handles case where we don't know the extension)
   */
  private findFilePath(threadId: string, fileId: string): string | null {
    try {
      const threadDir = path.join(this.baseStoragePath, threadId);

      // Check if thread directory exists
      if (!fs.existsSync(threadDir)) {
        return null;
      }

      // Read directory and find file matching fileId
      const files = fs.readdirSync(threadDir);
      const matchingFile = files.find((file) => file.startsWith(fileId));

      if (!matchingFile) {
        return null;
      }

      return path.join(threadDir, matchingFile);
    } catch (error) {
      log.error('[FileStorageService] Error finding file path', {
        threadId,
        fileId,
        error,
      });
      return null;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      // Images
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',

      // Documents
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/markdown': '.md',

      // Data
      'application/json': '.json',
      'text/csv': '.csv',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',

      // Archives
      'application/zip': '.zip',
      'application/x-tar': '.tar',
    };

    return mimeToExt[mimeType] || '';
  }
}

// Export singleton instance
export const fileStorageService = new FileStorageService();
