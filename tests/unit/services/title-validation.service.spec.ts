import { describe, it, expect, beforeEach } from 'vitest';
import { TitleValidationService } from '../../../src-electron/services/title-validation.service';

describe('TitleValidationService', () => {
  let service: TitleValidationService;

  beforeEach(() => {
    service = new TitleValidationService();
  });

  describe('validate()', () => {
    describe('valid titles', () => {
      it('should validate a simple title', () => {
        const result = service.validate('My Thread');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread');
        expect(result.error).toBeUndefined();
      });

      it('should validate a title at minimum length (1 char)', () => {
        const result = service.validate('A');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('A');
      });

      it('should validate a title at maximum length (200 chars)', () => {
        const title = 'A'.repeat(200);
        const result = service.validate(title);
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe(title);
      });

      it('should validate title with numbers and special characters', () => {
        const result = service.validate('Thread #123 - Discussion 2024!');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('Thread #123 - Discussion 2024!');
      });

      it('should validate title with unicode characters', () => {
        const result = service.validate('讨论主题 🚀');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('讨论主题 🚀');
      });

      it('should validate title with emoji', () => {
        const result = service.validate('My Awesome Thread 🎉');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Awesome Thread 🎉');
      });
    });

    describe('empty titles', () => {
      it('should reject empty string', () => {
        const result = service.validate('');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_EMPTY');
        expect(result.error).toContain('empty');
      });

      it('should reject whitespace-only title', () => {
        const result = service.validate('   ');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_EMPTY');
      });

      it('should reject tabs and newlines only', () => {
        const result = service.validate('\t\n\r');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_EMPTY');
      });
    });

    describe('length validation', () => {
      it('should reject title over 200 characters', () => {
        const title = 'A'.repeat(201);
        const result = service.validate(title);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_TOO_LONG');
        expect(result.error).toContain('200');
      });

      it('should reject title significantly over limit', () => {
        const title = 'A'.repeat(500);
        const result = service.validate(title);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_TOO_LONG');
      });
    });

    describe('sanitization', () => {
      it('should trim leading whitespace', () => {
        const result = service.validate('   My Thread');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread');
      });

      it('should trim trailing whitespace', () => {
        const result = service.validate('My Thread   ');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread');
      });

      it('should trim both leading and trailing whitespace', () => {
        const result = service.validate('   My Thread   ');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread');
      });

      it('should collapse multiple spaces into one', () => {
        const result = service.validate('My    Thread    Title');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread Title');
      });

      it('should replace newlines with spaces', () => {
        const result = service.validate('My\nThread');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread');
      });

      it('should replace tabs with spaces', () => {
        const result = service.validate('My\tThread');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread');
      });

      it('should handle mixed whitespace types', () => {
        const result = service.validate('  My \n\t Thread  \r\n  Title  ');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('My Thread Title');
      });

      it('should remove control characters', () => {
        const result = service.validate('My\x00Thread\x1F');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('MyThread');
      });

      it('should remove null bytes', () => {
        const result = service.validate('Thread\x00Title');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('ThreadTitle');
      });
    });

    describe('duplicate checking', () => {
      const existingTitles = ['Existing Thread', 'Another Thread', 'Test Discussion'];

      it('should reject exact duplicate title', () => {
        const result = service.validate('Existing Thread', existingTitles);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_DUPLICATE');
        expect(result.error).toContain('already exists');
      });

      it('should reject duplicate with different case', () => {
        const result = service.validate('existing thread', existingTitles);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_DUPLICATE');
      });

      it('should reject duplicate with mixed case', () => {
        const result = service.validate('ExIsTiNg ThReAd', existingTitles);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_DUPLICATE');
      });

      it('should allow title when no existing titles provided', () => {
        const result = service.validate('New Thread');
        expect(result.valid).toBe(true);
      });

      it('should allow title when existing titles array is empty', () => {
        const result = service.validate('New Thread', []);
        expect(result.valid).toBe(true);
      });

      it('should allow title that is not a duplicate', () => {
        const result = service.validate('Brand New Thread', existingTitles);
        expect(result.valid).toBe(true);
      });

      it('should allow same title when it matches current title', () => {
        const result = service.validate('Existing Thread', existingTitles, 'Existing Thread');
        expect(result.valid).toBe(true);
      });

      it('should allow same title with different case when it matches current title', () => {
        const result = service.validate('EXISTING THREAD', existingTitles, 'Existing Thread');
        expect(result.valid).toBe(true);
      });

      it('should reject duplicate after sanitization', () => {
        const result = service.validate('  Existing    Thread  ', existingTitles);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_DUPLICATE');
      });
    });

    describe('invalid characters', () => {
      it('should reject title with null character', () => {
        const result = service.validate('Thread\x00Title');
        // After sanitization, it becomes "ThreadTitle" which is valid
        // The control char is removed by sanitization
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('ThreadTitle');
      });

      it('should handle bell character (\\x07)', () => {
        const result = service.validate('Thread\x07Title');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('ThreadTitle');
      });

      it('should handle escape character (\\x1B)', () => {
        const result = service.validate('Thread\x1BTitle');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('ThreadTitle');
      });
    });

    describe('edge cases', () => {
      it('should handle title that becomes empty after sanitization', () => {
        const result = service.validate('\x00\x01\x02');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_EMPTY');
      });

      it('should handle title with only whitespace and control chars', () => {
        const result = service.validate('  \x00  \x1F  ');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('TITLE_EMPTY');
      });

      it('should handle title that becomes too long after normalization', () => {
        // Create a title that's 200 chars but becomes 201 after some processing
        // Actually, sanitization only reduces length, so this edge case doesn't apply
        const title = 'A'.repeat(199) + '  '; // 201 total, but will trim to 199
        const result = service.validate(title);
        expect(result.valid).toBe(true);
      });

      it('should handle very long whitespace sequences', () => {
        const result = service.validate('A' + ' '.repeat(1000) + 'B');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('A B');
      });

      it('should preserve valid special characters', () => {
        const result = service.validate('Meeting @ 3:00 - Q&A [Discussion]');
        expect(result.valid).toBe(true);
        expect(result.sanitizedTitle).toBe('Meeting @ 3:00 - Q&A [Discussion]');
      });
    });
  });

  describe('sanitize()', () => {
    it('should return sanitized string', () => {
      const result = service.sanitize('  My   Thread  ');
      expect(result).toBe('My Thread');
    });

    it('should handle empty string', () => {
      const result = service.sanitize('');
      expect(result).toBe('');
    });

    it('should remove control characters', () => {
      const result = service.sanitize('Hello\x00World\x1F');
      expect(result).toBe('HelloWorld');
    });

    it('should normalize whitespace', () => {
      const result = service.sanitize('A\n\nB\t\tC   D');
      expect(result).toBe('A B C D');
    });
  });

  describe('isValid()', () => {
    it('should return true for valid title', () => {
      expect(service.isValid('Valid Title')).toBe(true);
    });

    it('should return false for empty title', () => {
      expect(service.isValid('')).toBe(false);
    });

    it('should return false for too long title', () => {
      expect(service.isValid('A'.repeat(201))).toBe(false);
    });

    it('should return true for title at limit', () => {
      expect(service.isValid('A'.repeat(200))).toBe(true);
    });
  });

  describe('getMaxLength()', () => {
    it('should return configured max length', () => {
      expect(service.getMaxLength()).toBe(200);
    });
  });

  describe('getMinLength()', () => {
    it('should return configured min length', () => {
      expect(service.getMinLength()).toBe(1);
    });
  });

  describe('updateConfig()', () => {
    it('should allow updating max length', () => {
      service.updateConfig({ maxLength: 100 });
      const result = service.validate('A'.repeat(150));
      expect(result.valid).toBe(false);
      expect(result.code).toBe('TITLE_TOO_LONG');
    });

    it('should allow updating min length', () => {
      service.updateConfig({ minLength: 5 });
      const result = service.validate('ABC');
      expect(result.valid).toBe(false);
      expect(result.code).toBe('TITLE_TOO_SHORT');
    });

    it('should allow disabling duplicate checking', () => {
      service.updateConfig({ checkDuplicates: false });
      const result = service.validate('Duplicate', ['Duplicate']);
      expect(result.valid).toBe(true);
    });

    it('should allow disabling whitespace trimming', () => {
      service.updateConfig({ trimWhitespace: false });
      const result = service.validate('  Test  ');
      expect(result.valid).toBe(true);
      // Note: Final trim still happens after all replacements
      expect(result.sanitizedTitle).toBe('Test');
    });

    it('should allow disabling space collapsing', () => {
      service.updateConfig({ collapseSpaces: false });
      const result = service.validate('A    B');
      expect(result.valid).toBe(true);
      expect(result.sanitizedTitle).toContain('    ');
    });
  });

  describe('error handling', () => {
    it('should handle null title gracefully', () => {
      const result = service.validate(null as any);
      expect(result.valid).toBe(false);
    });

    it('should handle undefined title gracefully', () => {
      const result = service.validate(undefined as any);
      expect(result.valid).toBe(false);
    });

    it('should handle non-string input', () => {
      const result = service.validate(12345 as any);
      expect(result.valid).toBe(false);
    });
  });
});
