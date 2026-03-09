/**
 * Composer Tag Parser
 *
 * Shared utility for parsing <composer> tags from AI responses.
 * Used by both the backend inspector pipeline (message load) and
 * the frontend streaming path (live token accumulation).
 */

import type { ComposerContent, ComposerParseResult } from '../types/composer.types.js';

/**
 * Regex to match <composer id="..." title="...">...</composer>.
 * Captures: (1) attributes string, (2) inner content.
 */
const COMPOSER_TAG_REGEX = /<composer\s+([^>]*)>([\s\S]*?)<\/composer>/;

/** Extract a named attribute value from an attribute string. */
function extractAttr(attrs: string, name: string): string | null {
  // Matches: name="value" or name='value'
  const regex = new RegExp(`${name}=["']([^"']*)["']`);
  const match = attrs.match(regex);
  return match ? match[1] : null;
}

/**
 * Map a filename extension to a MIME type.
 * Used when the artifact's MIME type isn't available from context.
 */
export function mimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
      return 'application/javascript';
    case 'ts':
      return 'application/typescript';
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'yaml':
    case 'yml':
      return 'application/yaml';
    case 'csv':
      return 'text/csv';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'text/plain';
  }
}

/**
 * Parse an AI response string for a <composer> tag.
 *
 * Returns the extracted ComposerContent and the message content
 * with the <composer> block removed (so the chat bubble shows
 * only the summary and description text).
 *
 * @param responseContent - The full AI response text
 * @param fallbackMimeType - MIME type to use if not derivable from the title (e.g. from the artifact)
 */
export function parseComposerTag(
  responseContent: string,
  fallbackMimeType?: string,
): ComposerParseResult {
  const match = responseContent.match(COMPOSER_TAG_REGEX);

  if (!match) {
    return { composer: null, strippedContent: responseContent };
  }

  const [fullMatch, attrsStr, innerContent] = match;

  const id = extractAttr(attrsStr, 'id') ?? '';
  const title = extractAttr(attrsStr, 'title') ?? '';
  const versionDescription = extractAttr(attrsStr, 'version_description') ?? undefined;
  const mimeType = fallbackMimeType ?? mimeTypeFromFilename(title);

  const composer: ComposerContent = {
    id,
    title,
    mimeType,
    content: innerContent.trim(),
    versionDescription,
  };

  // Remove the <composer> block from the display content and clean up whitespace
  const strippedContent = responseContent
    .replace(fullMatch, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { composer, strippedContent };
}

/**
 * Check whether a (possibly incomplete) streaming response contains
 * a complete <composer> block. Useful for knowing when to extract
 * during streaming without waiting for the full response.
 */
export function hasCompleteComposerTag(text: string): boolean {
  return COMPOSER_TAG_REGEX.test(text);
}

/** Banners that delimit prompt augmentation in user messages. */
export const AUGMENTATION_START = '>->COMPOSER<-<';
export const AUGMENTATION_END = '<-<END>->';

/**
 * Strip prompt augmentation from a user message, returning only the
 * original user text. Returns the content unchanged if no banners are found.
 */
export function stripPromptAugmentation(content: string): string {
  const startIdx = content.indexOf(AUGMENTATION_START);
  const endIdx = content.indexOf(AUGMENTATION_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return content;

  const afterEnd = content.substring(endIdx + AUGMENTATION_END.length).trim();
  const beforeStart = content.substring(0, startIdx).trim();

  return [beforeStart, afterEnd].filter(Boolean).join('\n\n');
}
