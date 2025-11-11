/* eslint-disable security/detect-object-injection */
/**
 * FileTypeDetectorService
 *
 * Detects file types and categorizes them for preview vs download handling.
 * Supports images (JPG, PNG, GIF, WebP), PDFs, and various document types.
 */

export interface FileTypeInfo {
  mimeType: string;
  category: 'image' | 'pdf' | 'document' | 'text' | 'archive' | 'other';
  isPreviewable: boolean;
  canInlinePreview: boolean; // Small images can be inlined
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
];

const PDF_EXTENSIONS = ['.pdf'];
const PDF_MIMES = ['application/pdf'];

const DOCUMENT_EXTENSIONS = [
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
];
const DOCUMENT_MIMES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
];

const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.yaml', '.yml'];
const TEXT_MIMES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/xml',
  'application/xml',
  'text/csv',
  'text/yaml',
  'application/x-yaml',
];

const ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.gz', '.rar', '.7z'];
const ARCHIVE_MIMES = [
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

export class FileTypeDetectorService {
  /**
   * Detect file type from filename and optional MIME type
   */
  detectFileType(filename: string, mimeType?: string): FileTypeInfo {
    const extension = this.getExtension(filename);
    const detectedMime = mimeType || this.getMimeFromExtension(extension);

    // Determine category
    let category: FileTypeInfo['category'] = 'other';
    let isPreviewable = false;
    let canInlinePreview = false;

    if (this.isImage(extension, detectedMime)) {
      category = 'image';
      isPreviewable = true;
      canInlinePreview = true;
    } else if (this.isPDF(extension, detectedMime)) {
      category = 'pdf';
      isPreviewable = true;
      canInlinePreview = false; // PDFs open in modal
    } else if (this.isDocument(extension, detectedMime)) {
      category = 'document';
      isPreviewable = false;
    } else if (this.isText(extension, detectedMime)) {
      category = 'text';
      isPreviewable = false;
    } else if (this.isArchive(extension, detectedMime)) {
      category = 'archive';
      isPreviewable = false;
    }

    return {
      mimeType: detectedMime,
      category,
      isPreviewable,
      canInlinePreview,
    };
  }

  /**
   * Check if file is previewable (images and PDFs)
   */
  isPreviewable(filename: string, mimeType?: string): boolean {
    const info = this.detectFileType(filename, mimeType);
    return info.isPreviewable;
  }

  /**
   * Check if file should be downloaded only (not previewable)
   */
  isDownloadOnly(filename: string, mimeType?: string): boolean {
    return !this.isPreviewable(filename, mimeType);
  }

  /**
   * Check if file can be displayed inline (small images)
   */
  canInlinePreview(filename: string, fileSize: number, mimeType?: string): boolean {
    const info = this.detectFileType(filename, mimeType);
    // Only inline images under 500KB
    const MAX_INLINE_SIZE = 500 * 1024; // 500KB
    return info.canInlinePreview && fileSize <= MAX_INLINE_SIZE;
  }

  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase();
  }

  private getMimeFromExtension(extension: string): string {
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'text/xml',
      '.csv': 'text/csv',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };

    return mimeMap?.[extension] ?? 'application/octet-stream';
  }

  private isImage(extension: string, mimeType: string): boolean {
    return IMAGE_EXTENSIONS.includes(extension) || IMAGE_MIMES.includes(mimeType);
  }

  private isPDF(extension: string, mimeType: string): boolean {
    return PDF_EXTENSIONS.includes(extension) || PDF_MIMES.includes(mimeType);
  }

  private isDocument(extension: string, mimeType: string): boolean {
    return DOCUMENT_EXTENSIONS.includes(extension) || DOCUMENT_MIMES.includes(mimeType);
  }

  private isText(extension: string, mimeType: string): boolean {
    return TEXT_EXTENSIONS.includes(extension) || TEXT_MIMES.includes(mimeType);
  }

  private isArchive(extension: string, mimeType: string): boolean {
    return ARCHIVE_EXTENSIONS.includes(extension) || ARCHIVE_MIMES.includes(mimeType);
  }
}

// Singleton export
export const fileTypeDetectorService = new FileTypeDetectorService();
