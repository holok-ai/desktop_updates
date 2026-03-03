/**
 * File Write Tool
 * Creates or updates a file with specified content
 */

import type { ITool, ToolContext } from './base-tool.js';
import type {
  ToolDefinition,
  ToolResult,
  WriteFileParams,
  WriteFileResult,
} from '../tool-types.js';
import type { ToolExecutionContext } from '../orchestrator-types.js';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

export class FileWriteTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'write_file';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'write_file',
      description:
        'Create a new file or update an existing file with the specified content. Use overwrite=true to replace existing files.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file (can be relative to working directory or absolute)',
          },
          content: {
            type: 'string',
            description: 'The content to write to the file.',
          },
          overwrite: {
            type: 'boolean',
            description:
              'This flags describes whether an existing file will be overwritten. If the file does not exist, this flag has no effect. If the file exists, this flag must be TRUE to over-write the file. If the file exists and this flag is FALSE, the tool function will not write the contents and will return an error. Default is FALSE.',
          },
          encoding: {
            type: 'string',
            enum: ['utf-8', 'ascii', 'latin1'],
            description: 'Text encoding. Default: utf-8',
          },
        },
        required: ['path', 'content'],
      },
    };
  }

  async execute(
    params: Record<string, unknown>,
    executionContext: ToolExecutionContext,
  ): Promise<ToolResult> {
    const writeParams = params as unknown as WriteFileParams;

    // Explicitly default overwrite to false if not provided
    const overwrite = writeParams.overwrite === true;
    const { path: userPath, content, encoding = 'utf-8' } = writeParams;

    const allowedEncodings: Array<'utf-8' | 'ascii' | 'latin1'> = ['utf-8', 'ascii', 'latin1'];
    if (!allowedEncodings.includes(encoding)) {
      return {
        success: false,
        error: `INVALID_ENCODING: Unsupported encoding: '${encoding}'`,
      };
    }

    const resolvedPath = this.context.service.resolvePath(
      userPath,
      executionContext.workingDirectory,
    );

    // Security check - must be in allowed directories and not blacklisted
    const pathCheck = this.context.service.checkPathAccess(resolvedPath);
    if (!pathCheck.allowed) {
      return {
        success: false,
        error: 'ACCESS_DENIED: Path is not in the allowed directories list',
      };
    }

    // Check if file exists
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fileExists = fs.existsSync(resolvedPath);
    if (fileExists && !overwrite) {
      return {
        success: false,
        error: `FILE_EXISTS: '${userPath}' already exists. Set overwrite=true to replace it.`,
      };
    }

    const parentDir = path.dirname(resolvedPath);
    // Check if parent directory exists
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const parentExists = fs.existsSync(parentDir);
    if (!parentExists) {
      return {
        success: false,
        error: 'DIR_NOT_FOUND: Parent directory does not exist',
      };
    }

    let previousSize: number | undefined;

    try {
      if (fileExists) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const existingStats = await fs.promises.stat(resolvedPath);
        previousSize = existingStats.size;
      }

      log.info('[FileWriteTool] write_file operation', {
        path: resolvedPath,
        overwrite,
        encoding,
      });

      // Write the file
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.promises.writeFile(resolvedPath, content, { encoding });

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const stats = await fs.promises.stat(resolvedPath);
      const bytesWritten = Buffer.byteLength(content, encoding);

      const result: WriteFileResult = {
        path: resolvedPath,
        created: !fileExists,
        bytesWritten: bytesWritten,
        metadata: {
          size: stats.size,
          modified: stats.mtimeMs,
          encoding,
          previousSize: previousSize,
        },
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      log.error('[FileWriteTool] write_file error', {
        path: resolvedPath,
        code: err.code,
        message: err.message,
      });

      if (err.code === 'EACCES' || err.code === 'EPERM') {
        return {
          success: false,
          error: `PERMISSION_DENIED: Cannot write to '${userPath}': permission denied`,
        };
      }

      if (err.code === 'ENOSPC') {
        return {
          success: false,
          error: 'DISK_FULL: Cannot write file: disk is full',
        };
      }

      if (err.code === 'ENOENT') {
        return {
          success: false,
          error: 'DIR_NOT_FOUND: Parent directory does not exist',
        };
      }

      return {
        success: false,
        error: err.message || 'Unknown error',
      };
    }
  }
}

export function createFileWriteTool(context: ToolContext): FileWriteTool {
  return new FileWriteTool(context);
}
