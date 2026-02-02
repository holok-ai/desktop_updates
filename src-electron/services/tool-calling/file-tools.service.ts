import { app } from 'electron';
import log from 'electron-log';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  ToolResult,
  FolderEntry,
  WriteFileParams,
} from './tool-types.js';

/**
 * File Tools Service
 * Provides security and utility methods for file operations
 * NO LONGER STORES WORKING DIRECTORY STATE
 */
export class FileToolsService {
  private blacklistedPaths: Set<string>;
  private allowedPaths: Set<string>;
  private readonly maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private readonly maxFolderFiles: number = 1000;

  constructor(allowedPaths?: string[]) {
    this.blacklistedPaths = this.initializeBlacklist();
    this.allowedPaths = new Set((allowedPaths || []).map((p) =>
      path.normalize(path.resolve(p))
    ));

    log.info('[FileToolsService] Initialized', JSON.stringify({
      blacklistedPathsCount: this.blacklistedPaths.size,
      allowedPathsCount: this.allowedPaths.size,
      allowedPaths: Array.from(this.allowedPaths),
    }));
  }

  /**
   * Getters for properties needed by tools
   */
  public getMaxFileSize(): number {
    return this.maxFileSize;
  }

  public getMaxFolderFiles(): number {
    return this.maxFolderFiles;
  }


  /**
   * Read folder contents with optional recursive traversal
   */
  private async readFolder(params: Record<string, unknown>): Promise<ToolResult> {
    const userPath = params.path as string;
    const recursive = (params.recursive as boolean) ?? false;
    const max_depth = (params.max_depth as number) ?? 3;
    const include_hidden = (params.include_hidden as boolean) ?? false;
    const filter_extensions = params.filter_extensions as string[] | undefined;

    const resolvedPath = this.resolvePath(userPath, process.cwd());

    // Security check
    const pathCheck = this.checkPathAccess(resolvedPath);
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
    const entries = await this.readDirectoryRecursive(
      resolvedPath,
      recursive,
      max_depth,
      include_hidden,
      filter_extensions,
      0,
    );

    // Check file limit
    if (entries.length > this.maxFolderFiles) {
      return {
        success: false,
        error: `TOO_MANY_FILES: Folder contains ${entries.length} items (max: ${this.maxFolderFiles}). Be more specific or use filters.`,
      };
    }

    return {
      success: true,
      data: {
        path: resolvedPath,
        entries,
        total_files: entries.filter((e) => e.type === 'file').length,
        total_directories: entries.filter((e) => e.type === 'directory').length,
      },
    };
  }

