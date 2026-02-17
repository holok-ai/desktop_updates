/**
 * Thread Copy Service
 * Orchestrates thread copy operations with transactional guarantees
 *
 * Feature: thread-copy-functionality
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 11.2, 12.1
 */

import { randomUUID } from 'crypto';
import type { Thread } from '../../repository/thread-repository.js';
import type {
  CopyOptions,
  CopyProgress,
  CopyOperation,
  CopyOperationStatus,
  CopyOperationError,
  CopyPhase,
  DuplicateInfo,
  LargeFileConfirmation,
  LocalFileReference,
  CloudFileReference,
} from '../../../src-shared/types/thread-copy.types.js';
import type { IThreadCopyService } from './types.js';
import { fileMigrationService } from './file-migration.service.js';
import { rollbackProcess } from './rollback-process.service.js';
import { threadRepository } from '../../repository/thread-repository.js';
import { projectCache } from '../../cache/ProjectCache.js';
import log from '../../utils/logger.js';

export class ThreadCopyService implements IThreadCopyService {
  private operations = new Map<string, CopyOperation>();
  private operationStartTimes = new Map<string, number>();
  private operationQueue: Array<{
    operationId: string;
    sourceThreadId: string;
    targetContext: string | null;
    options?: CopyOptions;
    resolve: (thread: Thread) => void;
    reject: (error: Error) => void;
  }> = [];
  private activeOperationId: string | null = null;
  private isProcessingQueue = false;

  /**
   * Copy a thread from one context to another
   *
   * @param sourceThreadId - ID of the thread to copy
   * @param targetContext - Destination context (projectId or null for personal)
   * @param options - Copy operation options
   * @returns Promise resolving to the new thread
   * @throws CopyOperationError if operation fails
   */
  async copyThread(
    sourceThreadId: string,
    targetContext: string | null,
    options?: CopyOptions,
  ): Promise<Thread> {
    const operationId = randomUUID();

    // Queue the operation
    return new Promise<Thread>((resolve, reject) => {
      this.operationQueue.push({
        operationId,
        sourceThreadId,
        targetContext,
        options,
        resolve,
        reject,
      });

      log.info('[ThreadCopyService] Operation queued', {
        operationId,
        sourceThreadId,
        targetContext,
        queueLength: this.operationQueue.length,
      });

      // Start processing queue if not already processing
      if (!this.isProcessingQueue) {
        void this.processQueue();
      }
    });
  }

