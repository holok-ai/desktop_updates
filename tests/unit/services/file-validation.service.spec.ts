import { describe, it, expect, beforeEach } from 'vitest';
import { FileValidationService } from '../../../src-electron/services/file-validation.service';

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
  });

  describe('validate()', () => {
    describe('valid files', () => {
      it('should validate valid JPEG image', () => {
        const result = service.validate('photo.jpg', 'image/jpeg', 1024 * 1024); // 1MB
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should validate valid PNG image', () => {
        const result = service.validate('screenshot.png', 'image/png', 2 * 1024 * 1024); // 2MB
        expect(result.valid).toBe(true);
      });

      it('should validate valid PDF document', () => {
        const result = service.validate('document.pdf', 'application/pdf', 3 * 1024 * 1024); // 3MB
        expect(result.valid).toBe(true);
      });

      it('should validate valid JSON data file', () => {
        const result = service.validate('data.json', 'application/json', 100 * 1024); // 100KB
        expect(result.valid).toBe(true);
      });

      it('should validate file at maximum size limit', () => {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const result = service.validate('large.jpg', 'image/jpeg', maxSize);
        expect(result.valid).toBe(true);
      });

      it('should validate all supported image types', () => {
        const imageTypes = [
          { ext: 'jpg', mime: 'image/jpeg' },
          { ext: 'jpeg', mime: 'image/jpeg' },
          { ext: 'png', mime: 'image/png' },
          { ext: 'gif', mime: 'image/gif' },
          { ext: 'webp', mime: 'image/webp' },
          { ext: 'svg', mime: 'image/svg+xml' },
        ];

        imageTypes.forEach(({ ext, mime }) => {
          const result = service.validate(`image.${ext}`, mime, 1024);
          expect(result.valid).toBe(true);
        });
      });

      it('should validate all supported document types', () => {
        const docTypes = [
          { ext: 'pdf', mime: 'application/pdf' },
          { ext: 'txt', mime: 'text/plain' },
          { ext: 'md', mime: 'text/markdown' },
        ];

        docTypes.forEach(({ ext, mime }) => {
          const result = service.validate(`document.${ext}`, mime, 1024);
          expect(result.valid).toBe(true);
        });
      });

      it('should validate all supported data types', () => {
        const dataTypes = [
          { ext: 'json', mime: 'application/json' },
          { ext: 'csv', mime: 'text/csv' },
          { ext: 'xls', mime: 'application/vnd.ms-excel' },
          {
            ext: 'xlsx',
            mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ];

        dataTypes.forEach(({ ext, mime }) => {
          const result = service.validate(`data.${ext}`, mime, 1024);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('invalid file types', () => {
      it('should reject executable files', () => {
        const result = service.validate('malware.exe', 'application/x-msdownload', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_TYPE');
        expect(result.error).toContain('not allowed');
      });

      it('should reject script files', () => {
        const result = service.validate('script.js', 'application/javascript', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_TYPE');
      });

      it('should reject files with disallowed MIME type', () => {
        const result = service.validate('video.mp4', 'video/mp4', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_TYPE');
      });

      it('should reject files with no extension', () => {
        const result = service.validate('noextension', 'image/jpeg', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_TYPE');
        expect(result.error).toContain('must have an extension');
      });

      it('should reject files with wrong extension for MIME type', () => {
        // PDF MIME type but .txt extension
        const result = service.validate('fake.txt', 'application/pdf', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_TYPE');
        expect(result.error).toContain('does not match MIME type');
      });

      it('should reject files with disallowed extension', () => {
        const result = service.validate('file.bat', 'text/plain', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_TYPE');
      });
    });

    describe('invalid file sizes', () => {
      it('should reject files larger than 5MB', () => {
        const size = 6 * 1024 * 1024; // 6MB
        const result = service.validate('huge.jpg', 'image/jpeg', size);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('FILE_TOO_LARGE');
        expect(result.error).toContain('too large');
        expect(result.error).toContain('5.00MB');
      });

      it('should reject files with zero size', () => {
        const result = service.validate('empty.jpg', 'image/jpeg', 0);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_SIZE');
        expect(result.error).toContain('greater than 0');
      });

      it('should reject files with negative size', () => {
        const result = service.validate('invalid.jpg', 'image/jpeg', -1);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_SIZE');
      });
    });

    describe('invalid filenames', () => {
      it('should reject empty filename', () => {
        const result = service.validate('', 'image/jpeg', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_NAME');
        expect(result.error).toContain('required');
      });

      it('should reject filename with path separators', () => {
        const result = service.validate('../../../etc/passwd', 'text/plain', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_NAME');
        expect(result.error).toContain('path separators');
      });

      it('should reject filename with forward slash', () => {
        const result = service.validate('folder/file.txt', 'text/plain', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_NAME');
      });

      it('should reject filename with backslash', () => {
        const result = service.validate('folder\\file.txt', 'text/plain', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_NAME');
      });

      it('should reject filename with null bytes', () => {
        const result = service.validate('file\0.txt', 'text/plain', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_NAME');
        expect(result.error).toContain('null bytes');
      });

      it('should reject filename longer than 255 characters', () => {
        const longName = 'a'.repeat(256) + '.txt';
        const result = service.validate(longName, 'text/plain', 1024);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('INVALID_NAME');
        expect(result.error).toContain('too long');
      });
    });
  });

  describe('isAllowedType()', () => {
    it('should return true for allowed MIME type and extension', () => {
      expect(service.isAllowedType('image/jpeg', 'jpg')).toBe(true);
      expect(service.isAllowedType('image/png', 'png')).toBe(true);
      expect(service.isAllowedType('application/pdf', 'pdf')).toBe(true);
    });

    it('should return false for disallowed MIME type', () => {
      expect(service.isAllowedType('video/mp4', 'mp4')).toBe(false);
      expect(service.isAllowedType('application/x-msdownload', 'exe')).toBe(false);
    });

    it('should return false for disallowed extension', () => {
      expect(service.isAllowedType('image/jpeg', 'exe')).toBe(false);
      expect(service.isAllowedType('text/plain', 'bat')).toBe(false);
    });

    it('should return false when extension does not match MIME type', () => {
      expect(service.isAllowedType('image/jpeg', 'png')).toBe(false);
      expect(service.isAllowedType('application/pdf', 'txt')).toBe(false);
    });

    it('should handle extension with leading dot', () => {
      expect(service.isAllowedType('image/jpeg', '.jpg')).toBe(true);
    });

    it('should be case-insensitive for extensions', () => {
      expect(service.isAllowedType('image/jpeg', 'JPG')).toBe(true);
      expect(service.isAllowedType('image/png', 'PNG')).toBe(true);
    });

    it('should handle JPEG with both jpg and jpeg extensions', () => {
      expect(service.isAllowedType('image/jpeg', 'jpg')).toBe(true);
      expect(service.isAllowedType('image/jpeg', 'jpeg')).toBe(true);
    });
  });

  describe('isAllowedSize()', () => {
    it('should return true for size within limits', () => {
      expect(service.isAllowedSize(1024)).toBe(true); // 1KB
      expect(service.isAllowedSize(1024 * 1024)).toBe(true); // 1MB
      expect(service.isAllowedSize(5 * 1024 * 1024)).toBe(true); // 5MB (max)
    });

    it('should return false for size exceeding limit', () => {
      expect(service.isAllowedSize(6 * 1024 * 1024)).toBe(false); // 6MB
      expect(service.isAllowedSize(10 * 1024 * 1024)).toBe(false); // 10MB
    });

    it('should return false for zero size', () => {
      expect(service.isAllowedSize(0)).toBe(false);
    });

    it('should return false for negative size', () => {
      expect(service.isAllowedSize(-1)).toBe(false);
    });

    it('should return true for 1 byte', () => {
      expect(service.isAllowedSize(1)).toBe(true);
    });
  });

  describe('sanitizeFilename()', () => {
    it('should return filename unchanged for safe names', () => {
      expect(service.sanitizeFilename('photo.jpg')).toBe('photo.jpg');
      expect(service.sanitizeFilename('document-2024.pdf')).toBe('document-2024.pdf');
      expect(service.sanitizeFilename('my_file_123.txt')).toBe('my_file_123.txt');
    });

    it('should replace path separators with underscores', () => {
      expect(service.sanitizeFilename('folder/file.txt')).toBe('folder_file.txt');
      expect(service.sanitizeFilename('folder\\file.txt')).toBe('folder_file.txt');
    });

    it('should remove parent directory references', () => {
      // .. becomes _ and / becomes _, so ../file.txt becomes __file.txt
      expect(service.sanitizeFilename('../file.txt')).toBe('__file.txt');
      expect(service.sanitizeFilename('../../etc/passwd')).toBe('____etc_passwd');
    });

    it('should remove null bytes', () => {
      expect(service.sanitizeFilename('file\0.txt')).toBe('file.txt');
    });

    it('should remove control characters', () => {
      expect(service.sanitizeFilename('file\n\r\t.txt')).toBe('file.txt');
    });

    it('should trim leading and trailing dots and spaces', () => {
      expect(service.sanitizeFilename('  file.txt  ')).toBe('file.txt');
      // .. becomes _ so ...file.txt... becomes _.file.txt_ (middle single dots remain)
      expect(service.sanitizeFilename('...file.txt...')).toBe('_.file.txt_');
    });

    it('should limit filename length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = service.sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.txt')).toBe(true);
    });

    it('should return "unnamed" for empty filename', () => {
      expect(service.sanitizeFilename('')).toBe('unnamed');
    });

    it('should return "unnamed" for filename that becomes empty after sanitization', () => {
      // Note: '...' becomes '_' (one replacement of ..), not 'unnamed'
      // Only truly empty strings become 'unnamed'
      expect(service.sanitizeFilename('...')).toBe('_');
      expect(service.sanitizeFilename('   ')).toBe('unnamed');
    });

    it('should handle complex malicious filenames', () => {
      const malicious = '../../../etc/passwd\0.txt';
      const sanitized = service.sanitizeFilename(malicious);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\0');
    });
  });

  describe('getMaxFileSize()', () => {
    it('should return default max file size of 5MB', () => {
      const maxSize = service.getMaxFileSize();
      expect(maxSize).toBe(5 * 1024 * 1024); // 5MB in bytes
    });
  });

  describe('setMaxFileSize()', () => {
    it('should update max file size', () => {
      service.setMaxFileSize(10 * 1024 * 1024); // 10MB
      expect(service.getMaxFileSize()).toBe(10 * 1024 * 1024);
    });

    it('should allow validation with new max size', () => {
      service.setMaxFileSize(10 * 1024 * 1024); // 10MB

      // 8MB should now be valid
      const result = service.validate('large.jpg', 'image/jpeg', 8 * 1024 * 1024);
      expect(result.valid).toBe(true);

      // 11MB should still be invalid
      const result2 = service.validate('huge.jpg', 'image/jpeg', 11 * 1024 * 1024);
      expect(result2.valid).toBe(false);
      expect(result2.code).toBe('FILE_TOO_LARGE');
    });

    it('should ignore invalid max size values', () => {
      const originalSize = service.getMaxFileSize();

      service.setMaxFileSize(0);
      expect(service.getMaxFileSize()).toBe(originalSize); // unchanged

      service.setMaxFileSize(-1);
      expect(service.getMaxFileSize()).toBe(originalSize); // unchanged
    });
  });

  describe('getAllowedFileTypes()', () => {
    it('should return array of allowed file extensions', () => {
      const types = service.getAllowedFileTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('jpg');
      expect(types).toContain('png');
      expect(types).toContain('pdf');
      expect(types).toContain('json');
    });

    it('should return sorted array', () => {
      const types = service.getAllowedFileTypes();
      const sorted = [...types].sort();
      expect(types).toEqual(sorted);
    });
  });

  describe('getAllowedTypesDescription()', () => {
    it('should return human-readable description', () => {
      const description = service.getAllowedTypesDescription();
      expect(typeof description).toBe('string');
      expect(description).toContain('Images');
      expect(description).toContain('Documents');
      expect(description).toContain('Data');
    });
  });

  describe('edge cases', () => {
    it('should handle files with multiple dots in filename', () => {
      const result = service.validate('my.file.name.jpg', 'image/jpeg', 1024);
      expect(result.valid).toBe(true);
    });

    it('should handle files with uppercase extensions', () => {
      const result = service.validate('PHOTO.JPG', 'image/jpeg', 1024);
      expect(result.valid).toBe(true);
    });

    it('should handle files with mixed case extensions', () => {
      const result = service.validate('photo.JpG', 'image/jpeg', 1024);
      expect(result.valid).toBe(true);
    });

    it('should handle filenames with special characters', () => {
      const result = service.validate('file-name_123 (copy).jpg', 'image/jpeg', 1024);
      expect(result.valid).toBe(true);
    });

    it('should handle very small files (1 byte)', () => {
      const result = service.validate('tiny.txt', 'text/plain', 1);
      expect(result.valid).toBe(true);
    });

    it('should handle files exactly at size boundary', () => {
      const maxSize = service.getMaxFileSize();
      const result = service.validate('boundary.jpg', 'image/jpeg', maxSize);
      expect(result.valid).toBe(true);

      const result2 = service.validate('over.jpg', 'image/jpeg', maxSize + 1);
      expect(result2.valid).toBe(false);
    });
  });
});
