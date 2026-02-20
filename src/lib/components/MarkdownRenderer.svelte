<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import hljs from 'highlight.js/lib/core';
  // Import only the languages we actually use
  import python from 'highlight.js/lib/languages/python';
  import javascript from 'highlight.js/lib/languages/javascript';
  import typescript from 'highlight.js/lib/languages/typescript';
  import java from 'highlight.js/lib/languages/java';
  import csharp from 'highlight.js/lib/languages/csharp';
  import cpp from 'highlight.js/lib/languages/cpp';
  import c from 'highlight.js/lib/languages/c';
  import php from 'highlight.js/lib/languages/php';
  import ruby from 'highlight.js/lib/languages/ruby';
  import go from 'highlight.js/lib/languages/go';
  import rust from 'highlight.js/lib/languages/rust';
  import swift from 'highlight.js/lib/languages/swift';
  import kotlin from 'highlight.js/lib/languages/kotlin';
  import scala from 'highlight.js/lib/languages/scala';
  import xml from 'highlight.js/lib/languages/xml'; // for html and xml
  import css from 'highlight.js/lib/languages/css';
  import sql from 'highlight.js/lib/languages/sql';
  import bash from 'highlight.js/lib/languages/bash';
  import powershell from 'highlight.js/lib/languages/powershell';
  import json from 'highlight.js/lib/languages/json';
  import yaml from 'highlight.js/lib/languages/yaml';
  import markdown from 'highlight.js/lib/languages/markdown';
  import plaintext from 'highlight.js/lib/languages/plaintext';
  import DOMPurify from 'dompurify';

  // Register only the languages we need
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('c', c);
  hljs.registerLanguage('php', php);
  hljs.registerLanguage('ruby', ruby);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('swift', swift);
  hljs.registerLanguage('kotlin', kotlin);
  hljs.registerLanguage('scala', scala);
  hljs.registerLanguage('html', xml);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('shell', bash);
  hljs.registerLanguage('powershell', powershell);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('plaintext', plaintext);
  hljs.registerLanguage('csv', plaintext); // CSV uses plaintext highlighting

  interface Props {
    content: string;
    enableCopy?: boolean;
    /** Font size in pixels from settings - caps maximum size for all elements */
    fontSize?: number;
  }

  let { content, enableCopy = true, fontSize = 14 }: Props = $props();
  let renderedHtml = $state('');
  let containerEl: HTMLDivElement;

  // Configure marked with custom renderer for code blocks
  function configureMarked() {
    const renderer = new marked.Renderer();

    // Common languages to consider for auto-detection (in priority order)
    const commonLanguages = [
      'python',
      'javascript',
      'typescript',
      'java',
      'csharp',
      'cpp',
      'c',
      'php',
      'ruby',
      'go',
      'rust',
      'swift',
      'kotlin',
      'scala',
      'html',
      'css',
      'sql',
      'bash',
      'shell',
      'powershell',
      'json',
      'yaml',
      'xml',
      'markdown',
    ];

    // Helper function to detect CSV content
    function looksLikeCSV(text: string): boolean {
      const lines = text.trim().split('\n');
      if (lines.length < 2) return false;

      // Check if most lines have consistent comma count
      const commaCounts = lines.map((line) => (line.match(/,/g) || []).length);
      if (commaCounts.length === 0) return false;

      const avgCommas = commaCounts.reduce((a, b) => a + b, 0) / commaCounts.length;
      const consistentCommas = commaCounts.filter(
        (count) => Math.abs(count - avgCommas) <= 1,
      ).length;

      // Additional checks for CSV patterns
      const _hasQuotes = text.includes('"') || text.includes("'");
      const hasConsistentStructure = consistentCommas / lines.length > 0.6;
      const hasEnoughCommas = avgCommas >= 1;

      // If >60% of lines have similar comma counts and avg >= 1 comma, likely CSV
      // Lower threshold to catch more CSV cases
      return hasConsistentStructure && hasEnoughCommas;
    }

    // Custom code block renderer with syntax highlighting and copy button
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const code = text;
      let language = lang;
      let highlighted = '';
      let detectedLang = language || '';
      let isInferred = false;

      // If no language specified and content looks like CSV, treat as CSV
      const autoDetectedAsCSV = !language && looksLikeCSV(code);
      if (autoDetectedAsCSV) {
        language = 'csv';
        isInferred = true;
      }

      if (language) {
        try {
          highlighted = hljs.highlight(code, { language }).value;
          detectedLang = language;
        } catch (e) {
          console.error('Highlight.js error:', e);
          // Fallback to auto-detect if specified language fails
          try {
            const result = hljs.highlightAuto(code, commonLanguages);
            highlighted = result.value;
            detectedLang = result.language || 'plaintext';
            isInferred = true;
          } catch (error) {
            console.error('Highlight.js auto-detect error:', error);
            highlighted = code;
            detectedLang = 'plaintext';
          }
        }
      } else {
        // No language specified — render as plaintext with no label
        try {
          highlighted = hljs.highlight(code, { language: 'plaintext' }).value;
        } catch {
          highlighted = code;
        }
        detectedLang = '';
      }

      const langBadge = detectedLang
        ? `<span class="code-lang ${isInferred ? 'inferred' : ''}" 
             ${isInferred ? `title="Language auto-detected as ${detectedLang}"` : ''}>
             ${detectedLang}${isInferred ? ' (auto)' : ''}
           </span>`
        : '';

      const copyBtn = enableCopy
        ? `<button class="copy-btn" data-code="${encodeURIComponent(code)}" 
             aria-label="Copy code to clipboard" title="Copy to clipboard">
             <span class="copy-icon">📋</span>
             <span class="copy-text">Copy</span>
           </button>`
        : '';

      return `
        <div class="code-block-wrapper">
          <div class="code-header">
            ${langBadge}
            ${copyBtn}
          </div>
          <pre><code class="hljs language-${detectedLang}">${highlighted}</code></pre>
        </div>
      `;
    };

    // Custom inline code renderer
    renderer.codespan = ({ text }: { text: string }) => {
      return `<code class="inline-code">${text}</code>`;
    };

    marked.setOptions({
      renderer,
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Line breaks become <br>
      pedantic: false,
    });
  }

  // Process security status messages
  function processStatusMessages(text: string): string {
    const hasValidation = /\[Validating request and running security checks\.\.\.\]/.test(text);
    const hasPassed = /\[Security checks passed, processing your request\.\.\.\]/.test(text);

    if (hasValidation && hasPassed) {
      // Both present: hide validation, show only green checkmark
      return text
        .replace(/\[Validating request and running security checks\.\.\.\]\n?/g, '')
        .replace(
          /\[Security checks passed, processing your request\.\.\.\]\n?/g,
          '<span class="status-success"><span class="checkmark">✓</span></span>',
        );
    } else if (hasValidation) {
      // Only validation: show spinner
      return text.replace(
        /\[Validating request and running security checks\.\.\.\]\n?/g,
        '<span class="status-spinner"><span class="spinner"></span> Validating request...</span>',
      );
    }

    return text;
  }

  // Process FileId tags and convert to appropriate display elements
  async function processFileIdTags(text: string): Promise<string> {
    // Match <FileId ... /> tags with flexible attribute order
    // Captures the entire tag content to parse attributes individually
    const fileIdRegex = /<FileId\s+([^>]+)\s*\/>/g;

    let processedText = text;
    const matches = Array.from(text.matchAll(fileIdRegex));

    if (matches.length > 0) {
      console.log('[MarkdownRenderer] Found FileId tags:', matches.length);
    }

    for (const match of matches) {
      const [fullMatch, attributes] = match;

      // Parse attributes flexibly
      const fileIdMatch = attributes.match(/file_id="([^"]+)"/);
      const threadIdMatch = attributes.match(/thread_id="([^"]+)"/);
      const mimeTypeMatch = attributes.match(/mime_type="([^"]+)"/);
      const fileNameMatch = attributes.match(/name="([^"]*)"/);

      if (!fileIdMatch || !mimeTypeMatch) {
        console.error('[MarkdownRenderer] FileId tag missing required attributes:', fullMatch);
        continue;
      }

      const fileId = fileIdMatch[1];
      const threadId = threadIdMatch ? threadIdMatch[1] : null;
      const mimeType = mimeTypeMatch[1];
      const fileName = fileNameMatch ? fileNameMatch[1] : 'file';

      console.log('[MarkdownRenderer] Processing FileId:', {
        fileId,
        threadId,
        mimeType,
        fileName,
      });

      try {
        // Fetch file from backend
        const result = await window.electronAPI.file.get({ threadId, fileId });

        if (result.success && result.buffer) {
          // Convert buffer to base64
          const base64 = btoa(
            new Uint8Array(result.buffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              '',
            ),
          );

          // Determine how to display based on mime type
          let replacement = '';

          if (mimeType.startsWith('image/')) {
            // Display as inline image
            replacement = `![${fileName}](data:${mimeType};base64,${base64})`;
          } else if (mimeType === 'application/pdf') {
            // Display as download link for PDF
            replacement = `<div class="file-download">
              <i class="pi pi-file-pdf"></i>
              <span class="file-download-name">${fileName}</span>
              <a href="data:application/pdf;base64,${base64}" download="${fileName}" class="file-download-btn">
                <i class="pi pi-download"></i> Download
              </a>
            </div>`;
          } else if (mimeType === 'text/plain') {
            // Display as code block
            const textContent = atob(base64);
            replacement = `\`\`\`\n${textContent}\n\`\`\``;
          } else if (
            mimeType ===
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ) {
            // Display as download link for Office documents
            const icon = mimeType.includes('word') ? 'pi-file-word' : 'pi-file-excel';
            replacement = `<div class="file-download">
              <i class="pi ${icon}"></i>
              <span class="file-download-name">${fileName}</span>
              <a href="data:${mimeType};base64,${base64}" download="${fileName}" class="file-download-btn">
                <i class="pi pi-download"></i> Download
              </a>
            </div>`;
          } else {
            // Generic file download
            replacement = `<div class="file-download">
              <i class="pi pi-file"></i>
              <span class="file-download-name">${fileName}</span>
              <a href="data:${mimeType};base64,${base64}" download="${fileName}" class="file-download-btn">
                <i class="pi pi-download"></i> Download
              </a>
            </div>`;
          }

          processedText = processedText.replace(fullMatch, replacement);
        } else {
          // File not found, show error
          processedText = processedText.replace(
            fullMatch,
            `<div class="file-error">
              <i class="pi pi-exclamation-triangle"></i>
              <span>File not found: ${fileName}</span>
            </div>`,
          );
        }
      } catch (error) {
        console.error('[MarkdownRenderer] Failed to process FileId tag:', error);
        processedText = processedText.replace(
          fullMatch,
          `<div class="file-error">
            <i class="pi pi-exclamation-triangle"></i>
            <span>Error loading file: ${fileName}</span>
          </div>`,
        );
      }
    }

    return processedText;
  }

  // Render markdown to HTML
  async function renderMarkdown(text: string): Promise<string> {
    try {
      // Process FileId tags first (async)
      let filteredText = await processFileIdTags(text);

      // Process security status messages
      filteredText = processStatusMessages(filteredText);

      configureMarked();
      const rawHtml = marked.parse(filteredText) as string;
      // Sanitize to prevent XSS while allowing necessary HTML
      return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'em',
          'u',
          's',
          'code',
          'pre',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'blockquote',
          'a',
          'img',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'div',
          'span',
          'button',
          'del',
          'ins',
          'i',
        ],
        ALLOWED_ATTR: [
          'href',
          'target',
          'rel',
          'src',
          'alt',
          'title',
          'class',
          'id',
          'data-code',
          'aria-label',
          'style', // For inline styles if needed
          'download', // For download links
        ],
      });
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return `<div class="markdown-error">
        <strong>⚠ Markdown Rendering Error</strong>
        <p>Failed to render markdown content. Displaying raw text:</p>
        <pre>${text}</pre>
      </div>`;
    }
  }

  // Copy code to clipboard
  function handleCopyClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const btn = target.closest('.copy-btn') as HTMLButtonElement;
    if (!btn) return;

    const encodedCode = btn.getAttribute('data-code');
    if (!encodedCode) return;

    const code = decodeURIComponent(encodedCode);

    navigator.clipboard.writeText(code).then(
      () => {
        // Success feedback
        const copyText = btn.querySelector('.copy-text');
        const copyIcon = btn.querySelector('.copy-icon');
        if (copyText) copyText.textContent = 'Copied!';
        if (copyIcon) copyIcon.textContent = '✓';
        btn.classList.add('copied');

        setTimeout(() => {
          if (copyText) copyText.textContent = 'Copy';
          if (copyIcon) copyIcon.textContent = '📋';
          btn.classList.remove('copied');
        }, 2000);
      },
      (err) => {
        console.error('Copy failed:', err);
        const copyText = btn.querySelector('.copy-text');
        if (copyText) copyText.textContent = 'Failed';
        setTimeout(() => {
          if (copyText) copyText.textContent = 'Copy';
        }, 2000);
      },
    );
  }

  // Add tooltips for variable hover
  let activeTooltip: HTMLDivElement | null = null;

  function showVariableTooltip(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      !target.classList.contains('hljs-variable') &&
      !target.classList.contains('hljs-template-variable')
    ) {
      return;
    }

    // Remove existing tooltip
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }

    const varName = target.textContent || '';
    const tooltip = document.createElement('div');
    tooltip.className = 'variable-tooltip';
    tooltip.textContent = `Variable: ${varName} (No definition found)`;

    // Position tooltip
    const rect = target.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = `${rect.bottom + 5}px`;
    tooltip.style.left = `${rect.left}px`;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    // Remove on mouse leave
    const removeTooltip = () => {
      if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
      }
      target.removeEventListener('mouseleave', removeTooltip);
    };
    target.addEventListener('mouseleave', removeTooltip);
  }

  // Update rendered HTML when content changes
  $effect(() => {
    void renderMarkdown(content).then((html) => {
      renderedHtml = html;
    });
  });

  // Attach copy button handlers after mount
  onMount(() => {
    return () => {
      // Cleanup if needed
    };
  });

  // Attach event listeners using event delegation
  $effect(() => {
    if (containerEl) {
      containerEl.addEventListener('click', handleCopyClick);
      containerEl.addEventListener('mouseover', showVariableTooltip);
      return () => {
        containerEl.removeEventListener('click', handleCopyClick);
        containerEl.removeEventListener('mouseover', showVariableTooltip);
        if (activeTooltip) {
          activeTooltip.remove();
          activeTooltip = null;
        }
      };
    }
  });