  /**
   * Process queued operations sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      const queuedOperation = this.operationQueue.shift();

      if (!queuedOperation) {
        break;
      }

      const { operationId, sourceThreadId, targetContext, options, resolve, reject } =
        queuedOperation;

      try {
        log.info('[ThreadCopyService] Processing queued operation', {
          operationId,
          sourceThreadId,
          targetContext,
          remainingInQueue: this.operationQueue.length,
        });

        const result = await this.executeCopyOperation(
          operationId,
          sourceThreadId,
          targetContext,
          options,
        );

        resolve(result);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error'));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single copy operation
   */
  private async executeCopyOperation(
    operationId: string,
    sourceThreadId: string,
    targetContext: string | null,
    options?: CopyOptions,
  ): Promise<Thread> {
    const operation = this.createOperation(operationId, sourceThreadId, targetContext);

    this.operations.set(operationId, operation);
    this.operationStartTimes.set(operationId, Date.now());
    this.activeOperationId = operationId;

    try {
      log.info('[ThreadCopyService] Starting copy operation', {
        operationId,
        sourceThreadId,
        targetContext,
        options,
      });

      // Update phase: validating
      this.updateOperationPhase(operationId, 'validating');

      // 1. Load source thread first (needed for permission check)
      const sourceThread = await this.loadSourceThread(sourceThreadId);

      // 2. Validate permissions
      await this.validatePermissions(sourceThread, targetContext);

      // 2. Validate permissions
      await this.validatePermissions(sourceThread, targetContext);

      // 3. Check for duplicates
      const duplicateInfo = await this.checkDuplicate(sourceThreadId, targetContext);
      if (duplicateInfo.isDuplicate && !options?.allowDuplicate) {
        throw new Error('Duplicate copy detected');
      }

      // 4. Generate unique thread ID
      const newThreadId = this.generateUniqueThreadId();

      // Update phase: migrating
      this.updateOperationPhase(operationId, 'migrating');

      // 5. Migrate files if needed
      let migratedFiles: { localFiles?: LocalFileReference[]; cloudFiles?: CloudFileReference[] };
      try {
        migratedFiles = await this.migrateFiles(
          sourceThread,
          targetContext,
          newThreadId,
          operation,
        );
      } catch (error) {
        log.error('[ThreadCopyService] File migration failed', {
          operationId,
          error,
        });

        // Enhance error with specific error codes
        const enhancedError = this.enhanceError(error, 'migration');
        throw enhancedError;
      }

      // Update phase: creating
      this.updateOperationPhase(operationId, 'creating');

      // 6. Create new thread with preserved content
      let newThread: Thread;
      try {
        newThread = await this.createNewThread(
          sourceThread,
          newThreadId,
          targetContext,
          migratedFiles,
        );

        // Track created thread for rollback
        operation.rollbackData = {
          ...operation.rollbackData,
          createdThreadId: newThreadId,
        };
      } catch (error) {
        log.error('[ThreadCopyService] Thread creation failed', {
          operationId,
          error,
        });

        // Enhance error with specific error codes
        const enhancedError = this.enhanceError(error, 'creation');
        throw enhancedError;
      }

      // 7. Invalidate cache if copying to project
      if (targetContext) {
        try {
          await this.invalidateProjectCache(targetContext);
        } catch (error) {
          // Cache invalidation failure is not critical
          log.warn('[ThreadCopyService] Cache invalidation failed, continuing', {
            operationId,
            error,
          });
        }
      }

      // Update phase: complete
      this.updateOperationStatus(operationId, 'completed');
      operation.completedAt = Date.now();

      log.info('[ThreadCopyService] Copy operation completed', {
        operationId,
        sourceThreadId,
        newThreadId,
        targetContext,
      });

      return newThread;
    } catch (error) {
      log.error('[ThreadCopyService] Copy operation failed', {
        operationId,
        sourceThreadId,
        targetContext,
        error,
      });

      // Update operation status
      this.updateOperationStatus(operationId, 'failed');
      operation.completedAt = Date.now();
      operation.error = {
        name: this.getErrorCode(error),
        code: this.getErrorCode(error),
        message: error instanceof Error ? error.message : 'Unknown error',
      } as CopyOperationError;

      // Trigger rollback
      try {
        await rollbackProcess.execute(operation);
        log.info('[ThreadCopyService] Rollback completed successfully', {
          operationId,
        });
      } catch (rollbackError) {
        log.error('[ThreadCopyService] Rollback failed', {
          operationId,
          rollbackError,
        });
        // Don't throw rollback error - original error is more important
      }

      throw error;
    } finally {
      // Clear active operation
      if (this.activeOperationId === operationId) {
        this.activeOperationId = null;
      }

      // Clean up operation after some time
      setTimeout(() => {
        this.operations.delete(operationId);
        this.operationStartTimes.delete(operationId);
      }, 60000); // Keep for 1 minute for progress tracking
    }
  }

  /**
   * Cancel an in-progress copy operation
   *
   * @param operationId - ID of the operation to cancel
   * @returns Promise resolving when cancellation is complete
   */
  async cancelCopy(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);

    if (!operation) {
      log.warn('[ThreadCopyService] Operation not found for cancellation', {
        operationId,
      });
      return;
    }

    if (operation.status !== 'in-progress') {
      log.warn('[ThreadCopyService] Operation is not in progress', {
        operationId,
        status: operation.status,
      });
      return;
    }

    log.info('[ThreadCopyService] Cancelling operation', { operationId });

