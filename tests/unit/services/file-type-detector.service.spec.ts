/**
 * Unit tests for FileTypeDetectorService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FileTypeDetectorService,
  type FileTypeInfo,
} from '../../../src-electron/services/file-type-detector.service';

describe('FileTypeDetectorService', () => {
  let service: FileTypeDetectorService;

  beforeEach(() => {
    service = new FileTypeDetectorService();
  });

  describe('detectFileType', () => {
    describe('images', () => {
      it('should detect JPEG images', () => {
        const result = service.detectFileType('photo.jpg');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.isPreviewable).toBe(true);
        expect(result.canInlinePreview).toBe(true);
      });

      it('should detect PNG images', () => {
        const result = service.detectFileType('screenshot.png');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/png');
        expect(result.isPreviewable).toBe(true);
      });

      it('should detect GIF images', () => {
        const result = service.detectFileType('animation.gif');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/gif');
        expect(result.isPreviewable).toBe(true);
      });

      it('should detect WebP images', () => {
        const result = service.detectFileType('modern.webp');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/webp');
        expect(result.isPreviewable).toBe(true);
      });

      it('should detect SVG images', () => {
        const result = service.detectFileType('icon.svg');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/svg+xml');
        expect(result.isPreviewable).toBe(true);
      });
    });

    describe('PDFs', () => {
      it('should detect PDF files', () => {
        const result = service.detectFileType('document.pdf');

        expect(result.category).toBe('pdf');
        expect(result.mimeType).toBe('application/pdf');
        expect(result.isPreviewable).toBe(true);
        expect(result.canInlinePreview).toBe(false); // PDFs open in modal
      });
    });

    describe('documents', () => {
      it('should detect Word documents', () => {
        const docResult = service.detectFileType('report.doc');
        const docxResult = service.detectFileType('report.docx');

        expect(docResult.category).toBe('document');
        expect(docResult.isPreviewable).toBe(false);

        expect(docxResult.category).toBe('document');
        expect(docxResult.mimeType).toBe(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
      });

      it('should detect Excel spreadsheets', () => {
        const xlsResult = service.detectFileType('data.xls');
        const xlsxResult = service.detectFileType('data.xlsx');

        expect(xlsResult.category).toBe('document');
        expect(xlsxResult.category).toBe('document');
        expect(xlsResult.isPreviewable).toBe(false);
      });

      it('should detect PowerPoint presentations', () => {
        const pptResult = service.detectFileType('slides.ppt');
        const pptxResult = service.detectFileType('slides.pptx');

        expect(pptResult.category).toBe('document');
        expect(pptxResult.category).toBe('document');
        expect(pptResult.isPreviewable).toBe(false);
      });
    });

    describe('text files', () => {
      it('should detect plain text files', () => {
        const result = service.detectFileType('readme.txt');

        expect(result.category).toBe('text');
        expect(result.mimeType).toBe('text/plain');
        expect(result.isPreviewable).toBe(false);
      });

      it('should detect markdown files', () => {
        const result = service.detectFileType('README.md');

        expect(result.category).toBe('text');
        expect(result.mimeType).toBe('text/markdown');
      });

      it('should detect JSON files', () => {
        const result = service.detectFileType('config.json');

        expect(result.category).toBe('text');
        expect(result.mimeType).toBe('application/json');
      });

      it('should detect CSV files', () => {
        const result = service.detectFileType('data.csv');

        expect(result.category).toBe('text');
        expect(result.mimeType).toBe('text/csv');
      });
    });

    describe('archives', () => {
      it('should detect ZIP files', () => {
        const result = service.detectFileType('archive.zip');

        expect(result.category).toBe('archive');
        expect(result.mimeType).toBe('application/zip');
        expect(result.isPreviewable).toBe(false);
      });

      it('should detect TAR files', () => {
        const result = service.detectFileType('backup.tar');

        expect(result.category).toBe('archive');
        expect(result.mimeType).toBe('application/x-tar');
      });

      it('should detect GZIP files', () => {
        const result = service.detectFileType('compressed.gz');

        expect(result.category).toBe('archive');
        expect(result.mimeType).toBe('application/gzip');
      });
    });

    describe('with explicit MIME type', () => {
      it('should use provided MIME type when given', () => {
        const result = service.detectFileType('file.unknown', 'image/png');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/png');
        expect(result.isPreviewable).toBe(true);
      });

      it('should prioritize MIME type over extension', () => {
        // File with .txt extension but image MIME type
        const result = service.detectFileType('image.txt', 'image/jpeg');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/jpeg');
      });
    });

    describe('case insensitivity', () => {
      it('should handle uppercase extensions', () => {
        const result = service.detectFileType('PHOTO.JPG');

        expect(result.category).toBe('image');
        expect(result.mimeType).toBe('image/jpeg');
      });

      it('should handle mixed case extensions', () => {
        const result = service.detectFileType('Document.PdF');

        expect(result.category).toBe('pdf');
        expect(result.mimeType).toBe('application/pdf');
      });
    });

    describe('unknown types', () => {
      it('should handle unknown extensions', () => {
        const result = service.detectFileType('unknown.xyz');

        expect(result.category).toBe('other');
        expect(result.mimeType).toBe('application/octet-stream');
        expect(result.isPreviewable).toBe(false);
      });

      it('should handle files without extensions', () => {
        const result = service.detectFileType('Makefile');

        expect(result.category).toBe('other');
        expect(result.mimeType).toBe('application/octet-stream');
      });
    });
  });

  describe('isPreviewable', () => {
    it('should return true for images', () => {
      expect(service.isPreviewable('photo.jpg')).toBe(true);
      expect(service.isPreviewable('image.png')).toBe(true);
      expect(service.isPreviewable('animation.gif')).toBe(true);
    });

    it('should return true for PDFs', () => {
      expect(service.isPreviewable('document.pdf')).toBe(true);
    });

    it('should return false for documents', () => {
      expect(service.isPreviewable('report.docx')).toBe(false);
      expect(service.isPreviewable('spreadsheet.xlsx')).toBe(false);
    });

    it('should return false for archives', () => {
      expect(service.isPreviewable('archive.zip')).toBe(false);
    });

    it('should return false for text files', () => {
      expect(service.isPreviewable('readme.txt')).toBe(false);
    });
  });

  describe('isDownloadOnly', () => {
    it('should return false for previewable files', () => {
      expect(service.isDownloadOnly('photo.jpg')).toBe(false);
      expect(service.isDownloadOnly('document.pdf')).toBe(false);
    });

    it('should return true for non-previewable files', () => {
      expect(service.isDownloadOnly('report.docx')).toBe(true);
      expect(service.isDownloadOnly('archive.zip')).toBe(true);
      expect(service.isDownloadOnly('readme.txt')).toBe(true);
    });
  });

  describe('canInlinePreview', () => {
    const SMALL_SIZE = 100 * 1024; // 100KB
    const MEDIUM_SIZE = 500 * 1024; // 500KB
    const LARGE_SIZE = 1024 * 1024; // 1MB

    it('should return true for small images', () => {
      expect(service.canInlinePreview('photo.jpg', SMALL_SIZE)).toBe(true);
      expect(service.canInlinePreview('icon.png', SMALL_SIZE)).toBe(true);
    });

    it('should return true for images at exactly 500KB', () => {
      expect(service.canInlinePreview('photo.jpg', MEDIUM_SIZE)).toBe(true);
    });

    it('should return false for large images', () => {
      expect(service.canInlinePreview('photo.jpg', LARGE_SIZE)).toBe(false);
    });

    it('should return false for PDFs regardless of size', () => {
      expect(service.canInlinePreview('document.pdf', SMALL_SIZE)).toBe(false);
      expect(service.canInlinePreview('document.pdf', MEDIUM_SIZE)).toBe(false);
    });

    it('should return false for non-image files', () => {
      expect(service.canInlinePreview('document.docx', SMALL_SIZE)).toBe(false);
      expect(service.canInlinePreview('archive.zip', SMALL_SIZE)).toBe(false);
    });

    it('should use provided MIME type', () => {
      // File with generic name but image MIME type
      const result = service.canInlinePreview('file', SMALL_SIZE, 'image/png');
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle filenames with multiple dots', () => {
      const result = service.detectFileType('my.document.final.v2.pdf');

      expect(result.category).toBe('pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should handle filenames with paths', () => {
      const result = service.detectFileType('/path/to/file/image.jpg');

      expect(result.category).toBe('image');
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should handle empty filename', () => {
      const result = service.detectFileType('');

      expect(result.category).toBe('other');
      expect(result.mimeType).toBe('application/octet-stream');
    });

    it('should handle filename with only extension', () => {
      const result = service.detectFileType('.gitignore');

      expect(result.category).toBe('other');
    });
  });
});