</script>

<!--
  Note: {@html} is safe here because renderedHtml is sanitized with DOMPurify
  in the renderMarkdown() function before rendering. This prevents XSS attacks
  while allowing necessary HTML formatting for markdown content.
-->
<div class="markdown-content" bind:this={containerEl} style="--max-font-size: {fontSize}px">
  {@html renderedHtml}
</div>

<style>
  .markdown-content {
    line-height: 1.6;
    word-wrap: break-word;
  }

  /* Headers - capped at max-font-size setting */
  .markdown-content :global(h1) {
    font-size: min(1.8rem, var(--max-font-size));
    font-weight: 700;
    margin: 1.5rem 0 1rem;
    border-bottom: 2px solid var(--border-sidebar, #ddd);
    padding-bottom: 0.3rem;
  }

  .markdown-content :global(h2) {
    font-size: min(1.5rem, var(--max-font-size));
    font-weight: 600;
    margin: 1.25rem 0 0.75rem;
    border-bottom: 1px solid var(--border-sidebar, #eee);
    padding-bottom: 0.25rem;
  }

  .markdown-content :global(h3) {
    font-size: min(1.3rem, var(--max-font-size));
    font-weight: 600;
    margin: 1rem 0 0.5rem;
  }

  .markdown-content :global(h4) {
    font-size: min(1.1rem, var(--max-font-size));
    font-weight: 600;
    margin: 0.75rem 0 0.5rem;
  }

  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    font-size: min(1rem, var(--max-font-size));
    font-weight: 600;
    margin: 0.5rem 0 0.25rem;
  }

  /* Paragraphs */
  .markdown-content :global(p) {
    margin: 0.75rem 0;
  }

  /* Links */
  .markdown-content :global(a) {
    color: var(--primary-color);
    text-decoration: underline;
    transition: color 0.2s;
  }

  .markdown-content :global(a:hover) {
    color: var(--syntax-function);
  }

  /* Lists */
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 2rem;
  }

  .markdown-content :global(li) {
    margin: 0.25rem 0;
  }

  .markdown-content :global(ul ul),
  .markdown-content :global(ol ol),
  .markdown-content :global(ul ol),
  .markdown-content :global(ol ul) {
    margin: 0.25rem 0;
  }

  /* Blockquotes */
  .markdown-content :global(blockquote) {
    border-left: 4px solid var(--primary-color);
    padding-left: 1rem;
    margin: 1rem 0;
    color: var(--text-secondary);
    font-style: italic;
    background: color-mix(in srgb, var(--primary-color) 5%, transparent);
    padding: 0.5rem 1rem;
    border-radius: 4px;
  }

  /* Inline code */
  .markdown-content :global(.inline-code) {
    background: color-mix(in srgb, var(--primary-color) 15%, transparent);
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 0.9em;
    color: var(--syntax-tag);
  }

  /* Code blocks wrapper */
  .markdown-content :global(.code-block-wrapper) {
    position: relative;
    margin: 1rem 0;
    border-radius: 6px;
    overflow: hidden;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
  }

  /* Code header */
  .markdown-content :global(.code-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: color-mix(in srgb, var(--text-primary) 5%, var(--surface-card));
    border-bottom: 1px solid var(--surface-border);
  }

  .markdown-content :global(.code-lang) {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
  }

  .markdown-content :global(.code-lang.inferred) {
    color: var(--syntax-string);
    font-style: italic;
  }

  /* Copy button */
  .markdown-content :global(.copy-btn) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    background: rgba(100, 108, 255, 0.15);
    color: var(--text-secondary);
    border: 1px solid rgba(100, 108, 255, 0.3);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .markdown-content :global(.copy-btn:hover) {
    background: rgba(100, 108, 255, 0.25);
    border-color: rgba(100, 108, 255, 0.5);
    color: var(--text-primary);
  }

  .markdown-content :global(.copy-btn:focus) {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .markdown-content :global(.copy-btn.copied) {
    background: color-mix(in srgb, var(--syntax-string) 20%, transparent);
    border-color: color-mix(in srgb, var(--syntax-string) 50%, transparent);
    color: var(--syntax-string);
  }

  .markdown-content :global(.copy-icon) {
    font-size: 1rem;
  }

  /* Code blocks */
  .markdown-content :global(pre) {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
    background: color-mix(in srgb, var(--text-primary) 3%, var(--surface-card));
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .markdown-content :global(pre code) {
    background: transparent;
    padding: 0;
    border-radius: 0;
    color: var(--text-primary);
    font-family: inherit;
  }

  /* Tables */
  .markdown-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
    border: 1px solid var(--border-sidebar, #ddd);
    border-radius: 6px;
    overflow: hidden;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-sidebar, #eee);
  }

  .markdown-content :global(th) {
    background: rgba(100, 108, 255, 0.1);
    font-weight: 600;
  }

  .markdown-content :global(tr:last-child td) {
    border-bottom: none;
  }

  /* Strikethrough */
  .markdown-content :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }

  /* Emphasis */
  .markdown-content :global(strong) {
    font-weight: 700;
  }

  .markdown-content :global(em) {
    font-style: italic;
  }

  /* Images */
  .markdown-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 0.5rem 0;
  }

  /* Error state */
  .markdown-content :global(.markdown-error) {
    background: var(--error-bg);
    border: 1px solid var(--error-color);
    border-radius: 6px;
    padding: 1rem;
    margin: 1rem 0;
  }

  .markdown-content :global(.markdown-error strong) {
    color: var(--error-color);
  }

  .markdown-content :global(.markdown-error pre) {
    background: var(--surface-card);
    padding: 0.5rem;
    border: 1px solid var(--border-sidebar);
    border-radius: 4px;
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .markdown-content :global(.code-block-wrapper) {
      border-width: 2px;
    }

    .markdown-content :global(a) {
      text-decoration-thickness: 2px;
    }
  }

  /* Focus indicators for accessibility */
  .markdown-content :global(*:focus-visible) {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* Variable tooltips - global style */
  :global(.variable-tooltip) {
    position: fixed;
    background: var(--surface-card);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    border: 1px solid var(--border-sidebar);
    box-shadow: 0 4px 6px color-mix(in srgb, var(--text-primary) 30%, transparent);
    z-index: 10000;
    pointer-events: none;
    white-space: nowrap;
  }

  /* Security status messages */
  .markdown-content :global(.status-spinner) {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
    margin: 0.25rem 0;
  }

  .markdown-content :global(.status-spinner .spinner) {
    display: inline-block;
    width: 0.875em;
    height: 0.875em;
    border: 2px solid rgba(107, 114, 128, 0.3);
    border-top-color: #6b7280;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .markdown-content :global(.status-success) {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: #10b981;
    font-size: 0.875rem;
    margin: 0.25rem 0;
  }

  .markdown-content :global(.status-success .checkmark) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    height: 1em;
    font-weight: bold;
    background: #10b981;
    color: white;
    border-radius: 50%;
    font-size: 0.75em;
    line-height: 1;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* File download/display components */
  .markdown-content :global(.file-download) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0.75rem 0;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    transition: background 0.2s;
  }

  .markdown-content :global(.file-download:hover) {
    background: var(--surface-hover);
  }

  .markdown-content :global(.file-download > i) {
    font-size: 1.5rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .markdown-content :global(.file-download-name) {
    flex: 1;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .markdown-content :global(.file-download-btn) {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--primary-color);
    color: white;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .markdown-content :global(.file-download-btn:hover) {
    opacity: 0.9;
  }

  .markdown-content :global(.file-download-btn i) {
    font-size: 0.875rem;
    color: white;
  }

  .markdown-content :global(.file-error) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    margin: 0.75rem 0;
    background: var(--error-bg);
    border: 1px solid var(--error-color);
    border-radius: 8px;
    color: var(--error-color);
  }

  .markdown-content :global(.file-error i) {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
</style>
