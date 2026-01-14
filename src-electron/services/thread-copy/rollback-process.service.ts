/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Rollback Process Service
 * Handles cleanup of partial state when copy operations fail
 *
 * Feature: thread-copy-functionality
 * Validates: Requirements 7.1, 7.2, 7.3
 * Property 4: File Migration Failure Triggers Rollback
 */

import type { CopyOperation } from '../../../src-shared/types/thread-copy.types.js';
import type { IRollbackProcess } from './types.js';
import { fileStorageService } from '../file-storage.service.js';
import log from '../../utils/logger.js';
import * as fs from 'fs';

export class RollbackProcess implements IRollbackProcess {
  /**
   * Execute rollback for a failed copy operation
   *
   * Cleans up all partial state:
   * 1. Delete partial cloud uploads
   * 2. Delete partial local downloads
   * 3. Delete created thread if it exists
   *
   * @param operation - The failed operation state
   * @returns Promise resolving when rollback is complete
   */
  async execute(operation: CopyOperation): Promise<void> {
    const { rollbackData } = operation;

    if (!rollbackData) {
      log.info('[RollbackProcess] No rollback data, skipping', {
        operationId: operation.id,
      });
      return;
    }

    log.info('[RollbackProcess] Starting rollback', {
      operationId: operation.id,
      uploadedFiles: rollbackData.uploadedFiles?.length ?? 0,
      downloadedFiles: rollbackData.downloadedFiles?.length ?? 0,
      createdThreadId: rollbackData.createdThreadId,
    });

    try {
      // 1. Delete partial cloud uploads
      if (rollbackData.uploadedFiles && rollbackData.uploadedFiles.length > 0) {
        await this.deleteCloudFiles(rollbackData.uploadedFiles);
      }

      // 2. Delete partial local downloads
      if (rollbackData.downloadedFiles && rollbackData.downloadedFiles.length > 0) {
        await this.deleteLocalFiles(rollbackData.downloadedFiles);
      }

      // 3. Delete created thread if it exists
      if (rollbackData.createdThreadId) {
        await this.deleteThread(rollbackData.createdThreadId);
      }

      log.info('[RollbackProcess] Rollback completed successfully', {
        operationId: operation.id,
      });
    } catch (error) {
      log.error('[RollbackProcess] Rollback failed', {
        operationId: operation.id,
        error,
      });
      // Don't throw - we want to log the failure but not crash
      // Partial rollback is better than no rollback
    }
  }

  /**
   * Delete uploaded cloud files
   *
   * @param fileIds - Array of cloud file IDs to delete
   * @returns Promise resolving when deletion is complete
   */
  async deleteCloudFiles(fileIds: string[]): Promise<void> {
    log.info('[RollbackProcess] Deleting cloud files', {
      fileCount: fileIds.length,
    });

    const errors: Array<{ fileId: string; error: unknown }> = [];

    for (const fileId of fileIds) {
      try {
        // TODO: Replace with actual cloud storage API call (E5-S1 dependency)
        await this.deleteCloudFile(fileId);

        log.info('[RollbackProcess] Cloud file deleted', { fileId });
      } catch (error) {
        log.error('[RollbackProcess] Failed to delete cloud file', {
          fileId,
          error,
        });
        errors.push({ fileId, error });
        // Continue with other files even if one fails
      }
    }

    if (errors.length > 0) {
      log.warn('[RollbackProcess] Some cloud files could not be deleted', {
        errorCount: errors.length,
        totalFiles: fileIds.length,
      });
    }
  }

  /**
   * Delete downloaded local files
   *
   * @param filePaths - Array of local file paths to delete
   * @returns Promise resolving when deletion is complete
   */
  async deleteLocalFiles(filePaths: string[]): Promise<void> {
    log.info('[RollbackProcess] Deleting local files', {
      fileCount: filePaths.length,
    });

    const errors: Array<{ filePath: string; error: unknown }> = [];

    for (const filePath of filePaths) {
      try {
        // Check if file exists before attempting deletion
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          log.info('[RollbackProcess] Local file deleted', { filePath });
        } else {
          log.warn('[RollbackProcess] Local file does not exist, skipping', {
            filePath,
          });
        }
      } catch (error) {
        log.error('[RollbackProcess] Failed to delete local file', {
          filePath,
          error,
        });
        errors.push({ filePath, error });
        // Continue with other files even if one fails
      }
    }

    if (errors.length > 0) {
      log.warn('[RollbackProcess] Some local files could not be deleted', {
        errorCount: errors.length,
        totalFiles: filePaths.length,
      });
    }
  }

  /**
   * Delete a created thread
   *
   * @param threadId - Thread ID to delete
   * @returns Promise resolving when deletion is complete
   */
  async deleteThread(threadId: string): Promise<void> {
    log.info('[RollbackProcess] Deleting thread', { threadId });

    try {
      // Delete all thread files first
      await fileStorageService.deleteThreadFiles(threadId);

      // TODO: Delete thread from database
      // This will be implemented when we integrate with ThreadService
      // For now, just delete the files

      log.info('[RollbackProcess] Thread deleted', { threadId });
    } catch (error) {
      log.error('[RollbackProcess] Failed to delete thread', {
        threadId,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete a single cloud file
   * TODO: Replace with actual cloud storage API call (E5-S1 dependency)
   *
   * @param fileId - Cloud file ID to delete
   * @returns Promise resolving when deletion is complete
   */
  private async deleteCloudFile(fileId: string): Promise<void> {
    // Placeholder implementation
    // In production, this would call the cloud storage API
    // For now, simulate deletion with a delay

    await new Promise((resolve) => setTimeout(resolve, 50));

    log.info('[RollbackProcess] Cloud file deletion simulated', { fileId });
  }
}

// Export singleton instance
export const rollbackProcess = new RollbackProcess();
