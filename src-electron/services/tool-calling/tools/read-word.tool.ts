/**
 * Read Word Tool
 * Reads the contents of a Microsoft Word (.docx) file and extracts plain text
 */

import type { ITool, ToolContext } from './base-tool.js';
import type { ToolDefinition, ToolResult, ReadWordResult } from '../tool-types.js';
import type { ToolExecutionContext } from '../orchestrator-types.js';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import log from 'electron-log';

export class ReadWordTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'read_word';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'read_word',
      description:
        'Read the contents of a Microsoft Word (.docx) file and extract plain text. Only supports .docx format (not legacy .doc files).',
      input_schema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description:
              'Path to the .docx file (can be relative to working directory or absolute)',
          },
        },
        required: ['file_path'],
      },
    };
  }

  async execute(
    params: Record<string, unknown>,
    executionContext: ToolExecutionContext,
  ): Promise<ToolResult> {
    const userPath = params.file_path as string;
    const resolvedPath = this.context.service.resolvePath(
      userPath,
      executionContext.workingDirectory,
    );

    // Emit status using executionContext callback (if provided)
    if (executionContext.statusCallback) {
      executionContext.statusCallback({
        toolName: 'read_word',
        state: 'in_progress',
        message: `Reading Word document: ${userPath}`,
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
    if (ext !== '.docx') {
      if (ext === '.doc') {
        return {
          success: false,
          error: `UNSUPPORTED_FORMAT: Legacy .doc format is not supported. Please convert to .docx format.`,
        };
      }
      return {
        success: false,
        error: `INVALID_FILE_TYPE: Expected .docx file, got ${ext}`,
      };
    }

    // Check file size (max 50MB for Word documents)
    const maxFileSize = 50 * 1024 * 1024;
    if (stats.size > maxFileSize) {
      return {
        success: false,
        error: `FILE_TOO_LARGE: File is ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${maxFileSize / 1024 / 1024}MB)`,
      };
    }

    try {
      // Read file buffer
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const buffer = await fs.promises.readFile(resolvedPath);

      // Extract text using mammoth
      const result = await mammoth.extractRawText({ buffer });

      // Log any conversion warnings
      if (result.messages.length > 0) {
        log.warn('[ReadWordTool] Conversion warnings:', result.messages);
      }

      const content = result.value;
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      const wordResult: ReadWordResult = {
        path: resolvedPath,
        content,
        metadata: {
          size: stats.size,
          modified: stats.mtimeMs,
          wordCount,
          format: 'docx',
        },
        warnings: result.messages.map((m) => m.message),
      };

      // Emit completion status
      if (executionContext.statusCallback) {
        executionContext.statusCallback({
          toolName: 'read_word',
          state: 'complete',
        });
      }

      return {
        success: true,
        data: wordResult,
      };
    } catch (error) {
      log.error('[ReadWordTool] Error reading Word document:', error);
      const err = error as Error;
      return {
        success: false,
        error: `EXTRACTION_ERROR: Failed to extract text from Word document: ${err.message}`,
      };
    }
  }
}

export function createReadWordTool(context: ToolContext): ReadWordTool {
  return new ReadWordTool(context);
}
