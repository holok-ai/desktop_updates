/* eslint-disable no-useless-escape */
import log from 'electron-log';

/**
 * Title Generator Service
 *
 * Generates concise, descriptive titles from user prompts for thread identification.
 * Handles sanitization, truncation, and uniqueness checking to ensure titles are
 * safe, readable, and distinguishable.
 *
 * This is a local, synchronous service that processes prompts in <1ms.
 * In the future, this could be replaced with an AI-powered title generation API
 * while maintaining the same interface.
 */

/**
 * Configuration for title generation
 */
export interface TitleGeneratorConfig {
  /** Maximum length of generated titles */
  maxLength: number;
  /** Minimum length before truncation is applied */
  minLength: number;
  /** Fallback title when generation fails */
  fallbackTitle: string;
  /** Words to skip at the beginning of prompts (common filler words) */
  skipWords: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TitleGeneratorConfig = {
  maxLength: 80,
  minLength: 60,
  fallbackTitle: 'New Thread',
  skipWords: ['please', 'can you', 'could you', 'would you', 'i want', 'i need', 'help me'],
};

/**
 * Title Generator Service
 */
export class TitleGeneratorService {
  private config: TitleGeneratorConfig;

  constructor(config: Partial<TitleGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a title from a user prompt
   *
   * @param prompt - The user's prompt text
   * @returns A sanitized, truncated title suitable for display
   *
   * @example
   * generateTitle("Can you help me write a Python script to parse CSV files?")
   * // Returns: "Write a Python script to parse CSV files"
   */
  public generateTitle(prompt: string): string {
    try {
      if (!prompt || typeof prompt !== 'string') {
        log.warn('[TitleGeneratorService] Invalid prompt provided, using fallback');
        return this.config.fallbackTitle;
      }

      // Step 1: Sanitize the prompt
      const sanitized = this.sanitizePrompt(prompt);

      // Step 2: Check if sanitization resulted in empty string
      if (!sanitized || sanitized.trim().length === 0) {
        log.warn('[TitleGeneratorService] Sanitization resulted in empty string, using fallback');
        return this.config.fallbackTitle;
      }

      // Step 3: Remove common filler words from the beginning
      const trimmed = this.removeFillerWords(sanitized);

      // Step 4: Truncate to appropriate length with word-boundary awareness
      const truncated = this.truncateAtWordBoundary(trimmed, this.config.maxLength);

      // Step 5: Final validation and cleanup
      const title = this.finalizeTitle(truncated);

      log.debug('[TitleGeneratorService] Generated title:', { original: prompt, title });
      return title;
    } catch (error) {
      log.error('[TitleGeneratorService] Error generating title:', error);
      return this.config.fallbackTitle;
    }
  }

  /**
   * Sanitize prompt by removing sensitive data and cleaning up text
   *
   * Removes:
   * - URLs (http://, https://, www.)
   * - Email addresses
   * - File paths (absolute and relative)
   * - Excessive whitespace
   * - Special characters that could cause issues
   *
   * @param prompt - Raw prompt text
   * @returns Sanitized prompt text
   */
  private sanitizePrompt(prompt: string): string {
    let text = prompt;

    // Remove URLs (http://, https://, www.)
    text = text.replace(/https?:\/\/[^\s]+/gi, '');
    text = text.replace(/www\.[^\s]+/gi, '');

    // Remove email addresses
    text = text.replace(/[\w.-]+@[\w.-]+\.\w+/gi, '');

    // Remove file paths (Unix-style and Windows-style)
    // Unix absolute paths: /path/to/file
    text = text.replace(/\/[\w./\-]+/g, '');
    // Windows absolute paths: C:\path\to\file
    text = text.replace(/[A-Za-z]:\\[\w\\.\-]+/g, '');
    // Relative paths with extensions: ./file.ext or ../file.ext
    text = text.replace(/\.\.?\/[\w./\-]+/g, '');

    // Remove common path-like patterns (e.g., "src/components/Button")
    text = text.replace(/\b[\w\-]+\/[\w\-./]+\b/g, '');

    // Remove multiple spaces, tabs, and newlines
    text = text.replace(/\s+/g, ' ');

    // Remove leading/trailing whitespace
    text = text.trim();

    // Remove leading/trailing punctuation that doesn't add meaning
    text = text.replace(/^[^\w\s]+|[^\w\s?!]+$/g, '');

    return text;
  }

  /**
   * Remove common filler words from the beginning of the prompt
   *
   * @param text - Sanitized prompt text
   * @returns Text with filler words removed
   */
  private removeFillerWords(text: string): string {
    let result = text;
    const lowerText = text.toLowerCase();

    for (const filler of this.config.skipWords) {
      if (lowerText.startsWith(filler)) {
        result = text.substring(filler.length).trim();
        break;
      }
    }

    // Capitalize first letter after removing filler words
    if (result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    return result;
  }

  /**
   * Truncate text at a word boundary to avoid cutting words in half
   *
   * @param text - Text to truncate
   * @param maxLength - Maximum length of the result
   * @returns Truncated text with ellipsis if needed
   */
  private truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Find the last space before maxLength
    const truncatePoint = maxLength - 3; // Reserve 3 chars for '...'
    let lastSpace = text.lastIndexOf(' ', truncatePoint);

    // If no space found in reasonable range, fall back to character truncation
    if (lastSpace < truncatePoint - 20 || lastSpace === -1) {
      lastSpace = truncatePoint;
    }

    return text.substring(0, lastSpace).trim() + '...';
  }

  /**
   * Final validation and cleanup of the generated title
   *
   * @param title - Truncated title
   * @returns Finalized title
   */
  private finalizeTitle(title: string): string {
    // If title is empty or too short after processing, use fallback
    if (!title || title.length < 3) {
      return this.config.fallbackTitle;
    }

    // Remove trailing ellipsis if it's at the end and title is already short
    if (title.endsWith('...') && title.length < 20) {
      return title.substring(0, title.length - 3).trim();
    }

    return title;
  }

  /**
   * Ensure title is unique among existing titles by appending numeric suffix
   *
   * @param candidateTitle - The proposed title
   * @param existingTitles - Array of existing thread titles
   * @returns A unique title, with numeric suffix if needed (e.g., "Title (2)")
   *
   * @example
   * ensureUniqueTitle("My Thread", ["My Thread", "My Thread (2)"])
   * // Returns: "My Thread (3)"
   */
  public ensureUniqueTitle(candidateTitle: string, existingTitles: string[]): string {
    if (!existingTitles || existingTitles.length === 0) {
      return candidateTitle;
    }

    // Convert to lowercase for case-insensitive comparison
    const existing = existingTitles.map((t) => t.toLowerCase());
    let candidate = candidateTitle;
    let counter = 2;

    // Check if the candidate title already exists
    while (existing.includes(candidate.toLowerCase())) {
      // Extract base title if it already has a numeric suffix
      const match = candidateTitle.match(/^(.+?)\s*\((\d+)\)$/);
      if (match) {
        // Title already has a suffix, increment it
        const baseTitle = match[1].trim();
        candidate = `${baseTitle} (${counter})`;
      } else {
        // Add new suffix
        candidate = `${candidateTitle} (${counter})`;
      }
      counter++;

      // Safety check: prevent infinite loop
      if (counter > 1000) {
        log.warn('[TitleGeneratorService] Uniqueness check exceeded 1000 iterations');
        return `${candidateTitle} (${Date.now()})`;
      }
    }

    return candidate;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): TitleGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<TitleGeneratorConfig>): void {
    this.config = { ...this.config, ...updates };
    log.info('[TitleGeneratorService] Configuration updated:', this.config);
  }
}

/**
 * Singleton instance for global use
 */
export const titleGeneratorService = new TitleGeneratorService();
