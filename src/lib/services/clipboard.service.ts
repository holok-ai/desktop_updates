/**
 * Clipboard Service for copy/paste operations
 */

import { writable, get } from 'svelte/store';
import { toastStore } from './toast.service';

export type CopyFormat = 'text' | 'markdown';

const COPY_FORMAT_KEY = 'holokai:copyFormat';

// Store for format preference
const formatStore = writable<CopyFormat>('markdown');

// Store for "copy to input" content (shared between MessageBubble and Composer)
export const copyToInputStore = writable<string | null>(null);

/** Load format preference from storage */
export function initClipboardPreference(): void {
  try {
    const saved = localStorage.getItem(COPY_FORMAT_KEY);
    if (saved === 'text' || saved === 'markdown') {
      formatStore.set(saved);
    }
  } catch {
    // ignore
  }
}

/** Get current format preference */
export function getCopyFormat(): CopyFormat {
  return get(formatStore);
}

/** Set format preference */
export function setCopyFormat(format: CopyFormat): void {
  formatStore.set(format);
  try {
    localStorage.setItem(COPY_FORMAT_KEY, format);
  } catch {
    // ignore
  }
}

/** Subscribe to format changes */
export function subscribeToFormat(callback: (format: CopyFormat) => void): () => void {
  return formatStore.subscribe(callback);
}

/** Strip markdown formatting from text */
export function stripMarkdown(text: string): string {
  return text
    // Remove code blocks (``` ... ```)
    .replace(/```[\s\S]*?```/g, (match) => {
      const lines = match.split('\n');
      // Remove first and last lines (the ``` markers)
      return lines.slice(1, -1).join('\n');
    })
    // Remove inline code (`...`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold (**text** or __text__)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Remove italic (*text* or _text_)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove strikethrough (~~text~~)
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes (>)
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove list markers
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Copy text to clipboard */
export async function copyToClipboard(text: string, showToast = true): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    if (showToast) {
      toastStore.show('Copied to clipboard', { variant: 'success' });
    }
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    if (showToast) {
      toastStore.show('Failed to copy', { variant: 'error' });
    }
    return false;
  }
}

/** Copy response with format option */
export async function copyResponse(content: string, format?: CopyFormat): Promise<boolean> {
  const useFormat = format ?? getCopyFormat();
  const text = useFormat === 'text' ? stripMarkdown(content) : content;
  return copyToClipboard(text);
}

/** Copy code block (raw code without backticks) */
export async function copyCode(code: string): Promise<boolean> {
  const success = await copyToClipboard(code, false);
  if (success) {
    toastStore.show('Code copied', { variant: 'success' });
  }
  return success;
}

/** Copy prompt to input (sets the store for Composer to read) */
export function copyToInput(content: string): void {
  copyToInputStore.set(content);
  toastStore.show('Copied to input', { variant: 'success' });
}

/** Clear the copy-to-input store */
export function clearCopyToInput(): void {
  copyToInputStore.set(null);
}