    try {
      // Cancel any ongoing file migrations
      // The migration service uses operation IDs that we can derive
      const migrationOperationId = `${operationId}-migration`;
      await fileMigrationService.cancelMigration(migrationOperationId);

      // Update status
      this.updateOperationStatus(operationId, 'cancelled');
      operation.completedAt = Date.now();
      operation.error = {
        name: 'CANCELLED',
        code: 'CANCELLED',
        message: 'Operation cancelled by user',
      } as CopyOperationError;

      // Trigger rollback to clean up partial state
      await rollbackProcess.execute(operation);

      log.info('[ThreadCopyService] Operation cancelled successfully', {
        operationId,
      });
    } catch (error) {
      log.error('[ThreadCopyService] Error during cancellation', {
        operationId,
        error,
      });

      // Still mark as cancelled even if cleanup fails
      this.updateOperationStatus(operationId, 'cancelled');
      operation.completedAt = Date.now();
      operation.error = {
        name: 'CANCELLED',
        code: 'CANCELLED',
        message: 'Operation cancelled with errors',
      } as CopyOperationError;

      throw error;
    }
  }

  /**
   * Get progress for an ongoing copy operation
   *
   * @param operationId - ID of the operation
   * @returns Progress information or null if not found
   */
  getProgress(operationId: string): CopyProgress | null {
    const operation = this.operations.get(operationId);

    if (!operation) {
      return null;
    }

    // Calculate estimated time remaining
    const progress = { ...operation.progress };

    if (operation.status === 'in-progress' && progress.bytesTotal > 0) {
      const startTime = this.operationStartTimes.get(operationId);

      if (startTime && progress.bytesTransferred > 0) {
        const elapsedMs = Date.now() - startTime;
        const bytesPerMs = progress.bytesTransferred / elapsedMs;
        const remainingBytes = progress.bytesTotal - progress.bytesTransferred;
        const estimatedRemainingMs = remainingBytes / bytesPerMs;

        // Convert to seconds and round
        progress.estimatedTimeRemaining = Math.ceil(estimatedRemainingMs / 1000);
      }
    }

    return progress;
  }

  /**
   * Check if a thread has been previously copied to a destination
   *
   * @param sourceThreadId - Source thread ID
   * @param targetContext - Target context
   * @returns Duplicate detection result
   */
  async checkDuplicate(
    sourceThreadId: string,
    targetContext: string | null,
  ): Promise<DuplicateInfo> {
    log.info('[ThreadCopyService] Checking for duplicate copy', {
      sourceThreadId,
      targetContext,
    });

    try {
      // Load source thread to check metadata
      const sourceThread = await threadRepository.loadThread(sourceThreadId);

      if (!sourceThread) {
        log.warn('[ThreadCopyService] Source thread not found for duplicate check', {
          sourceThreadId,
        });
        return { isDuplicate: false };
      }

      // Check if thread has copy history in metadata
      const copyHistory = sourceThread.metadata?.copyHistory as
        | Array<{
            destinationContext: string | null;
            destinationProjectId?: string;
            copiedAt: number;
            copiedThreadId: string;
          }>
        | undefined;

      if (!copyHistory || !Array.isArray(copyHistory) || copyHistory.length === 0) {
        log.info('[ThreadCopyService] No copy history found');
        return { isDuplicate: false };
      }

      // Check if thread was previously copied to this destination
      const previousCopy = copyHistory.find((entry) => {
        // For personal space, check if destinationContext is null
        if (targetContext === null) {
          return entry.destinationContext === null;
        }

        // For project workspace, check if destinationProjectId matches
        return entry.destinationProjectId === targetContext;
      });

      if (previousCopy) {
        log.info('[ThreadCopyService] Duplicate copy detected', {
          sourceThreadId,
          targetContext,
          previousCopyDate: previousCopy.copiedAt,
          previousThreadId: previousCopy.copiedThreadId,
        });

        return {
          isDuplicate: true,
          previousCopyDate: previousCopy.copiedAt,
          previousThreadId: previousCopy.copiedThreadId,
        };
      }

      log.info('[ThreadCopyService] No duplicate found');
      return { isDuplicate: false };
    } catch (error) {
      log.error('[ThreadCopyService] Error checking for duplicates', {
        sourceThreadId,
        targetContext,
        error,
      });

      // Return safe default on error
      return { isDuplicate: false };
    }
  }

  /**
   * Check if large file confirmation is needed
   *
   * @param sourceThreadId - Source thread ID
   * @returns Large file confirmation data
   */
  async checkLargeFiles(sourceThreadId: string): Promise<LargeFileConfirmation> {
    log.info('[ThreadCopyService] Checking for large files', { sourceThreadId });

    try {
      // Load source thread
      const thread = await threadRepository.loadThread(sourceThreadId);

      if (!thread) {
        throw new Error(`Source thread not found: ${sourceThreadId}`);
      }

      // Check if thread has attachments in metadata
      const hasAttachments =
        thread.metadata?.attachments &&
        Array.isArray(thread.metadata.attachments) &&
        thread.metadata.attachments.length > 0;

      if (!hasAttachments) {
        return {
          needsConfirmation: false,
          totalSize: 0,
          fileCount: 0,
        };
      }

      const attachments = thread.metadata.attachments as Array<{
        id: string;
        filename: string;
        size: number;
      }>;

      // Calculate total file size
      const totalSize = attachments.reduce((sum, file) => sum + (file.size || 0), 0);
      const fileCount = attachments.length;

      // Default threshold: 100MB
      const threshold = 100 * 1024 * 1024; // 100MB in bytes

      const needsConfirmation = totalSize > threshold;

      // Calculate estimated transfer time (assuming 1MB/s average speed)
      const estimatedSeconds = needsConfirmation
        ? Math.ceil(totalSize / (1024 * 1024)) // seconds at 1MB/s
        : undefined;

      log.info('[ThreadCopyService] Large file check complete', {
        sourceThreadId,
        totalSize,
        fileCount,
        needsConfirmation,
        estimatedSeconds,
      });

      return {
        needsConfirmation,
        totalSize,
        fileCount,
        estimatedTransferTime: estimatedSeconds,
        largeFiles: needsConfirmation
          ? attachments
              .filter((f) => f.size > 10 * 1024 * 1024) // Files > 10MB
              .map((f) => ({
                filename: f.filename,
                size: f.size,
              }))
          : undefined,
      };
    } catch (error) {
      log.error('[ThreadCopyService] Failed to check large files', {
        sourceThreadId,
        error,
      });

      // Return safe default on error
      return {
        needsConfirmation: false,
        totalSize: 0,
        fileCount: 0,
      };
    }
  }

  /**
   * Create a new copy operation
   */
  private createOperation(
    operationId: string,
    sourceThreadId: string,
    targetContext: string | null,
  ): CopyOperation {
    return {
      id: operationId,
      sourceThreadId,
      targetContext,
      status: 'in-progress',
      progress: {
        operationId,
        phase: 'validating',
        filesTotal: 0,
        filesCompleted: 0,
        bytesTotal: 0,
        bytesTransferred: 0,
      },
      createdAt: Date.now(),
      rollbackData: {
        uploadedFiles: [],
        downloadedFiles: [],
      },
    };
  }

  /**
   * Update operation phase
   */
  private updateOperationPhase(operationId: string, phase: CopyPhase): void {
    const operation = this.operations.get(operationId);
    if (operation) {
      operation.progress.phase = phase;
    }
  }

  /**
   * Update operation status
   */
  private updateOperationStatus(operationId: string, status: CopyOperationStatus): void {
    const operation = this.operations.get(operationId);
    if (operation) {
      operation.status = status;
    }
  }

  /**
   * Validate permissions for copy operation
   */
  private async validatePermissions(
    sourceThread: Thread,
    targetContext: string | null,
  ): Promise<void> {
    log.info('[ThreadCopyService] Validating permissions', {
      sourceThreadId: sourceThread.id,
      targetContext,
    });

    // Import getAuthService to get the singleton instance
    const { getAuthService } = await import('../../ipc-handlers/auth-handler.js');
    const authService = getAuthService();

    // Get current user
    const currentUser = authService.getUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Check if copying to personal space
    if (targetContext === null) {
      // Copying to personal: User must be thread owner
      const threadOwnerId = sourceThread.metadata?.ownerId as string | undefined;
      const threadCreatedUserId = sourceThread.metadata?.createdUserId as string | undefined;
      const ownerId = threadOwnerId || threadCreatedUserId;

      if (ownerId && ownerId !== currentUser.id) {
        log.warn('[ThreadCopyService] Permission denied: User is not thread owner', {
          userId: currentUser.id,
          ownerId,
        });
        throw new Error('Only thread owner can copy to personal');
      }
    }

    // For copying to project: Permission check happens at API level
    // The Moku API will validate if user has write access to target project
    log.info('[ThreadCopyService] Permission validation passed');
  }

  /**
   * Load source thread
   */
  private async loadSourceThread(sourceThreadId: string): Promise<Thread> {
    log.info('[ThreadCopyService] Loading source thread', { sourceThreadId });

    const thread = await threadRepository.loadThread(sourceThreadId);

    if (!thread) {
      throw new Error(`Source thread not found: ${sourceThreadId}`);
    }

    return thread;
  }

  /**
   * Generate unique thread ID
   */
  private generateUniqueThreadId(): string {
    return randomUUID();
  }

  /**
   * Migrate files between contexts
   */
  private async migrateFiles(
    sourceThread: Thread,
    targetContext: string | null,
    newThreadId: string,
    operation: CopyOperation,
  ): Promise<{ localFiles?: LocalFileReference[]; cloudFiles?: CloudFileReference[] }> {
    log.info('[ThreadCopyService] Migrating files', {
      sourceThreadId: sourceThread.id,
      targetContext,
      newThreadId,
    });

    // Check if thread has attachments in metadata
    const hasAttachments =
      sourceThread.metadata &&
      sourceThread.metadata.attachments &&
      Array.isArray(sourceThread.metadata.attachments) &&
      sourceThread.metadata.attachments.length > 0;

    if (!hasAttachments) {
      log.info('[ThreadCopyService] No attachments to migrate');
      return {};
    }

    const attachments = sourceThread.metadata.attachments as Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      localPath?: string;
      cloudFileId?: string;
      cloudUrl?: string;
    }>;

    // Determine migration direction
    const sourceIsProject = !!sourceThread.metadata?.projectId;
    const targetIsProject = !!targetContext;

    if (sourceIsProject && !targetIsProject) {
      // Project to Personal: migrate cloud files to local
      const cloudFiles: CloudFileReference[] = attachments
        .filter((a) => a.cloudFileId && a.cloudUrl)
        .map((a) => ({
          fileId: a.cloudFileId as string,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.cloudUrl as string,
        }));

      if (cloudFiles.length > 0) {
        const localFiles = await fileMigrationService.migrateToLocal(
          cloudFiles,
          newThreadId,
          (progress) => {
            // Update operation progress
            operation.progress.filesTotal = progress.totalFiles;
            operation.progress.filesCompleted = progress.fileIndex;
            operation.progress.bytesTotal = progress.totalBytes;
            operation.progress.bytesTransferred = progress.bytesTransferred;
            operation.progress.currentFile = progress.currentFile;
          },
        );

        // Track downloaded files for rollback
        if (operation.rollbackData) {
          operation.rollbackData.downloadedFiles = localFiles.map((f) => f.path);
        }

        return { localFiles };
      }
    } else if (!sourceIsProject && targetIsProject) {
      // Personal to Project: migrate local files to cloud
      const localFiles: LocalFileReference[] = attachments
        .filter((a) => a.localPath)
        .map((a) => ({
          path: a.localPath as string,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
        }));

      if (localFiles.length > 0) {
        const cloudFiles = await fileMigrationService.migrateToCloud(
          localFiles,
          targetContext,
          (progress) => {
            // Update operation progress
            operation.progress.filesTotal = progress.totalFiles;
            operation.progress.filesCompleted = progress.fileIndex;
            operation.progress.bytesTotal = progress.totalBytes;
            operation.progress.bytesTransferred = progress.bytesTransferred;
            operation.progress.currentFile = progress.currentFile;
          },
        );

        // Track uploaded files for rollback
        if (operation.rollbackData) {
          operation.rollbackData.uploadedFiles = cloudFiles.map((f) => f.fileId);
        }

        return { cloudFiles };
      }
    }

    // Same context (personal to personal or project to project)
    // No migration needed, files stay in same storage
    log.info('[ThreadCopyService] Same context, no file migration needed');
    return {};
  }

  /**
   * Create new thread with preserved content
   */
  private async createNewThread(
    sourceThread: Thread,
    newThreadId: string,
    targetContext: string | null,
    migratedFiles: { localFiles?: LocalFileReference[]; cloudFiles?: CloudFileReference[] },
  ): Promise<Thread> {
    log.info('[ThreadCopyService] Creating new thread', {
      sourceThreadId: sourceThread.id,
      newThreadId,
      targetContext,
    });

    // Prepare metadata for new thread
    const newMetadata: Record<string, unknown> = {
      ...sourceThread.metadata,
      projectId: targetContext,
      copiedFrom: {
        threadId: sourceThread.id,
        context: sourceThread.metadata?.projectId ? 'project' : 'personal',
        projectId: sourceThread.metadata?.projectId,
        copiedAt: Date.now(),
      },
    };

    // Update attachments with new file references
    if (migratedFiles.localFiles && migratedFiles.localFiles.length > 0) {
      newMetadata.attachments = migratedFiles.localFiles.map((file) => ({
        id: randomUUID(),
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        localPath: file.path,
        uploadedAt: Date.now(),
        status: 'success',
      }));
    } else if (migratedFiles.cloudFiles && migratedFiles.cloudFiles.length > 0) {
      newMetadata.attachments = migratedFiles.cloudFiles.map((file) => ({
        id: randomUUID(),
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        cloudFileId: file.fileId,
        cloudUrl: file.url,
        uploadedAt: Date.now(),
        status: 'success',
      }));
    } else if (sourceThread.metadata?.attachments) {
      // Same context, preserve existing attachments
      newMetadata.attachments = sourceThread.metadata.attachments;
    }

    // Create new thread via repository
    const newThread = await threadRepository.createThread(newMetadata);

    // Copy messages from source thread
    for (const message of sourceThread.messages) {
      await threadRepository.appendMessage(newThread.id, {
        role: message.role,
        content: message.content,
        metadata: message.rawData,
        clientMessageId: message.clientMessageId,
        branchId: message.branchId,
        modelId: message.modelId,
        provider: ''
      });
    }

    // Update source thread's copy history
    try {
      await this.updateCopyHistory(sourceThread.id, targetContext, newThread.id);
    } catch (error) {
      // Copy history update failure is not critical
      log.warn('[ThreadCopyService] Failed to update copy history, continuing', {
        sourceThreadId: sourceThread.id,
        error,
      });
    }

    // Reload thread to get complete data with messages
    const completeThread = await threadRepository.loadThread(newThread.id);

    if (!completeThread) {
      throw new Error(`Failed to load newly created thread: ${newThread.id}`);
    }

    log.info('[ThreadCopyService] New thread created successfully', {
      newThreadId: completeThread.id,
      messageCount: completeThread.messages.length,
    });

    return completeThread;
  }

  /**
   * Invalidate project cache
   */
  private async invalidateProjectCache(projectId: string): Promise<void> {
    log.info('[ThreadCopyService] Invalidating project cache', { projectId });

    try {
      await projectCache.invalidateProject(projectId);
      log.info('[ThreadCopyService] Project cache invalidated successfully', {
        projectId,
      });
    } catch (error) {
      log.error('[ThreadCopyService] Failed to invalidate project cache', {
        projectId,
        error,
      });
      // Don't throw - cache invalidation failure shouldn't fail the copy
    }
  }

  /**
   * Update copy history in source thread metadata
   */
  private async updateCopyHistory(
    sourceThreadId: string,
    targetContext: string | null,
    newThreadId: string,
  ): Promise<void> {
    log.info('[ThreadCopyService] Updating copy history', {
      sourceThreadId,
      targetContext,
      newThreadId,
    });

    try {
      // Load source thread
      const sourceThread = await threadRepository.loadThread(sourceThreadId);

      if (!sourceThread) {
        throw new Error(`Source thread not found: ${sourceThreadId}`);
      }

      // Get existing copy history or create new array
      const copyHistory =
        (sourceThread.metadata?.copyHistory as
          | Array<{
              destinationContext: string | null;
              destinationProjectId?: string;
              copiedAt: number;
              copiedThreadId: string;
            }>
          | undefined) || [];

      // Add new copy entry
      copyHistory.push({
        destinationContext: targetContext ? 'project' : 'personal',
        destinationProjectId: targetContext || undefined,
        copiedAt: Date.now(),
        copiedThreadId: newThreadId,
      });

      // Update thread metadata
      const updatedMetadata = {
        ...sourceThread.metadata,
        copyHistory,
      };

      // Save updated metadata
      threadRepository.updateThreadMetadata(sourceThreadId, updatedMetadata);

      log.info('[ThreadCopyService] Copy history updated successfully', {
        sourceThreadId,
        historyLength: copyHistory.length,
      });
    } catch (error) {
      log.error('[ThreadCopyService] Failed to update copy history', {
        sourceThreadId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get error code from error
   */
  private getErrorCode(error: unknown): string {
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('permission') || error.message.includes('Permission')) {
        return 'PERMISSION_DENIED';
      }
      if (error.message.includes('network') || error.message.includes('Network')) {
        return 'NETWORK_ERROR';
      }
      if (error.message.includes('quota') || error.message.includes('Quota')) {
        return 'QUOTA_EXCEEDED';
      }
      if (
        error.message.includes('size') ||
        error.message.includes('Size') ||
        error.message.includes('large')
      ) {
        return 'FILE_TOO_LARGE';
      }
      if (
        error.message.includes('cancel') ||
        error.message.includes('Cancel') ||
        error.message.includes('abort')
      ) {
        return 'CANCELLED';
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Enhance error with specific error codes based on context
   */
  private enhanceError(error: unknown, context: 'migration' | 'creation'): Error {
    if (!(error instanceof Error)) {
      return new Error(`${context} failed: Unknown error`);
    }

    // Check for network-related errors
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('fetch failed')
    ) {
      const networkError = new Error(`Network error during ${context}: ${error.message}`);
      networkError.name = 'NETWORK_ERROR';
      return networkError;
    }

    // Check for quota errors
    if (
      error.message.includes('quota') ||
      error.message.includes('storage full') ||
      error.message.includes('insufficient space')
    ) {
      const quotaError = new Error(`Storage quota exceeded during ${context}: ${error.message}`);
      quotaError.name = 'QUOTA_EXCEEDED';
      return quotaError;
    }

    // Check for file size errors
    if (
      error.message.includes('too large') ||
      error.message.includes('exceeds maximum') ||
      error.message.includes('file size')
    ) {
      const sizeError = new Error(`File too large during ${context}: ${error.message}`);
      sizeError.name = 'FILE_TOO_LARGE';
      return sizeError;
    }

    // Check for cancellation
    if (error.message.includes('cancelled') || error.message.includes('aborted')) {
      const cancelError = new Error(`Operation cancelled during ${context}`);
      cancelError.name = 'CANCELLED';
      return cancelError;
    }

    // Return original error with context
    const enhancedError = new Error(`${context} failed: ${error.message}`);
    enhancedError.name = error.name || 'UNKNOWN';
    enhancedError.stack = error.stack;
    return enhancedError;
  }
}

// Export singleton instance
export const threadCopyService = new ThreadCopyService();
