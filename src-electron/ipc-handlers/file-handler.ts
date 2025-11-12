/* eslint-disable @typescript-eslint/require-await */
/**
 * IPC handlers for file operations
 * Exposes file upload, download, delete, and validation to renderer process
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { fileStorageService } from '../services/file-storage.service.js';
import { fileValidationService } from '../services/file-validation.service.js';
import { fileAccessTokenService } from '../services/file-access-token.service.js';
import { fileAuditService } from '../services/file-audit.service.js';
import { fileTypeDetectorService } from '../services/file-type-detector.service.js';
import type { Attachment, FileValidationResult } from '../../src-shared/types/attachment.types.js';
import log from '../utils/logger.js';

/**
 * Register all file-related IPC handlers
 */
export function registerFileHandlers(): void {
  ipcMain.handle('file:upload', handleFileUpload);
  ipcMain.handle('file:get', handleFileGet);
  ipcMain.handle('file:delete', handleFileDelete);
  ipcMain.handle('file:validate', handleFileValidate);
  ipcMain.handle('file:preview', handleFilePreview);
  ipcMain.handle('file:download', handleFileDownload);
  ipcMain.handle('file:getWithToken', handleFileGetWithToken);

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
 * Handle file deletion
 */
async function handleFileDelete(
  event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    fileId: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { threadId, fileId } = payload;

    log.info('[FileHandler] Delete file request', { threadId, fileId });

    // Validate input
    if (!threadId || !fileId) {
      return {
        success: false,
        error: 'Missing required fields: threadId or fileId',
      };
    }

    // Delete file
    const deleted = await fileStorageService.deleteFile(threadId, fileId);

    if (!deleted) {
      log.warn('[FileHandler] File not found or already deleted', { threadId, fileId });
      return {
        success: false,
        error: 'File not found or already deleted',
      };
    }

    log.info('[FileHandler] File deleted successfully', { threadId, fileId });

    return {
      success: true,
    };
  } catch (error) {
    log.error('[FileHandler] Delete file error', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deleting file',
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

/**
 * Handle file preview (generate token for secure access)
 */
async function handleFilePreview(
  event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    fileId: string;
    userId: string;
  },
): Promise<{
  success: boolean;
  token?: string;
  fileInfo?: {
    filename: string;
    mimeType: string;
    size: number;
    isPreviewable: boolean;
    canInlinePreview: boolean;
  };
  error?: string;
}> {
  try {
    const { threadId, fileId, userId } = payload;

    log.info('[FileHandler] Preview request', { threadId, fileId, userId });

    // Validate input
    if (!threadId || !fileId || !userId) {
      return {
        success: false,
        error: 'Missing required fields: threadId, fileId, or userId',
      };
    }

    // Check if file exists
    if (!fileStorageService.fileExists(threadId, fileId)) {
      log.warn('[FileHandler] File not found for preview', { threadId, fileId });

      // Log failed attempt
      fileAuditService.logPreview(userId, fileId, 'unknown', {
        threadId,
        success: false,
        errorMessage: 'File not found',
      });

      return {
        success: false,
        error: 'File not found or has been deleted',
      };
    }

    // Get file size
    const fileSize = await fileStorageService.getFileSize(threadId, fileId);

    if (!fileSize) {
      return {
        success: false,
        error: 'Could not determine file size',
      };
    }

    // Get file path to determine filename and MIME type
    const filePath = fileStorageService.getFilePath(threadId, fileId);
    const filename = filePath.split('/').pop() || 'unknown';

    // Detect file type
    const fileTypeInfo = fileTypeDetectorService.detectFileType(filename);

    // Check if file is previewable
    if (!fileTypeInfo.isPreviewable) {
      log.warn('[FileHandler] File is not previewable', {
        threadId,
        fileId,
        category: fileTypeInfo.category,
      });

      return {
        success: false,
        error: 'This file type cannot be previewed. Please download instead.',
      };
    }

    // Generate access token
    const tokenData = fileAccessTokenService.generateToken(fileId, userId, 'preview');

    // Log successful preview access
    fileAuditService.logPreview(userId, fileId, filename, {
      threadId,
      fileSize,
      mimeType: fileTypeInfo.mimeType,
      success: true,
    });

    log.info('[FileHandler] Preview token generated', {
      threadId,
      fileId,
      userId,
      expiresAt: tokenData.expiresAt,
    });

    return {
      success: true,
      token: tokenData.token,
      fileInfo: {
        filename,
        mimeType: fileTypeInfo.mimeType,
        size: fileSize,
        isPreviewable: fileTypeInfo.isPreviewable,
        canInlinePreview: fileTypeDetectorService.canInlinePreview(
          filename,
          fileSize,
          fileTypeInfo.mimeType,
        ),
      },
    };
  } catch (error) {
    log.error('[FileHandler] Preview error', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during preview',
    };
  }
}

/**
 * Handle file download (generate token for secure download)
 */
async function handleFileDownload(
  event: IpcMainInvokeEvent,
  payload: {
    threadId: string;
    fileId: string;
    userId: string;
  },
): Promise<{
  success: boolean;
  token?: string;
  fileInfo?: {
    filename: string;
    mimeType: string;
    size: number;
  };
  error?: string;
}> {
  try {
    const { threadId, fileId, userId } = payload;

    log.info('[FileHandler] Download request', { threadId, fileId, userId });

    // Validate input
    if (!threadId || !fileId || !userId) {
      return {
        success: false,
        error: 'Missing required fields: threadId, fileId, or userId',
      };
    }

    // Check if file exists
    if (!fileStorageService.fileExists(threadId, fileId)) {
      log.warn('[FileHandler] File not found for download', { threadId, fileId });

      // Log failed attempt
      fileAuditService.logDownload(userId, fileId, 'unknown', {
        threadId,
        success: false,
        errorMessage: 'File not found',
      });

      return {
        success: false,
        error: 'File not found or has been deleted',
      };
    }

    // Get file size
    const fileSize = await fileStorageService.getFileSize(threadId, fileId);

    if (!fileSize) {
      return {
        success: false,
        error: 'Could not determine file size',
      };
    }

    // Get file path to determine filename and MIME type
    const filePath = fileStorageService.getFilePath(threadId, fileId);
    const filename = filePath.split('/').pop() || 'unknown';

    // Detect file type
    const fileTypeInfo = fileTypeDetectorService.detectFileType(filename);

    // Generate access token
    const tokenData = fileAccessTokenService.generateToken(fileId, userId, 'download');

    // Log successful download access
    fileAuditService.logDownload(userId, fileId, filename, {
      threadId,
      fileSize,
      mimeType: fileTypeInfo.mimeType,
      success: true,
    });

    log.info('[FileHandler] Download token generated', {
      threadId,
      fileId,
      userId,
      expiresAt: tokenData.expiresAt,
    });

    return {
      success: true,
      token: tokenData.token,
      fileInfo: {
        filename,
        mimeType: fileTypeInfo.mimeType,
        size: fileSize,
      },
    };
  } catch (error) {
    log.error('[FileHandler] Download error', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during download',
    };
  }
}

/**
 * Handle file retrieval with token (secure access)
 */
async function handleFileGetWithToken(
  event: IpcMainInvokeEvent,
  payload: {
    token: string;
  },
): Promise<{
  success: boolean;
  buffer?: Buffer;
  filename?: string;
  mimeType?: string;
  error?: string;
}> {
  try {
    const { token } = payload;

    log.info('[FileHandler] Get file with token request');

    // Validate input
    if (!token) {
      return {
        success: false,
        error: 'Missing required field: token',
      };
    }

    // Retrieve file with token
    const fileData = await fileStorageService.getFileWithToken(token);

    if (!fileData) {
      log.warn('[FileHandler] Invalid token or file not found');
      return {
        success: false,
        error: 'Invalid or expired token, or file not found',
      };
    }

    log.info('[FileHandler] File retrieved with token successfully', {
      filename: fileData.filename,
      size: fileData.buffer.length,
    });

    return {
      success: true,
      buffer: fileData.buffer,
      filename: fileData.filename,
      mimeType: fileData.mimeType,
    };
  } catch (error) {
    log.error('[FileHandler] Get file with token error', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error retrieving file',
    };
  }
}

/**
 * Emit upload progress event to renderer
 * Note: This is a helper for future streaming upload implementation
 */
export function emitUploadProgress(
  event: IpcMainInvokeEvent,
  fileId: string,
  progress: number,
): void {
  event.sender.send('file:uploadProgress', { fileId, progress });
}
