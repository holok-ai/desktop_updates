/* eslint-disable security/detect-non-literal-fs-filename, security/detect-non-literal-regexp */
/**
 * DocumentConversionService
 *
 * Converts DOCX and PDF files to canonical Markdown for artifact editing.
 * Uses mammoth for DOCX and pdf2json for PDF extraction.
 */

import mammoth from 'mammoth';
import PDFParser from 'pdf2json';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import log from '../utils/logger.js';

export class DocumentConversionService {
  /**
   * Convert a file buffer to Markdown based on MIME type.
   * Markdown files are returned as-is.
   */
  async convertToMarkdown(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'text/markdown':
        return buffer.toString('utf-8');

      case 'text/plain':
        return buffer.toString('utf-8');

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.convertDocxToMarkdown(buffer);

      case 'application/pdf':
        return this.convertPdfToMarkdown(buffer);

      default:
        throw new Error(`[DocumentConversionService] Unsupported MIME type: ${mimeType}`);
    }
  }

  /**
   * Check whether a MIME type can be converted to Markdown.
   */
  isConvertibleType(mimeType: string): boolean {
    return [
      'text/markdown',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
    ].includes(mimeType);
  }

  // ── Private ──

  private async convertDocxToMarkdown(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.convertToHtml({ buffer });

      if (result.messages.length > 0) {
        log.warn('[DocumentConversionService] DOCX conversion warnings', {
          warnings: result.messages.map((m: { message: string }) => m.message),
        });
      }

      // Convert the HTML output to Markdown
      const markdown = this.htmlToMarkdown(result.value);

      log.info('[DocumentConversionService] DOCX converted to Markdown', {
        contentLength: markdown.length,
      });

      return markdown;
    } catch (error) {
      log.error('[DocumentConversionService] DOCX conversion failed', { error });
      throw new Error(
        `DOCX conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Simple HTML-to-Markdown converter for mammoth HTML output.
   * Handles the subset of HTML elements mammoth produces.
   */
  private htmlToMarkdown(html: string): string {
    let md = html;

    // Headings (h1-h6)
    for (let i = 1; i <= 6; i++) {
      const prefix = '#'.repeat(i);
      const re = new RegExp(`<h${i}[^>]*>(.*?)</h${i}>`, 'gi');
      md = md.replace(re, `\n${prefix} $1\n`);
    }

    // Bold
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

    // Italic
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Images
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

    // Unordered list items
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1');
    md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

    // Paragraphs
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

    // Line breaks
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n');

    // Code blocks
    md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```');
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Strip remaining HTML tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");
    md = md.replace(/&nbsp;/g, ' ');

    // Clean up extra blank lines (3+ newlines → 2)
    md = md.replace(/\n{3,}/g, '\n\n');

    return md.trim();
  }

  private async convertPdfToMarkdown(buffer: Buffer): Promise<string> {
    // pdf2json requires a file path, so write to a temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `holokai-pdf-${Date.now()}.pdf`);

    try {
      await fs.promises.writeFile(tempFile, buffer);
      const text = await this.extractTextFromPdf(tempFile);

      // Wrap plain text in basic Markdown structure
      const markdown = text
        .split(/\f/) // Form feed = page break
        .filter((page) => page.trim().length > 0)
        .join('\n\n---\n\n');

      log.info('[DocumentConversionService] PDF converted to Markdown', {
        contentLength: markdown.length,
      });

      return markdown;
    } finally {
      // Clean up temp file
      try {
        await fs.promises.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private extractTextFromPdf(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errMsg: Error | { parserError: Error }) => {
        const error = errMsg instanceof Error ? errMsg : errMsg.parserError;
        log.error('[DocumentConversionService] PDF parsing error', { error });
        reject(error);
      });

      pdfParser.on('pdfParser_dataReady', () => {
        try {
          const text = pdfParser.getRawTextContent();
          resolve(text);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });

      void pdfParser.loadPDF(filePath);
    });
  }
}

export const documentConversionService = new DocumentConversionService();
