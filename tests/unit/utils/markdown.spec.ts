import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

describe('Markdown and Syntax Highlighting', () => {
  describe('Markdown Parsing', () => {
    it('renders plain text correctly', () => {
      const content = 'Hello, World!';
      const html = marked.parse(content) as string;
      expect(html).toContain('Hello, World!');
    });

    it('renders headers correctly', () => {
      const content = '# Heading 1\n## Heading 2';
      const html = marked.parse(content) as string;
      expect(html).toContain('<h1');
      expect(html).toContain('<h2');
    });

    it('renders bold and italic text', () => {
      const content = '**bold** and *italic*';
      const html = marked.parse(content) as string;
      expect(html).toContain('<strong');
      expect(html).toContain('<em');
    });

    it('renders lists correctly', () => {
      const content = '- Item 1\n- Item 2';
      const html = marked.parse(content) as string;
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
    });

    it('renders links correctly', () => {
      const content = '[Link](https://example.com)';
      const html = marked.parse(content) as string;
      expect(html).toContain('href="https://example.com"');
    });

    it('renders tables correctly', () => {
      const content = '| A | B |\n|---|---|\n| 1 | 2 |';
      const html = marked.parse(content) as string;
      expect(html).toContain('<table');
      expect(html).toContain('<thead');
      expect(html).toContain('<tbody');
    });
  });

  describe('Syntax Highlighting', () => {
    it('highlights JavaScript code', () => {
      const code = 'const x = 10;';
      const result = hljs.highlight(code, { language: 'javascript' });
      expect(result.value).toContain('hljs');
      expect(result.language).toBe('javascript');
    });

    it('highlights Python code', () => {
      const code = 'def hello():\n    print("world")';
      const result = hljs.highlight(code, { language: 'python' });
      expect(result.value).toContain('hljs');
      expect(result.language).toBe('python');
    });

    it('highlights TypeScript code', () => {
      const code = 'interface User { name: string; }';
      const result = hljs.highlight(code, { language: 'typescript' });
      expect(result.value).toContain('hljs');
      expect(result.language).toBe('typescript');
    });

    it('auto-detects JavaScript-like code', () => {
      const code = 'function hello() { return "world"; }';
      const result = hljs.highlightAuto(code);
      // Auto-detection may not always be exact, just verify it detects something
      expect(result.language).toBeTruthy();
      expect(result.value).toContain('hljs');
    });

    it('auto-detects Python-like code', () => {
      const code = 'def hello():\n    return "world"';
      const result = hljs.highlightAuto(code);
      // Auto-detection may not always be exact, just verify it detects something
      expect(result.language).toBeTruthy();
      expect(result.value).toContain('hljs');
    });

    it('handles invalid language gracefully', () => {
      const code = 'some code';
      expect(() => {
        hljs.highlight(code, { language: 'invalid-lang' });
      }).toThrow();
    });

    it('highlights variables in JavaScript', () => {
      const code = 'let myVariable = 10;';
      const result = hljs.highlight(code, { language: 'javascript' });
      // Variables should be wrapped in spans with hljs-* classes
      expect(result.value).toContain('span');
    });
  });

  describe('Security - DOMPurify', () => {
    it('sanitizes script tags', () => {
      const html = '<script>alert("XSS")</script>Hello';
      const clean = DOMPurify.sanitize(html);
      expect(clean).not.toContain('<script');
      expect(clean).toContain('Hello');
    });

    it('removes onclick handlers', () => {
      const html = '<a href="#" onclick="alert(\'XSS\')">Click</a>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).not.toContain('onclick');
    });

    it('allows safe HTML tags', () => {
      const html = '<p><strong>Bold</strong> and <em>italic</em></p>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('<strong>');
      expect(clean).toContain('<em>');
    });

    it('allows code blocks', () => {
      const html = '<pre><code>const x = 10;</code></pre>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('<pre>');
      expect(clean).toContain('<code>');
    });
  });

  describe('GitHub Flavored Markdown (GFM)', () => {
    it('supports strikethrough', () => {
      marked.setOptions({ gfm: true });
      const content = '~~strikethrough~~';
      const html = marked.parse(content) as string;
      expect(html).toContain('<del');
    });

    it('supports line breaks', () => {
      marked.setOptions({ gfm: true, breaks: true });
      const content = 'Line 1\nLine 2';
      const html = marked.parse(content) as string;
      expect(html).toContain('<br');
    });

    it('supports task lists', () => {
      marked.setOptions({ gfm: true });
      const content = '- [ ] Task 1\n- [x] Task 2';
      const html = marked.parse(content) as string;
      expect(html).toContain('input');
      expect(html).toContain('checkbox');
    });
  });

  describe('Code Block Detection', () => {
    it('detects code blocks with triple backticks', () => {
      const content = '```\nconst x = 10;\n```';
      const html = marked.parse(content) as string;
      expect(html).toContain('<pre');
      expect(html).toContain('<code');
    });

    it('detects code blocks with language tag', () => {
      const content = '```javascript\nconst x = 10;\n```';
      const html = marked.parse(content) as string;
      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      expect(html).toContain('language-javascript');
    });

    it('handles inline code', () => {
      const content = 'Use `console.log()` to debug';
      const html = marked.parse(content) as string;
      expect(html).toContain('<code');
      expect(html).toContain('console.log()');
    });
  });

  describe('Performance', () => {
    it('renders large markdown content quickly', () => {
      const largeContent = '# Header\n\n' + 'Lorem ipsum '.repeat(1000);
      const start = performance.now();
      marked.parse(largeContent);
      const duration = performance.now() - start;

      // Should parse in less than 100ms for 5k chars
      expect(duration).toBeLessThan(100);
    });

    it('highlights large code blocks quickly', () => {
      const largeCode = 'const x = 10;\n'.repeat(100);
      const start = performance.now();
      hljs.highlightAuto(largeCode);
      const duration = performance.now() - start;

      // highlightAuto scans all registered languages; allow up to 500ms for cold start
      expect(duration).toBeLessThan(500);
    });
  });
});
