/**
 * Attachment types for file upload feature
 * Shared between main process and renderer
 */

export type UUID = string;

/**
 * Status of an attachment upload
 */
export type AttachmentStatus = 'uploading' | 'success' | 'failed';

/**
 * Attachment metadata stored in message.metadata.attachments
 */
export interface Attachment {
  /** Unique attachment ID (UUID) */
  id: UUID;

  /** Original filename */
  filename: string;

  /** MIME type (e.g., 'image/jpeg', 'application/pdf') */
  mimeType: string;

  /** File size in bytes */
  size: number;

  /** Upload timestamp */
  uploadedAt: number;

  /** Upload status */
  status: AttachmentStatus;

  /** Error message if upload failed */
  error?: string;

  /** Base64 encoded data (for inline images from API responses) */
  data?: string;

  /** Local file path (main process only, not serialized to renderer) */
  localPath?: string;

  /** File URL for renderer access (e.g., 'file://' protocol or blob URL) */
  url?: string;

  /** Thumbnail URL for images (optional) */
  thumbnailUrl?: string;
}

/**
 * Validation result for file uploads
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  code?: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_NAME' | 'INVALID_SIZE';
}

/**
 * Attachment payload for LLM providers (encoded)
 */
export interface AttachmentPayload {
  /** Original filename */
  filename: string;

  /** MIME type */
  mimeType: string;

  /** File data (Base64 for images, UTF-8 for text) */
  data: string;

  /** Encoding type */
  encoding: 'base64' | 'utf-8';

  /** File size in bytes */
  size: number;
}

/**
 * Comment on a response message
 */
export interface ResponseComment {
  /** Comment text content */
  content: string;

  /** When comment was created (epoch milliseconds) */
  createdAt: number;

  /** When comment was last edited (epoch milliseconds) */
  editedAt?: number;
}

/**
 * Extended metadata interface for messages with attachments
 */
export interface MessageMetadata {
  /** Attachments array */
  attachments?: Attachment[];

  /** Provider (e.g., 'ollama', 'anthropic') */
  provider?: string;

  /** Model (e.g., 'llama3:latest', 'claude-3-opus') */
  model?: string;

  /** First prompt (for thread creation) */
  _firstPrompt?: string;

  /** Single comment on this response */
  comment?: ResponseComment;

  /** Any other metadata */
  [key: string]: unknown;
}
