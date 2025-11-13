import type { Attachment } from '../../src-shared/types/attachment.types.js';
import log from 'electron-log';
import { fileStorageService } from './file-storage.service.js';

/**
 * Encoded attachment for provider consumption
 */
export interface EncodedAttachment {
  filename: string;
  mimeType: string;
  encoding: 'utf-8' | 'base64';
  content: string; // Either UTF-8 text or base64-encoded binary
}

/**
 * Service for encoding files for LLM providers
 * - Text files (txt, md, json, csv) → UTF-8 string
 * - Images (jpg, png, gif, webp) → Base64 string
 * - Documents (pdf) → Base64 string
 */
export class FileEncodingService {
  /**
   * Determine if a file should be encoded as text or binary
   */
  isTextFile(mimeType: string): boolean {
    const textMimeTypes = new Set([
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'text/html',
      'text/xml',
      'application/xml',
    ]);

    return textMimeTypes.has(mimeType) || mimeType.startsWith('text/');
  }

  /**
   * Determine if a file is an image that can be sent to vision models
   */
  isImage(mimeType: string): boolean {
    const imageMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]);

    return imageMimeTypes.has(mimeType);
  }

  /**
   * Encode a single attachment for provider consumption
   */
  async encodeAttachment(
    threadId: string,
    attachment: Attachment,
  ): Promise<EncodedAttachment | null> {
    try {
      log.info('[FileEncodingService] Encoding attachment', {
        threadId,
        fileId: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
      });

      // Get file from storage
      const fileBuffer = await fileStorageService.getFile(threadId, attachment.id);

      if (!fileBuffer) {
        log.warn('[FileEncodingService] File not found', {
          threadId,
          fileId: attachment.id,
        });
        return null;
      }

      // Determine encoding type
      if (this.isTextFile(attachment.mimeType)) {
        // Encode as UTF-8 text
        const content = fileBuffer.toString('utf-8');

        log.info('[FileEncodingService] Encoded as UTF-8', {
          fileId: attachment.id,
          contentLength: content.length,
        });

        return {
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          encoding: 'utf-8',
          content,
        };
      } else {
        // Encode as Base64 (images, PDFs, etc.)
        const content = fileBuffer.toString('base64');

        log.info('[FileEncodingService] Encoded as Base64', {
          fileId: attachment.id,
          contentLength: content.length,
        });

        return {
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          encoding: 'base64',
          content,
        };
      }
    } catch (error) {
      log.error('[FileEncodingService] Failed to encode attachment', {
        threadId,
        fileId: attachment.id,
        error,
      });
      return null;
    }
  }

  /**
   * Encode multiple attachments
   */
  async encodeAttachments(
    threadId: string,
    attachments: Attachment[],
  ): Promise<EncodedAttachment[]> {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    log.info('[FileEncodingService] Encoding multiple attachments', {
      threadId,
      count: attachments.length,
    });

    const encodedPromises = attachments.map((att) => this.encodeAttachment(threadId, att));
    const encoded = await Promise.all(encodedPromises);

    // Filter out nulls (failed encodings)
    const successful = encoded.filter((e): e is EncodedAttachment => e !== null);

    log.info('[FileEncodingService] Encoding complete', {
      threadId,
      total: attachments.length,
      successful: successful.length,
      failed: attachments.length - successful.length,
    });

    return successful;
  }

  /**
   * Format encoded attachment for OpenAI vision API
   */
  formatForOpenAI(encoded: EncodedAttachment): unknown {
    if (this.isImage(encoded.mimeType)) {
      return {
        type: 'image_url',
        image_url: {
          url: `data:${encoded.mimeType};base64,${encoded.content}`,
        },
      };
    } else if (encoded.encoding === 'utf-8') {
      return {
        type: 'text',
        text: `[File: ${encoded.filename}]\n${encoded.content}`,
      };
    } else {
      // For non-image binary files, include filename and indicate format
      return {
        type: 'text',
        text: `[File: ${encoded.filename} - base64 encoded]`,
      };
    }
  }

  /**
   * Format encoded attachment for Claude (Anthropic) API
   */
  formatForClaude(encoded: EncodedAttachment): unknown {
    if (this.isImage(encoded.mimeType)) {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: encoded.mimeType,
          data: encoded.content,
        },
      };
    } else if (encoded.encoding === 'utf-8') {
      return {
        type: 'text',
        text: `[File: ${encoded.filename}]\n${encoded.content}`,
      };
    } else {
      // For non-image binary files
      return {
        type: 'text',
        text: `[File: ${encoded.filename} - base64 encoded]`,
      };
    }
  }

  /**
   * Format encoded attachment for Ollama (vision models)
   */
  formatForOllama(encoded: EncodedAttachment): unknown {
    if (this.isImage(encoded.mimeType)) {
      // Ollama expects base64-encoded images in the images array
      return encoded.content; // Just the base64 string
    } else if (encoded.encoding === 'utf-8') {
      // Text files can be embedded in the message content
      return `[File: ${encoded.filename}]\n${encoded.content}`;
    } else {
      return `[File: ${encoded.filename} - binary file attached]`;
    }
  }

  /**
   * Get supported vision models for each provider
   */
  getSupportedVisionModels(): Record<string, string[]> {
    return {
      openai: ['gpt-4-vision-preview', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'],
      claude: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet'],
      ollama: ['llava', 'llava:13b', 'bakllava', 'llava-phi3', 'llava-llama3'],
    };
  }

  /**
   * Check if a model supports vision/images
   */
  supportsVision(providerType: string, model: string): boolean {
    const supportedModels = this.getSupportedVisionModels();
    const models = supportedModels[providerType.toLowerCase()] || [];

    return models.some((supportedModel) =>
      model.toLowerCase().includes(supportedModel.toLowerCase()),
    );
  }
}

// Singleton instance
export const fileEncodingService = new FileEncodingService();