  /**
   * Read file contents with optional line range and encoding
   */
  private async readFile(params: Record<string, unknown>): Promise<ToolResult> {
    const userPath = (params.file_path || params.path) as string;
    const encoding = (params.encoding as 'utf-8' | 'ascii' | 'latin1') ?? 'utf-8';
    const start_line = params.start_line as number | undefined;
    const end_line = params.end_line as number | undefined;

    const resolvedPath = this.resolvePath(userPath, process.cwd());

    // Security check
    const pathCheck = this.checkPathAccess(resolvedPath);
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
    if (stats.size > this.maxFileSize && !start_line && !end_line) {
      return {
        success: false,
        error: `FILE_TOO_LARGE: File is ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${this.maxFileSize / 1024 / 1024}MB). Use start_line and end_line parameters.`,
      };
    }

    // Check if text file
    if (!this.isTextFile(resolvedPath)) {
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

    return {
      success: true,
      data: {
        path: resolvedPath,
        content,
        metadata: {
          size: stats.size,
          lines: content.split('\n').length,
          modified: stats.mtimeMs,
          encoding,
        },
        truncated,
      },
    };
  }

  /**
   * Create or update a file with the specified content
   */
  private async writeFile(params: WriteFileParams): Promise<ToolResult> {
    // Explicitly default overwrite to false if not provided
    const overwrite = params.overwrite === true;
    const { path: userPath, content, encoding = 'utf-8' } = params;

    const allowedEncodings: Array<'utf-8' | 'ascii' | 'latin1'> = ['utf-8', 'ascii', 'latin1'];
    if (!allowedEncodings.includes(encoding)) {
      return {
        success: false,
        error: `INVALID_ENCODING: Unsupported encoding: '${encoding}'`,
      };
    }

    const resolvedPath = this.resolvePath(userPath, process.cwd());

    // Security check - must be in allowed directories and not blacklisted
    const pathCheck = this.checkPathAccess(resolvedPath);
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

      log.info('[FileToolsService] write_file operation', {
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

      return {
        success: true,
        data: {
          path: resolvedPath,
          created: !fileExists,
          bytesWritten: bytesWritten,
          metadata: {
            size: stats.size,
            modified: stats.mtimeMs,
            encoding,
            previousSize: previousSize,
          },
        },
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      log.error('[FileToolsService] write_file error', {
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

  /**
   * Recursively read directory entries
   */
  public async readDirectoryRecursive(
    dirPath: string,
    recursive: boolean,
    maxDepth: number,
    includeHidden: boolean,
    filterExtensions?: string[],
    currentDepth: number = 0,
  ): Promise<FolderEntry[]> {
    const entries: FolderEntry[] = [];
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (!includeHidden && item.name.startsWith('.')) continue;

      const itemPath = path.join(dirPath, item.name);

      // Security check for each item
      if (!this.isPathAllowed(itemPath)) {
        continue;
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const stats = await fs.promises.stat(itemPath);

      if (item.isDirectory()) {
        entries.push({
          name: item.name,
          path: itemPath,
          type: 'directory',
          size: 0,
          modified: stats.mtimeMs,
        });

        if (recursive && currentDepth < maxDepth) {
          const subEntries = await this.readDirectoryRecursive(
            itemPath,
            recursive,
            maxDepth,
            includeHidden,
            filterExtensions,
            currentDepth + 1,
          );
          entries.push(...subEntries);
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name);

        if (filterExtensions && filterExtensions.length > 0) {
          if (!filterExtensions.includes(ext)) continue;
        }

        entries.push({
          name: item.name,
          path: itemPath,
          type: 'file',
          size: stats.size,
          modified: stats.mtimeMs,
          extension: ext,
        });
      }
    }

    return entries;
  }

  /**
   * Resolve path relative to provided working directory
   * @param userPath - User-provided path (relative or absolute)
   * @param workingDirectory - Context working directory
   */
  public resolvePath(userPath: string, workingDirectory: string): string { let resolved = userPath;

    // Expand home directory
    if (resolved.startsWith('~')) {
      const homedir = app.getPath('home');
      resolved = path.join(homedir, resolved.slice(1));
    }

    // Resolve relative paths against working directory
    if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(workingDirectory, resolved);
    }

    return path.normalize(resolved);
  }

  /**
   * Check if a path starts with a folder, handling case-insensitivity on Windows
   * @param whiteList - The allowed folder path
   * @param promptString - The path to check
   * @returns True if promptString starts with whiteList
   */
  private startsWithFolder(whiteList: string, promptString: string): boolean {
    const isWindows = os.platform() === 'win32';

    if (isWindows) {
      // Case-insensitive comparison on Windows
      return promptString.toLowerCase().startsWith(whiteList.toLowerCase());
    }

    // Case-sensitive comparison on Unix-like systems
    return promptString.startsWith(whiteList);
  }

  /**
   * Check if a path is allowed with detailed reason
   * @returns Object with allowed status and reason for denial
   */
  public checkPathAccess(absolutePath: string): {
    allowed: boolean;
    reason?: 'blacklist' | 'whitelist';
  } {
    // Check blacklist first
    for (const blacklisted of this.blacklistedPaths) {
      if (this.startsWithFolder(blacklisted, absolutePath)) {
        return { allowed: false, reason: 'blacklist' };
      }
    }

    // If whitelist is configured, path must be within allowed paths
    if (this.allowedPaths.size > 0) {
      let isInAllowedPath = false;
      for (const allowed of this.allowedPaths) {
        if (this.startsWithFolder(allowed, absolutePath)) {
          isInAllowedPath = true;
          break;
        }
      }
      if (!isInAllowedPath) {
        return { allowed: false, reason: 'whitelist' };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a path is allowed (backward compatibility)
   * - If allowedPaths is configured, the path must be within one of the allowed paths
   * - The path must NOT be in the blacklist
   */
  public isPathAllowed(absolutePath: string): boolean {
    return this.checkPathAccess(absolutePath).allowed;
  }

  /**
   * Check if a file is a text file based on extension
   */
  public isTextFile(filePath: string): boolean {
    const textExts = new Set([
      '.txt',
      '.md',
      '.me',
      '.json',
      '.csv',
      '.js',
      '.ts',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.hpp',
      '.cs',
      '.css',
      '.html',
      '.xml',
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.conf',
      '.sh',
      '.bash',
      '.bat',
      '.ps',
      '.ps1',
      '.sql',
      '.go',
      '.rs',
      '.vue',
      '.svelte',
      '.log',
      '.env',
    ]);
    return textExts.has(path.extname(filePath).toLowerCase());
  }

  /**
   * Initialize path blacklist for security
   */
  private initializeBlacklist(): Set<string> {
    const blacklist = new Set<string>();
    const home = app.getPath('home');

    // System directories
    if (process.platform === 'win32') {
      blacklist.add('C:\\Windows');
      blacklist.add('C:\\Program Files');
    } else {
      blacklist.add('/System');
      blacklist.add('/usr/bin');
      blacklist.add('/etc');
    }

    // Sensitive user directories
    blacklist.add(path.join(home, '.ssh'));
    blacklist.add(path.join(home, '.aws'));
    blacklist.add(path.join(home, '.gnupg'));

    return blacklist;
  }


  /**
   * Set allowed paths (whitelist) for file access
   * @param paths - Array of absolute or relative paths to allow
   */
  public setAllowedPaths(paths: string[]): void {
    this.allowedPaths = new Set(paths.map((p) => path.normalize(path.resolve(p))));
    log.info('[FileToolsService] Allowed paths updated', {
      allowedPathsCount: this.allowedPaths.size,
      allowedPaths: Array.from(this.allowedPaths),
    });
  }

  /**
   * Add path(s) to the allowed paths whitelist
   * @param paths - Path(s) to add to the whitelist
   */
  public addAllowedPaths(...paths: string[]): void {
    paths.forEach((p) => {
      const normalized = path.normalize(path.resolve(p));
      this.allowedPaths.add(normalized);
    });
    log.info('[FileToolsService] Allowed paths added', {
      added: paths,
      allowedPathsCount: this.allowedPaths.size,
    });
  }

  /**
   * Remove path(s) from the allowed paths whitelist
   * @param paths - Path(s) to remove from the whitelist
   */
  public removeAllowedPaths(...paths: string[]): void {
    paths.forEach((p) => {
      const normalized = path.normalize(path.resolve(p));
      this.allowedPaths.delete(normalized);
    });
    log.info('[FileToolsService] Allowed paths removed', {
      removed: paths,
      allowedPathsCount: this.allowedPaths.size,
    });
  }

  /**
   * Get the current allowed paths whitelist
   * @returns Array of allowed paths
   */
  public getAllowedPaths(): string[] {
    return Array.from(this.allowedPaths);
  }

  /**
   * Clear all allowed paths (disables whitelist)
   */
  public clearAllowedPaths(): void {
    this.allowedPaths.clear();
    log.info('[FileToolsService] Allowed paths cleared');
  }
}
