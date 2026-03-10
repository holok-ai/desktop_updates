/**
 * Frontend display types for the artifact editing system.
 */

/**
 * Enriched attachment data for rendering with Document Mode eligibility.
 * Built from the raw Attachment type but includes computed display flags.
 */
export interface AttachmentDisplay {
  /** Attachment UUID — used as fileId for artifact:activate */
  id: string;
  /** Display filename */
  filename: string;
  /** MIME type of the file */
  mimeType: string;
  /** Whether this file type supports Document Mode activation */
  isDocumentEligible: boolean;
}

/** MIME types eligible for Document Mode */
export const DOCUMENT_ELIGIBLE_MIME_TYPES = new Set([
  'text/markdown',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
]);

/** Check if a MIME type is eligible for Document Mode */
export function isDocumentEligible(mimeType: string): boolean {
  return DOCUMENT_ELIGIBLE_MIME_TYPES.has(mimeType);
}
