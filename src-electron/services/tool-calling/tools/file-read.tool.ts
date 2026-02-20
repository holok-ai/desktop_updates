/**
 * File Read Tool
 * Reads the contents of a text file from the filesystem
 */

import type { ITool, ToolContext } from './base-tool.js';
import type { ToolDefinition, ToolResult, ReadFileResult } from '../tool-types.js';
import type { ToolExecutionContext } from '../orchestrator-types.js';
import * as fs from 'fs';

export class FileReadTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'read_file';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'read_file',
      description:
        'Read the contents of a text file from the local filesystem. Supports encoding options and line ranges for large files.',
      input_schema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file (can be relative to working directory or absolute)',
          },
          encoding: {
            type: 'string',
            enum: ['utf-8', 'ascii', 'latin1'],
            description: 'Text encoding. Default: utf-8',
          },
          start_line: {
            type: 'integer',
            description: 'Read from this line number (1-indexed). Useful for large files.',
          },
          end_line: {
            type: 'integer',
            description: 'Read to this line number (1-indexed). Useful for large files.',
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
    const userPath = (params.file_path || params.path) as string;
    const encoding = (params.encoding as 'utf-8' | 'ascii' | 'latin1') ?? 'utf-8';
    const start_line = params.start_line as number | undefined;
    const end_line = params.end_line as number | undefined;

    const resolvedPath = this.context.service.resolvePath(
      userPath,
      executionContext.workingDirectory,
    );

    // Emit status using executionContext callback (if provided)
    if (executionContext.statusCallback) {
      executionContext.statusCallback({
        toolName: 'read_file',
        state: 'in_progress',
        message: `Reading file: ${userPath}`,
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

    // Check file size
    const maxFileSize = this.context.service.getMaxFileSize();
    if (stats.size > maxFileSize && !start_line && !end_line) {
      return {
        success: false,
        error: `FILE_TOO_LARGE: File is ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${maxFileSize / 1024 / 1024}MB). Use start_line and end_line parameters.`,
      };
    }

    // Check if text file
    if (!this.context.service.isTextFile(resolvedPath)) {
      return {
        success: false,
        error: `NOT_TEXT_FILE: File appears to be binary`,
      };
    }

    // Read file - when encoding is specified, readFile returns a string
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fileContent = await fs.promises.readFile(resolvedPath, { encoding });
    let content: string = fileContent;
    let truncated = false;

    // Handle line ranges
    if (start_line || end_line) {
      const lines = content.split('\n');
      const start = (start_line || 1) - 1;
      const end = end_line || lines.length;
      content = lines.slice(start, end).join('\n');
      truncated = start > 0 || end < lines.length;
    }

    const result: ReadFileResult = {
      path: resolvedPath,
      content,
      metadata: {
        size: stats.size,
        lines: content.split('\n').length,
        modified: stats.mtimeMs,
        encoding,
      },
      truncated,
    };

    // Emit completion status
    if (executionContext.statusCallback) {
      executionContext.statusCallback({
        toolName: 'read_file',
        state: 'complete',
      });
    }

    return {
      success: true,
      data: result,
    };
  }
}

export function createFileReadTool(context: ToolContext): FileReadTool {
  return new FileReadTool(context);
}
