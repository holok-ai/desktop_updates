/**
 * TitleValidationService
 * Validates thread title changes: length, duplicates, sanitization
 */

import log from '../utils/logger.js';

/**
 * Validation result for title operations
 */
export interface TitleValidationResult {
  valid: boolean;
  error?: string;
  code?:
    | 'TITLE_EMPTY'
    | 'TITLE_TOO_SHORT'
    | 'TITLE_TOO_LONG'
    | 'TITLE_DUPLICATE'
    | 'TITLE_INVALID_CHARACTERS';
  sanitizedTitle?: string;
}

/**
 * Configuration for title validation
 */
interface ValidationConfig {
  /** Minimum title length (default: 1) */
  minLength: number;

  /** Maximum title length (default: 200) */
  maxLength: number;

  /** Whether to check for duplicates (default: true) */
  checkDuplicates: boolean;

  /** Whether to trim whitespace (default: true) */
  trimWhitespace: boolean;

  /** Whether to collapse multiple spaces (default: true) */
  collapseSpaces: boolean;

  /** Regex pattern for invalid characters (control characters, etc.) */
  invalidCharPattern: RegExp;
}

export class TitleValidationService {
  private config: ValidationConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Get default validation configuration
   */
  private getDefaultConfig(): ValidationConfig {
    return {
      minLength: 1,
      maxLength: 200,
      checkDuplicates: true,
      trimWhitespace: true,
      collapseSpaces: true,
      // Disallow control characters (0x00-0x1F, 0x7F-0x9F) except newline/tab
      // eslint-disable-next-line no-control-regex
      invalidCharPattern: /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g,
    };
  }

  /**
   * Validate and sanitize a thread title
   * @param title - The title to validate
   * @param existingTitles - Optional array of existing titles to check for duplicates
   * @param currentTitle - Optional current title (to allow same title on update)
   * @returns Validation result with sanitized title if valid
   */
  validate(title: string, existingTitles?: string[], currentTitle?: string): TitleValidationResult {
    try {
      // Sanitize the title
      const sanitized = this.sanitize(title);

      // Check if empty after sanitization
      if (sanitized.length === 0) {
        return {
          valid: false,
          error: 'Title cannot be empty',
          code: 'TITLE_EMPTY',
        };
      }

      // Check minimum length
      if (sanitized.length < this.config.minLength) {
        return {
          valid: false,
          error: `Title must be at least ${this.config.minLength} character(s)`,
          code: 'TITLE_TOO_SHORT',
        };
      }

      // Check maximum length
      if (sanitized.length > this.config.maxLength) {
        return {
          valid: false,
          error: `Title cannot exceed ${this.config.maxLength} characters`,
          code: 'TITLE_TOO_LONG',
        };
      }

      // Check for invalid characters
      if (this.config.invalidCharPattern.test(sanitized)) {
        return {
          valid: false,
          error: 'Title contains invalid characters',
          code: 'TITLE_INVALID_CHARACTERS',
        };
      }

      // Check for duplicates (case-insensitive)
      if (this.config.checkDuplicates && existingTitles && existingTitles.length > 0) {
        const normalizedTitle = sanitized.toLowerCase();
        const normalizedCurrent = currentTitle ? currentTitle.toLowerCase() : null;

        // Skip duplicate check if the title matches the current title
        if (normalizedTitle !== normalizedCurrent) {
          const isDuplicate = existingTitles.some(
            (existing) => existing.toLowerCase() === normalizedTitle,
          );

          if (isDuplicate) {
            return {
              valid: false,
              error: 'A thread with this title already exists',
              code: 'TITLE_DUPLICATE',
            };
          }
        }
      }

      return {
        valid: true,
        sanitizedTitle: sanitized,
      };
    } catch (error) {
      log.error('[TitleValidationService] Validation error:', error);
      return {
        valid: false,
        error: 'An error occurred during validation',
      };
    }
  }

  /**
   * Sanitize a title by trimming, collapsing spaces, and removing invalid characters
   * @param title - The title to sanitize
   * @returns Sanitized title
   */
  private sanitize(title: string): string {
    let sanitized = title;

    // Remove invalid characters (control characters, etc.)
    sanitized = sanitized.replace(this.config.invalidCharPattern, '');

    // Trim whitespace if enabled
    if (this.config.trimWhitespace) {
      sanitized = sanitized.trim();
    }

    // Collapse multiple spaces into single space if enabled
    if (this.config.collapseSpaces) {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    // Replace newlines and tabs with spaces
    sanitized = sanitized.replace(/[\n\r\t]/g, ' ');

    // Final trim after replacements
    sanitized = sanitized.trim();

    return sanitized;
  }
}

// Export singleton instance
export const titleValidationService = new TitleValidationService();

export default TitleValidationService;
