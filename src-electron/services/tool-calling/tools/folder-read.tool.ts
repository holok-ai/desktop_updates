/**
 * Folder Read Tool
 * Lists files and subdirectories in a folder
 */

import type { ITool, ToolContext } from './base-tool.js';
import type { ToolDefinition, ToolResult, ReadFolderResult } from '../tool-types.js';
import * as fs from 'fs';
import log from 'electron-log';

export class FolderReadTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'read_folder';
  }

  getDefinition(): ToolDefinition {
    return {
      name: 'read_folder',
      description:
        'List files and subdirectories in a folder on the local filesystem. Returns metadata including names, paths, types, sizes, and modification times.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the folder (can be relative to working directory or absolute)',
          },
          recursive: {
            type: 'boolean',
            description: 'If true, list subdirectories recursively. Default: false',
          },
          max_depth: {
            type: 'integer',
            description: 'Maximum recursion depth when recursive is true. Default: 3',
          },
          include_hidden: {
            type: 'boolean',
            description: 'Include hidden files (starting with .). Default: false',
          },
          filter_extensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only include files with these extensions (e.g., [".js", ".ts"])',
          },
        },
        required: ['path'],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const userPath = params.path as string;
    const recursive = (params.recursive as boolean) ?? false;
    const max_depth = (params.max_depth as number) ?? 3;
    const include_hidden = (params.include_hidden as boolean) ?? false;
    const filter_extensions = params.filter_extensions as string[] | undefined;

    const resolvedPath = this.context.service.resolvePath(userPath);

    // Security check
    const pathCheck = this.context.service.checkPathAccess(resolvedPath);
    if (!pathCheck.allowed) {
      return {
        success: false,
        error:
          pathCheck.reason === 'blacklist'
            ? `The folder ${userPath} is in a folder I cannot access. I am not allowed to access folders and files in system and sensitive folders.`
            : `I cannot read folder ${userPath}. To allow this, add an entry to the allowed folder list in settings.`,
      };
    }

    // Check existence
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `PATH_NOT_FOUND: '${userPath}' does not exist`,
      };
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        success: false,
        error: `NOT_A_DIRECTORY: '${userPath}' is not a directory`,
      };
    }

    // Read directory
    const entries = await this.context.service.readDirectoryRecursive(
      resolvedPath,
      recursive,
      max_depth,
      include_hidden,
      filter_extensions,
      0,
    );

    // Check file limit
    const maxFolderFiles = this.context.service.getMaxFolderFiles();
    if (entries.length > maxFolderFiles) {
      return {
        success: false,
        error: `TOO_MANY_FILES: Folder contains ${entries.length} items (max: ${maxFolderFiles}). Be more specific or use filters.`,
      };
    }

    const result: ReadFolderResult = {
      path: resolvedPath,
      entries,
      total_files: entries.filter((e) => e.type === 'file').length,
      total_directories: entries.filter((e) => e.type === 'directory').length,
    };

    return {
      success: true,
      data: result,
    };
  }
}

export function createFolderReadTool(context: ToolContext): FolderReadTool {
  return new FolderReadTool(context);
}
