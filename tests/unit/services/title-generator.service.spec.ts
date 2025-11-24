import { describe, it, expect, beforeEach } from 'vitest';
import { TitleGeneratorService } from '../../../src-electron/services/title-generator.service';

describe('TitleGeneratorService', () => {
  let service: TitleGeneratorService;

  beforeEach(() => {
    service = new TitleGeneratorService();
  });

  describe('generateTitle', () => {
    it('should generate a title from a simple prompt', () => {
      const prompt = 'How do I create a React component?';
      const title = service.generateTitle(prompt);

      expect(title).toBe('How do I create a React component?');
    });

    it('should truncate long prompts at word boundary', () => {
      const prompt =
        'This is a very long prompt that exceeds the maximum length allowed for thread titles and should be truncated at a reasonable word boundary to ensure readability';
      const title = service.generateTitle(prompt);

      expect(title.length).toBeLessThanOrEqual(83); // 80 + '...'
      expect(title).toContain('...');
      expect(title).not.toMatch(/\s\.\.\.$/); // Should not end with space + ...
    });

    it('should remove URLs from prompts', () => {
      const prompt = 'Check out this website https://example.com for more info';
      const title = service.generateTitle(prompt);

      expect(title).not.toContain('https://');
      expect(title).not.toContain('example.com');
      expect(title).toContain('Check out this website');
    });

    it('should remove email addresses from prompts', () => {
      const prompt = 'Contact me at user@example.com for details';
      const title = service.generateTitle(prompt);

      expect(title).not.toContain('user@example.com');
      expect(title).toContain('Contact me');
    });

    it('should remove Unix file paths from prompts', () => {
      const prompt = 'Fix the bug in /home/user/project/src/index.ts please';
      const title = service.generateTitle(prompt);

      expect(title).not.toContain('/home/user');
      expect(title).not.toContain('/src/index.ts');
      expect(title).toContain('Fix the bug');
    });

    it('should remove Windows file paths from prompts', () => {
      const prompt = 'Update the file at C:\\Users\\Documents\\file.txt';
      const title = service.generateTitle(prompt);

      expect(title).not.toContain('C:\\');
      expect(title).not.toContain('Documents');
      expect(title).toContain('Update the file');
    });

    it('should remove relative file paths from prompts', () => {
      const prompt = 'Look at ./config/settings.json for the config';
      const title = service.generateTitle(prompt);

      expect(title).not.toContain('./config');
      expect(title).not.toContain('settings.json');
      expect(title).toContain('Look at');
    });

    it('should collapse multiple spaces into single spaces', () => {
      const prompt = 'How    do   I     fix    this    issue?';
      const title = service.generateTitle(prompt);

      expect(title).toBe('How do I fix this issue?');
      expect(title).not.toContain('  '); // No double spaces
    });

    it('should remove leading and trailing whitespace', () => {
      const prompt = '   How do I do this?   ';
      const title = service.generateTitle(prompt);

      expect(title).toBe('How do I do this?');
      expect(title).not.toMatch(/^\s/);
      expect(title).not.toMatch(/\s$/);
    });

    it('should remove common filler words from the beginning', () => {
      const fillerTests = [
        { prompt: 'Please help me with this', expected: 'Help me with this' },
        { prompt: 'Can you explain how this works?', expected: 'Explain how this works?' },
        { prompt: 'Could you show me examples?', expected: 'Show me examples?' },
        { prompt: 'Would you provide assistance?', expected: 'Provide assistance?' },
        { prompt: 'I want to learn Python', expected: 'To learn Python' }, // Case-sensitive: only lowercase "i want" matches
        { prompt: 'i want to learn Python', expected: 'To learn Python' }, // Lowercase matches
        { prompt: 'Help me debug this code', expected: 'Debug this code' }, // "help me" removed
      ];

      for (const test of fillerTests) {
        const title = service.generateTitle(test.prompt);
        expect(title).toBe(test.expected);
      }
    });

    it('should capitalize first letter after removing filler words', () => {
      const prompt = 'can you help me';
      const title = service.generateTitle(prompt);

      expect(title.charAt(0)).toBe(title.charAt(0).toUpperCase());
    });

    it('should return fallback for empty prompt', () => {
      const title = service.generateTitle('');
      expect(title).toBe('New Thread');
    });

    it('should return fallback for whitespace-only prompt', () => {
      const title = service.generateTitle('   \n\t   ');
      expect(title).toBe('New Thread');
    });

    it('should return fallback for invalid prompt types', () => {
      // @ts-expect-error Testing invalid input
      expect(service.generateTitle(null)).toBe('New Thread');
      // @ts-expect-error Testing invalid input
      expect(service.generateTitle(undefined)).toBe('New Thread');
      // @ts-expect-error Testing invalid input
      expect(service.generateTitle(123)).toBe('New Thread');
    });

    it('should return fallback when sanitization results in empty string', () => {
      const prompt = 'https://example.com';
      const title = service.generateTitle(prompt);

      expect(title).toBe('New Thread');
    });

    it('should handle prompts with only special characters gracefully', () => {
      const prompt = '!@#$%^&*()';
      const title = service.generateTitle(prompt);

      expect(title).toBeTruthy();
    });

    it('should preserve question marks and exclamation points', () => {
      expect(service.generateTitle('How do I do this?')).toContain('?');
      expect(service.generateTitle('This is amazing!')).toContain('!');
    });

    it('should handle mixed content correctly', () => {
      const prompt =
        'Can you help me understand https://docs.site.com/api and email results to user@test.com?';
      const title = service.generateTitle(prompt);

      expect(title).not.toContain('https://');
      expect(title).not.toContain('user@test.com');
      expect(title).toContain('understand');
      expect(title).toContain('email results');
    });

    it('should not break on Unicode characters', () => {
      const prompt = 'Comment créer une application? 如何创建应用?';
      const title = service.generateTitle(prompt);

      expect(title).toContain('Comment');
      expect(title).toContain('如何');
    });

    it('should generate titles quickly (performance test)', () => {
      const prompts = [
        'Simple prompt',
        'A much longer prompt that needs truncation because it exceeds the maximum allowed length',
        'Prompt with https://urls.com and emails@test.com',
      ];

      // Warm up to avoid initialization overhead
      service.generateTitle('warmup');

      // Test that each individual generation meets <1s NFR
      for (const prompt of prompts) {
        const start = performance.now();
        service.generateTitle(prompt);
        const duration = performance.now() - start;

        // Each title generation should be well under 1s requirement
        expect(duration).toBeLessThan(1000); // < 1s per title (NFR requirement)
      }
    });
  });

  describe('ensureUniqueTitle', () => {
    it('should return original title when no conflicts', () => {
      const title = service.ensureUniqueTitle('My Thread', ['Other Thread', 'Another Thread']);
      expect(title).toBe('My Thread');
    });

    it('should add (2) suffix when title exists', () => {
      const title = service.ensureUniqueTitle('My Thread', ['My Thread', 'Other Thread']);
      expect(title).toBe('My Thread (2)');
    });

    it('should add (3) suffix when (2) also exists', () => {
      const existing = ['My Thread', 'My Thread (2)', 'Other Thread'];
      const title = service.ensureUniqueTitle('My Thread', existing);
      expect(title).toBe('My Thread (3)');
    });

    it('should handle already numbered titles correctly', () => {
      const existing = ['My Thread', 'My Thread (2)'];
      const title = service.ensureUniqueTitle('My Thread (2)', existing);
      expect(title).toBe('My Thread (3)');
    });

    it('should be case-insensitive', () => {
      const title = service.ensureUniqueTitle('My Thread', ['my thread', 'MY THREAD']);
      expect(title).toBe('My Thread (2)');
    });

    it('should return original title for empty existing titles array', () => {
      const title = service.ensureUniqueTitle('My Thread', []);
      expect(title).toBe('My Thread');
    });

    it('should handle titles with numbers in the content', () => {
      const existing = ['Project 1', 'Project 2'];
      const title = service.ensureUniqueTitle('Project 1', existing);
      expect(title).toBe('Project 1 (2)');
    });

    it('should find next available number in sequence', () => {
      const existing = ['Thread', 'Thread (2)', 'Thread (3)', 'Thread (4)', 'Thread (5)'];
      const title = service.ensureUniqueTitle('Thread', existing);
      expect(title).toBe('Thread (6)');
    });

    it('should not exceed 1000 iterations (safety check)', () => {
      // Create a huge array to test the safety check
      const existing = Array(1001)
        .fill(0)
        .map((_, i) => (i === 0 ? 'Thread' : `Thread (${i + 1})`));

      const title = service.ensureUniqueTitle('Thread', existing);
      // Should return timestamp-based unique title
      expect(title).toMatch(/Thread \(\d+\)/);
    });
  });

  describe('configuration', () => {
    it('should allow custom max length', () => {
      const customService = new TitleGeneratorService({ maxLength: 50 });
      const longPrompt = 'A'.repeat(100);
      const title = customService.generateTitle(longPrompt);

      expect(title.length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    it('should allow custom fallback title', () => {
      const customService = new TitleGeneratorService({ fallbackTitle: 'Untitled' });
      const title = customService.generateTitle('');

      expect(title).toBe('Untitled');
    });

    it('should allow custom skip words', () => {
      const customService = new TitleGeneratorService({ skipWords: ['hello', 'hi'] });
      const title = customService.generateTitle('Hello world');

      expect(title).toBe('World');
    });

    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('maxLength');
      expect(config).toHaveProperty('minLength');
      expect(config).toHaveProperty('fallbackTitle');
      expect(config).toHaveProperty('skipWords');
    });

    it('should update configuration', () => {
      service.updateConfig({ maxLength: 100 });
      const config = service.getConfig();

      expect(config.maxLength).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle very short prompts', () => {
      expect(service.generateTitle('Hi')).toBeTruthy();
      expect(service.generateTitle('A')).toBeTruthy();
    });

    it('should handle prompts with only numbers', () => {
      const title = service.generateTitle('12345');
      expect(title).toBe('12345');
    });

    it('should handle prompts with emojis', () => {
      const title = service.generateTitle('How do I use 🚀 React?');
      expect(title).toContain('How do I use');
      expect(title).toContain('React');
    });

    it('should handle prompts with newlines and tabs', () => {
      const prompt = 'How\ndo\tI\n\nfix\tthis?';
      const title = service.generateTitle(prompt);

      expect(title).toBe('How do I fix this?');
    });
  });
});
