/* eslint-disable no-control-regex */
/**
 * FileValidationService
 * Validates file uploads: type, size, filename, MIME type
 */

import * as path from 'path';
import type { FileValidationResult } from '../../src-shared/types/attachment.types.js';
import log from '../utils/logger.js';

/**
 * Configuration for file validation
 */
interface ValidationConfig {
  /** Maximum file size in bytes (default: 5MB) */
  maxFileSize: number;

  /** Allowed MIME types */
  allowedMimeTypes: Set<string>;

  /** Allowed file extensions */
  allowedExtensions: Set<string>;

  /** MIME type to extension mapping for validation */
  mimeToExtensions: Map<string, string[]>;
}

export class FileValidationService {
  private config: ValidationConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Validate file before upload
   */
  validate(filename: string, mimeType: string, size: number): FileValidationResult {
    // Validate filename
    const filenameValidation = this.validateFilename(filename);
    if (!filenameValidation.valid) {
      return filenameValidation;
    }

    // Validate file size
    const sizeValidation = this.validateSize(size);
    if (!sizeValidation.valid) {
      return sizeValidation;
    }

    // Validate MIME type and extension
    const typeValidation = this.validateType(filename, mimeType);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    log.info('[FileValidationService] File validation passed', {
      filename,
      mimeType,
      size,
    });

    return { valid: true };
  }

  /**
   * Sanitize filename (prevent path traversal and malicious names)
   */
  sanitizeFilename(filename: string): string {
    if (!filename) {
      return 'unnamed';
    }

    // Remove path separators and parent directory references
    let sanitized = filename.replace(/[/\\]/g, '_');
    sanitized = sanitized.replace(/\.\./g, '_');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove control characters (ASCII 0-31)
    sanitized = sanitized.replace(/[\x00-\x1F]/g, '');

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

    // Limit length (max 255 characters)
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }

    // If sanitization resulted in empty string, use default
    if (!sanitized) {
      return 'unnamed';
    }

    return sanitized;
  }

  /**
   * Validate filename
   */
  private validateFilename(filename: string): FileValidationResult {
    if (!filename || filename.trim() === '') {
      return {
        valid: false,
        error: 'Filename is required',
        code: 'INVALID_NAME',
      };
    }

    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      log.warn('[FileValidationService] Path traversal attempt detected', { filename });
      return {
        valid: false,
        error: 'Invalid filename: path separators not allowed',
        code: 'INVALID_NAME',
      };
    }

    // Check for null bytes
    if (filename.includes('\0')) {
      log.warn('[FileValidationService] Null byte in filename', { filename });
      return {
        valid: false,
        error: 'Invalid filename: null bytes not allowed',
        code: 'INVALID_NAME',
      };
    }

    // Check filename length
    if (filename.length > 255) {
      return {
        valid: false,
        error: 'Filename too long (max 255 characters)',
        code: 'INVALID_NAME',
      };
    }

    return { valid: true };
  }

  /**
   * Validate file size
   */
  private validateSize(size: number): FileValidationResult {
    if (size <= 0) {
      return {
        valid: false,
        error: 'File size must be greater than 0',
        code: 'INVALID_SIZE',
      };
    }

    if (size > this.config.maxFileSize) {
      const maxSizeMB = (this.config.maxFileSize / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File too large (max ${maxSizeMB}MB)`,
        code: 'FILE_TOO_LARGE',
      };
    }

    return { valid: true };
  }

  /**
   * Validate file type and extension
   */
  private validateType(filename: string, mimeType: string): FileValidationResult {
    // Extract extension
    const extension = path.extname(filename).toLowerCase().replace(/^\./, '');

    if (!extension) {
      return {
        valid: false,
        error: 'File must have an extension',
        code: 'INVALID_TYPE',
      };
    }

    // Check if MIME type is allowed
    if (!this.config.allowedMimeTypes.has(mimeType)) {
      log.warn('[FileValidationService] Disallowed MIME type', { filename, mimeType });
      return {
        valid: false,
        error: `File type not allowed: ${mimeType}`,
        code: 'INVALID_TYPE',
      };
    }

    // Check if extension is allowed
    if (!this.config.allowedExtensions.has(extension)) {
      log.warn('[FileValidationService] Disallowed extension', { filename, extension });
      return {
        valid: false,
        error: `File extension not allowed: .${extension}`,
        code: 'INVALID_TYPE',
      };
    }

    // Check if extension matches MIME type
    const allowedExtensions = this.config.mimeToExtensions.get(mimeType);
    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      log.warn('[FileValidationService] Extension mismatch', {
        filename,
        extension,
        mimeType,
        expectedExtensions: allowedExtensions,
      });
      return {
        valid: false,
        error: `File extension .${extension} does not match MIME type ${mimeType}`,
        code: 'INVALID_TYPE',
      };
    }

    return { valid: true };
  }

  /**
   * Get default validation configuration
   */
  private getDefaultConfig(): ValidationConfig {
    // Default max file size: 5MB
    const maxFileSize = 5 * 1024 * 1024;

    // Allowed MIME types
    const allowedMimeTypes = new Set([
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',

      // Documents
      'application/pdf',
      'text/plain',
      'text/markdown',

      // Data
      'application/json',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);

    // Allowed extensions
    const allowedExtensions = new Set([
      // Images
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'svg',

      // Documents
      'pdf',
      'txt',
      'md',

      // Data
      'json',
      'csv',
      'xls',
      'xlsx',
    ]);

    // MIME type to extension mapping
    const mimeToExtensions = new Map<string, string[]>([
      // Images
      ['image/jpeg', ['jpg', 'jpeg']],
      ['image/png', ['png']],
      ['image/gif', ['gif']],
      ['image/webp', ['webp']],
      ['image/svg+xml', ['svg']],

      // Documents
      ['application/pdf', ['pdf']],
      ['text/plain', ['txt']],
      ['text/markdown', ['md']],

      // Data
      ['application/json', ['json']],
      ['text/csv', ['csv']],
      ['application/vnd.ms-excel', ['xls']],
      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['xlsx']],
    ]);

    return {
      maxFileSize,
      allowedMimeTypes,
      allowedExtensions,
      mimeToExtensions,
    };
  }

}

// Export singleton instance
export const fileValidationService = new FileValidationService();
