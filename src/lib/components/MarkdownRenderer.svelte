<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import hljs from 'highlight.js';
  import DOMPurify from 'dompurify';

  interface Props {
    content: string;
    enableCopy?: boolean;
  }

  let { content, enableCopy = true }: Props = $props();
  let renderedHtml = $state('');
  let containerEl: HTMLDivElement;

  // Configure marked with custom renderer for code blocks
  function configureMarked() {
    const renderer = new marked.Renderer();

    // Custom code block renderer with syntax highlighting and copy button
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const code = text;
      const language = lang;
      let highlighted = '';
      let detectedLang = language || '';
      let isInferred = false;

      if (language) {
        try {
          highlighted = hljs.highlight(code, { language }).value;
        } catch (e) {
          console.error('Highlight.js error:', e);
          // Fallback to auto-detect if specified language fails
          try {
            const result = hljs.highlightAuto(code);
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
        // Auto-detect language
        try {
          const result = hljs.highlightAuto(code);
          highlighted = result.value;
          detectedLang = result.language || 'plaintext';
          isInferred = true;
        } catch {
          highlighted = code;
          detectedLang = 'plaintext';
        }
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

  // Render markdown to HTML
  function renderMarkdown(text: string): string {
    try {
      configureMarked();
      const rawHtml = marked.parse(text) as string;
      // Sanitize to prevent XSS while allowing necessary HTML
      return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li',
          'blockquote',
          'a', 'img',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'div', 'span', 'button',
          'del', 'ins',
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel', 'src', 'alt', 'title',
          'class', 'id', 'data-code', 'aria-label',
          'style' // For inline styles if needed
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
      }
    );
  }

  // Add tooltips for variable hover
  let activeTooltip: HTMLDivElement | null = null;

  function showVariableTooltip(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('hljs-variable') && 
        !target.classList.contains('hljs-template-variable')) {
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
    renderedHtml = renderMarkdown(content);
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
<div class="markdown-content" bind:this={containerEl}>
  {@html renderedHtml}
</div>

<style>
  .markdown-content {
    line-height: 1.6;
    font-size: 0.95rem;
    word-wrap: break-word;
  }

  /* Headers */
  .markdown-content :global(h1) {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem;
    border-bottom: 2px solid var(--border-sidebar, #ddd);
    padding-bottom: 0.3rem;
  }

  .markdown-content :global(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem;
    border-bottom: 1px solid var(--border-sidebar, #eee);
    padding-bottom: 0.25rem;
  }

  .markdown-content :global(h3) {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
  }

  .markdown-content :global(h4) {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0.75rem 0 0.5rem;
  }

  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    font-size: 1rem;
    font-weight: 600;
    margin: 0.5rem 0 0.25rem;
  }

  /* Paragraphs */
  .markdown-content :global(p) {
    margin: 0.75rem 0;
  }

  /* Links */
  .markdown-content :global(a) {
    color: #646cff;
    text-decoration: underline;
    transition: color 0.2s;
  }

  .markdown-content :global(a:hover) {
    color: #535bf2;
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
    border-left: 4px solid #646cff;
    padding-left: 1rem;
    margin: 1rem 0;
    color: var(--text-secondary);
    font-style: italic;
    background: rgba(100, 108, 255, 0.05);
    padding: 0.5rem 1rem;
    border-radius: 4px;
  }

  /* Inline code */
  .markdown-content :global(.inline-code) {
    background: rgba(100, 108, 255, 0.15);
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 0.9em;
    color: #e01e5a;
  }

  /* Code blocks wrapper */
  .markdown-content :global(.code-block-wrapper) {
    position: relative;
    margin: 1rem 0;
    border-radius: 6px;
    overflow: hidden;
    background: var(--surface-card);
    border: 1px solid var(--border-sidebar);
  }

  /* Code header */
  .markdown-content :global(.code-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--surface-sidebar-primary);
    border-bottom: 1px solid var(--border-sidebar);
  }

  .markdown-content :global(.code-lang) {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
  }

  .markdown-content :global(.code-lang.inferred) {
    color: #98c379;
    font-style: italic;
  }

  /* Copy button */
  .markdown-content :global(.copy-btn) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
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
    outline: 2px solid #646cff;
    outline-offset: 2px;
  }

  .markdown-content :global(.copy-btn.copied) {
    background: rgba(152, 195, 121, 0.2);
    border-color: rgba(152, 195, 121, 0.5);
    color: #98c379;
  }

  .markdown-content :global(.copy-icon) {
    font-size: 1rem;
  }

  /* Code blocks */
  .markdown-content :global(pre) {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
    background: var(--surface-sidebar-primary);
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
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 6px;
    padding: 1rem;
    margin: 1rem 0;
  }

  .markdown-content :global(.markdown-error strong) {
    color: #c00;
  }

  .markdown-content :global(.markdown-error pre) {
    background: #fff;
    padding: 0.5rem;
    border: 1px solid #ddd;
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
    outline: 2px solid #646cff;
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
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    pointer-events: none;
    white-space: nowrap;
  }
</style>

