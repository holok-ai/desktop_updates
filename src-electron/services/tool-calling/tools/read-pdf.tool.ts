/**
 * Read PDF Tool
 * Reads the contents of a PDF file and extracts plain text
 */

import type { ITool, ToolContext } from './base-tool.js';
import type { ToolDefinition, ToolResult, ReadPdfResult } from '../tool-types.js';
import type { ToolExecutionContext } from '../orchestrator-types.js';
import * as fs from 'fs';
import * as path from 'path';
import PDFParser from 'pdf2json';
import log from 'electron-log';

export class ReadPdfTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'read_pdf';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'read_pdf',
      description:
        'Read the contents of a PDF file and extract plain text. Works with standard PDF files.',
      input_schema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the .pdf file (can be relative to working directory or absolute)',
          },
        },
        required: ['file_path'],
      },
    };
  }

  async execute(
    params: Record<string, unknown>,
    executionContext: ToolExecutionContext
  ): Promise<ToolResult> {
    const userPath = params.file_path as string;
    const resolvedPath = this.context.service.resolvePath(
      userPath,
      executionContext.workingDirectory
    );

    // Emit status using executionContext callback (if provided)
    if (executionContext.statusCallback) {
      executionContext.statusCallback({
        toolName: 'read_pdf',
        state: 'in_progress',
        message: `Reading PDF file: ${userPath}`,
      });
    }

    // Security check
    const pathCheck = this.context.service.checkPathAccess(resolvedPath);
    if (!pathCheck.allowed) {
      return {
        success: false,
        error:
          pathCheck.reason === 'blacklist'
            ? `The file ${userPath} is in a folder I cannot access. I am not allowed to access folders and files in system and sensitive folders.`
            : `I cannot read file ${userPath}. To allow this, add an entry to the allowed folder list in settings.`,
      };
    }

    // Check existence
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `FILE_NOT_FOUND: '${userPath}' does not exist`,
      };
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `NOT_A_FILE: '${userPath}' is not a file`,
      };
    }

    // Check file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext !== '.pdf') {
      return {
        success: false,
        error: `INVALID_FILE_TYPE: Expected .pdf file, got ${ext}`,
      };
    }

    // Check file size (max 100MB for PDF files)
    const maxFileSize = 100 * 1024 * 1024;
    if (stats.size > maxFileSize) {
      return {
        success: false,
        error: `FILE_TOO_LARGE: File is ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${maxFileSize / 1024 / 1024}MB)`,
      };
    }

    try {
      // Extract text using pdf2json
      const text = await this.extractTextFromPdf(resolvedPath);

      // Count words and pages (approximate from text)
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const pageCount = this.estimatePageCount(text);

      const pdfResult: ReadPdfResult = {
        path: resolvedPath,
        content: text,
        metadata: {
          size: stats.size,
          modified: stats.mtimeMs,
          wordCount,
          pageCount,
          format: 'pdf',
        },
      };

      // Emit completion status
      if (executionContext.statusCallback) {
        executionContext.statusCallback({
          toolName: 'read_pdf',
          state: 'complete',
        });
      }

      return {
        success: true,
        data: pdfResult,
      };
    } catch (error) {
      log.error('[ReadPdfTool] Error reading PDF:', error);
      const err = error as Error;
      return {
        success: false,
        error: `EXTRACTION_ERROR: Failed to extract text from PDF: ${err.message}`,
      };
    }
  }

  /**
   * Extract text from PDF using pdf2json
   */
  private extractTextFromPdf(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errMsg: Error | { parserError: Error }) => {
        // Handle both error types from pdf2json
        const error = errMsg instanceof Error ? errMsg : errMsg.parserError;
        reject(error);
      });

      pdfParser.on('pdfParser_dataReady', () => {
        try {
          // getRawTextContent returns the raw text extracted from PDF
          const text = pdfParser.getRawTextContent();
          resolve(text);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });

      // Load PDF file
      void pdfParser.loadPDF(filePath);
    });
  }

  /**
   * Estimate page count based on form feed characters or text length
   */
  private estimatePageCount(text: string): number {
    // pdf2json often separates pages with form feed characters
    const formFeeds = (text.match(/\f/g) || []).length;
    if (formFeeds > 0) {
      return formFeeds + 1; // Form feeds are page breaks, so pages = breaks + 1
    }

    // Fallback: estimate based on text length (rough approximation)
    // Average page is about 500 words or 3000 characters
    const estimatedPages = Math.max(1, Math.ceil(text.length / 3000));
    return estimatedPages;
  }
}

export function createReadPdfTool(context: ToolContext): ReadPdfTool {
  return new ReadPdfTool(context);
}
