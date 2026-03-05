/* eslint-disable @typescript-eslint/require-await */
/**
 * IPC handlers for file operations
 * Exposes file upload, download, delete, and validation to renderer process
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { fileStorageService } from '../services/file-storage.service.js';
import { fileValidationService } from '../services/file-validation.service.js';
import type { Attachment, FileValidationResult } from '../../src-shared/types/attachment.types.js';
import log from '../utils/logger.js';

/**
 * Register all file-related IPC handlers
 */
export function registerFileHandlers(): void {
  ipcMain.handle('file:upload', handleFileUpload);
  ipcMain.handle('file:get', handleFileGet);
  ipcMain.handle('file:validate', handleFileValidate);

  log.info('[FileHandler] File IPC handlers registered');
}

/**
 * Handle file upload
 */
async function handleFileUpload(
  event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
  },
): Promise<{ success: boolean; attachment?: Attachment; error?: string }> {
  try {
    const { threadId, fileBuffer, filename, mimeType } = payload;

    log.info('[FileHandler] Upload request received', {
      threadId,
      filename,
      mimeType,
      size: fileBuffer.length,
    });

    // Validate input
    if (!threadId || !fileBuffer || !filename || !mimeType) {
      return {
        success: false,
        error: 'Missing required fields: threadId, fileBuffer, filename, or mimeType',
      };
    }

    // Validate file
    const validation = fileValidationService.validate(filename, mimeType, fileBuffer.length);

    if (!validation.valid) {
      log.warn('[FileHandler] File validation failed', {
        threadId,
        filename,
        error: validation.error,
        code: validation.code,
      });

      return {
        success: false,
        error: validation.error || 'File validation failed',
      };
    }

    // Sanitize filename
    const sanitizedFilename = fileValidationService.sanitizeFilename(filename);

    // Save file
    const attachment = await fileStorageService.saveFile(
      threadId,
      fileBuffer,
      sanitizedFilename,
      mimeType,
    );

    log.info('[FileHandler] File uploaded successfully', {
      threadId,
      fileId: attachment.id,
      filename: sanitizedFilename,
      size: attachment.size,
    });

    return {
      success: true,
      attachment,
    };
  } catch (error) {
    log.error('[FileHandler] Upload error', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload',
    };
  }
}

/**
 * Handle file retrieval
 */
async function handleFileGet(
  event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    fileId: string;
  },
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const { threadId, fileId } = payload;

    log.info('[FileHandler] Get file request', { threadId, fileId });

    // Validate input
    if (!threadId || !fileId) {
      return {
        success: false,
        error: 'Missing required fields: threadId or fileId',
      };
    }

    // Retrieve file
    const buffer = await fileStorageService.getFile(threadId, fileId);

    if (!buffer) {
      log.warn('[FileHandler] File not found', { threadId, fileId });
      return {
        success: false,
        error: 'File not found',
      };
    }

    log.info('[FileHandler] File retrieved successfully', {
      threadId,
      fileId,
      size: buffer.length,
    });

    return {
      success: true,
      buffer,
    };
  } catch (error) {
    log.error('[FileHandler] Get file error', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error retrieving file',
    };
  }
}

/**
 * Handle file validation (pre-flight check before upload)
 */
async function handleFileValidate(
  event: IpcMainInvokeEvent,
  payload: {
    filename: string;
    mimeType: string;
    size: number;
  },
): Promise<FileValidationResult> {
  try {
    const { filename, mimeType, size } = payload;

    log.info('[FileHandler] Validate file request', { filename, mimeType, size });

    // Validate input
    if (!filename || !mimeType || size === undefined) {
      return {
        valid: false,
        error: 'Missing required fields: filename, mimeType, or size',
      };
    }

    // Validate file
    const validation = fileValidationService.validate(filename, mimeType, size);

    log.info('[FileHandler] Validation result', {
      filename,
      valid: validation.valid,
      error: validation.error,
    });

    return validation;
  } catch (error) {
    log.error('[FileHandler] Validation error', { error });

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}
