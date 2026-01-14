/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable security/detect-object-injection */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * File Migration Service
 * Handles bidirectional file transfers between local and cloud storage
 *
 * Feature: thread-copy-functionality
 * Validates: Requirements 3.1, 3.2, 3.4, 4.1, 4.2, 4.4
 */

import type {
  LocalFileReference,
  CloudFileReference,
  MigrationProgress,
} from '../../../src-shared/types/thread-copy.types.js';
import type { IFileMigrationService } from './types.js';
import { fileStorageService } from '../file-storage.service.js';
import log from '../../utils/logger.js';
import * as fs from 'fs';

export class FileMigrationService implements IFileMigrationService {
  private activeMigrations = new Map<string, AbortController>();

  /**
   * Migrate files from personal space to project workspace
   *
   * @param files - Array of local file references
   * @param targetProjectId - Destination project ID
   * @param onProgress - Progress callback
   * @returns Array of cloud file references
   * @throws Error if migration fails
   */
  async migrateToCloud(
    files: LocalFileReference[],
    targetProjectId: string,
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<CloudFileReference[]> {
    const operationId = `cloud-${Date.now()}`;
    const abortController = new AbortController();
    this.activeMigrations.set(operationId, abortController);

    try {
      log.info('[FileMigrationService] Starting migration to cloud', {
        operationId,
        fileCount: files.length,
        targetProjectId,
      });

      const cloudFiles: CloudFileReference[] = [];
      let totalBytesTransferred = 0;
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const startTime = Date.now();

      for (let i = 0; i < files.length; i++) {
        // Check if migration was cancelled
        if (abortController.signal.aborted) {
          throw new Error('Migration cancelled');
        }

        const file = files[i];

        // Report progress before starting file
        if (onProgress) {
          const elapsed = Date.now() - startTime;
          const speed = elapsed > 0 ? (totalBytesTransferred / elapsed) * 1000 : 0;

          onProgress({
            currentFile: file.filename,
            fileIndex: i,
            totalFiles: files.length,
            bytesTransferred: totalBytesTransferred,
            totalBytes,
            speed,
          });
        }

        // Read file from local filesystem
        const fileBuffer = await fs.promises.readFile(file.path);

        // Upload to cloud storage
        // TODO: Replace with actual cloud storage API call (E5-S1 dependency)
        const cloudFile = await this.uploadToCloud(
          fileBuffer,
          file.filename,
          file.mimeType,
          targetProjectId,
        );

        cloudFiles.push(cloudFile);
        totalBytesTransferred += file.size;

        log.info('[FileMigrationService] File uploaded to cloud', {
          operationId,
          filename: file.filename,
          fileId: cloudFile.fileId,
          size: file.size,
        });
      }

      // Report final progress
      if (onProgress) {
        const elapsed = Date.now() - startTime;
        const speed = elapsed > 0 ? (totalBytesTransferred / elapsed) * 1000 : 0;

        onProgress({
          currentFile: files[files.length - 1]?.filename || '',
          fileIndex: files.length - 1,
          totalFiles: files.length,
          bytesTransferred: totalBytesTransferred,
          totalBytes,
          speed,
        });
      }

      log.info('[FileMigrationService] Migration to cloud completed', {
        operationId,
        fileCount: cloudFiles.length,
        totalBytes: totalBytesTransferred,
      });

      return cloudFiles;
    } catch (error) {
      log.error('[FileMigrationService] Migration to cloud failed', {
        operationId,
        error,
      });
      throw error;
    } finally {
      this.activeMigrations.delete(operationId);
    }
  }

  /**
   * Migrate files from project workspace to personal space
   *
   * @param files - Array of cloud file references
   * @param targetThreadId - Destination thread ID (for local path)
   * @param onProgress - Progress callback
   * @returns Array of local file references
   * @throws Error if migration fails
   */
  async migrateToLocal(
    files: CloudFileReference[],
    targetThreadId: string,
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<LocalFileReference[]> {
    const operationId = `local-${Date.now()}`;
    const abortController = new AbortController();
    this.activeMigrations.set(operationId, abortController);

    try {
      log.info('[FileMigrationService] Starting migration to local', {
        operationId,
        fileCount: files.length,
        targetThreadId,
      });

      const localFiles: LocalFileReference[] = [];
      let totalBytesTransferred = 0;
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const startTime = Date.now();

      for (let i = 0; i < files.length; i++) {
        // Check if migration was cancelled
        if (abortController.signal.aborted) {
          throw new Error('Migration cancelled');
        }

        const file = files[i];

        // Report progress before starting file
        if (onProgress) {
          const elapsed = Date.now() - startTime;
          const speed = elapsed > 0 ? (totalBytesTransferred / elapsed) * 1000 : 0;

          onProgress({
            currentFile: file.filename,
            fileIndex: i,
            totalFiles: files.length,
            bytesTransferred: totalBytesTransferred,
            totalBytes,
            speed,
          });
        }

        // Download from cloud storage
        // TODO: Replace with actual cloud storage API call (E5-S1 dependency)
        const fileBuffer = await this.downloadFromCloud(file.fileId, file.url);

        // Save to local filesystem using FileStorageService
        const attachment = await fileStorageService.saveFile(
          targetThreadId,
          fileBuffer,
          file.filename,
          file.mimeType,
        );

        const localFile: LocalFileReference = {
          path: attachment.localPath!,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
        };

        localFiles.push(localFile);
        totalBytesTransferred += file.size;

        log.info('[FileMigrationService] File downloaded to local', {
          operationId,
          filename: file.filename,
          fileId: file.fileId,
          size: file.size,
          localPath: localFile.path,
        });
      }

      // Report final progress
      if (onProgress) {
        const elapsed = Date.now() - startTime;
        const speed = elapsed > 0 ? (totalBytesTransferred / elapsed) * 1000 : 0;

        onProgress({
          currentFile: files[files.length - 1]?.filename || '',
          fileIndex: files.length - 1,
          totalFiles: files.length,
          bytesTransferred: totalBytesTransferred,
          totalBytes,
          speed,
        });
      }

      log.info('[FileMigrationService] Migration to local completed', {
        operationId,
        fileCount: localFiles.length,
        totalBytes: totalBytesTransferred,
      });

      return localFiles;
    } catch (error) {
      log.error('[FileMigrationService] Migration to local failed', {
        operationId,
        error,
      });
      throw error;
    } finally {
      this.activeMigrations.delete(operationId);
    }
  }

  /**
   * Cancel an ongoing migration
   *
   * @param operationId - Migration operation ID
   */
  async cancelMigration(operationId: string): Promise<void> {
    const abortController = this.activeMigrations.get(operationId);

    if (abortController) {
      abortController.abort();
      this.activeMigrations.delete(operationId);

      log.info('[FileMigrationService] Migration cancelled', { operationId });
    } else {
      log.warn('[FileMigrationService] Migration not found for cancellation', { operationId });
    }
  }

  /**
   * Upload file to cloud storage
   * TODO: Replace with actual cloud storage API call (E5-S1 dependency)
   *
   * @param fileBuffer - File data
   * @param filename - Original filename
   * @param mimeType - MIME type
   * @param projectId - Target project ID
   * @returns Cloud file reference
   */
  private async uploadToCloud(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    projectId: string,
  ): Promise<CloudFileReference> {
    // Placeholder implementation
    // In production, this would call the cloud storage API
    // For now, simulate upload with a delay

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate mock cloud file reference
    const fileId = `cloud-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const url = `https://storage.example.com/projects/${projectId}/files/${fileId}`;

    return {
      fileId,
      filename,
      mimeType,
      size: fileBuffer.length,
      url,
    };
  }

  /**
   * Download file from cloud storage
   * TODO: Replace with actual cloud storage API call (E5-S1 dependency)
   *
   * @param fileId - Cloud file ID
   * @param url - Cloud file URL
   * @returns File buffer
   */
  private async downloadFromCloud(fileId: string, url: string): Promise<Buffer> {
    // Placeholder implementation
    // In production, this would call the cloud storage API
    // For now, simulate download with a delay and return mock data

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate mock file data
    const mockData = `Mock file data for ${fileId} from ${url}`;
    return Buffer.from(mockData, 'utf-8');
  }
}

// Export singleton instance
export const fileMigrationService = new FileMigrationService();
