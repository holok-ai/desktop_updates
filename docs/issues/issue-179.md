## Description

Create a new FileToolsService class to provide local file system access tools for LLMs. This service enables LLMs to read folder contents and file contents during conversations.

## Requirements

- Must provide tool definitions in a format compatible with LLM providers (Anthropic, OpenAI formats)
- Must execute tools by name and return structured success/error results
- Must resolve relative paths to absolute paths using a configurable working directory
- Must enforce security restrictions via path blacklist (system dirs, sensitive user data)
- Must validate file size limits before reading (max 10MB) and folder entry limits (max 1000 files)
- Must support text file detection based on file extension whitelist
- Must handle errors gracefully and return descriptive error messages
- Must support recursive directory traversal with configurable depth limits
- Must filter files by extension when requested

## Implementation Details

### Tool Definitions

Two tools will be provided:

1. **read_folder**: List files and subdirectories in a folder
   - Parameters: path, recursive, max_depth, include_hidden, filter_extensions
   - Returns: entries array with file/directory metadata

2. **read_file**: Read contents of a text file
   - Parameters: path, encoding, start_line, end_line
   - Returns: file content with metadata

### Security Features

- Path blacklist for system directories (`C:\Windows`, `/System`, `/usr/bin`, `/etc`)
- Sensitive user directories blacklisted (`.ssh`, `.aws`, `.gnupg`)
- File size limits (10MB max)
- Folder entry limits (1000 files max)
- Text file validation by extension

### Code Structure

```typescript
// src-electron/services/file-tools.service.ts

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class FileToolsService {
  private workingDirectory: string;
  private blacklistedPaths: Set<string>;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFolderFiles: number = 1000;

  constructor(workingDir?: string);
  public getToolDefinitions(): ToolDefinition[];
  public async executeTool(toolName: string, input: any): Promise<ToolResult>;
  private async readFolder(params: any): Promise<ToolResult>;
  private async readFile(params: any): Promise<ToolResult>;
  private resolvePath(userPath: string): string;
  private isPathAllowed(absolutePath: string): boolean;
  private isTextFile(filePath: string): boolean;
  private initializeBlacklist(): Set<string>;
  public setWorkingDirectory(dir: string): void;
  public getWorkingDirectory(): string;
}
```

## Reference

```typescript
// src-electron/services/file-tools.service.ts

export class FileToolsService {
  private workingDirectory: string;
  private blacklistedPaths: Set<string>;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFolderFiles: number = 1000;

  constructor(workingDir?: string) {
    this.workingDirectory = workingDir || process.cwd();
    this.blacklistedPaths = this.initializeBlacklist();
  }

  public getToolDefinitions(): ToolDefinition[] {
    return [
      {
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
      },
      {
        name: 'read_file',
        description:
          'Read the contents of a text file from the local filesystem. Supports encoding options and line ranges for large files.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
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
          required: ['path'],
        },
      },
    ];
  }

  public async executeTool(toolName: string, input: any): Promise<ToolResult> {
    log.info(`[FileTools] Executing: ${toolName}`, { input });

    try {
      switch (toolName) {
        case 'read_folder':
          return await this.readFolder(input);
        case 'read_file':
          return await this.readFile(input);
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      log.error(`[FileTools] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async readFolder(params: any): Promise<ToolResult> {
    const {
      path: userPath,
      recursive = false,
      max_depth = 3,
      include_hidden = false,
      filter_extensions,
    } = params;

    const resolvedPath = this.resolvePath(userPath);

    // Security check
    if (!this.isPathAllowed(resolvedPath)) {
      return {
        success: false,
        error: `ACCESS_DENIED: Path is restricted for security reasons`,
      };
    }

    // Check existence
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `PATH_NOT_FOUND: '${userPath}' does not exist`,
      };
    }

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

  private async readFile(params: any): Promise<ToolResult> {
    const { path: userPath, encoding = 'utf-8', start_line, end_line } = params;

    const resolvedPath = this.resolvePath(userPath);

    // Security check
    if (!this.isPathAllowed(resolvedPath)) {
      return {
        success: false,
        error: `ACCESS_DENIED: Path is restricted for security reasons`,
      };
    }

    // Check existence
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `FILE_NOT_FOUND: '${userPath}' does not exist`,
      };
    }

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

    // Read file
    let content = await fs.promises.readFile(resolvedPath, encoding);
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

  private async readDirectoryRecursive(
    dirPath: string,
    recursive: boolean,
    maxDepth: number,
    includeHidden: boolean,
    filterExtensions?: string[],
    currentDepth: number = 0,
  ): Promise<any[]> {
    const entries: any[] = [];
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (!includeHidden && item.name.startsWith('.')) continue;

      const itemPath = path.join(dirPath, item.name);
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

  private resolvePath(userPath: string): string {
    if (userPath.startsWith('~')) {
      userPath = path.join(app.getPath('home'), userPath.slice(1));
    }
    if (!path.isAbsolute(userPath)) {
      userPath = path.resolve(this.workingDirectory, userPath);
    }
    return path.normalize(userPath);
  }

  private isPathAllowed(absolutePath: string): boolean {
    for (const blacklisted of this.blacklistedPaths) {
      if (absolutePath.startsWith(blacklisted)) {
        return false;
      }
    }
    return true;
  }

  private isTextFile(filePath: string): boolean {
    const textExts = new Set([
      '.txt',
      '.md',
      '.json',
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

  public setWorkingDirectory(dir: string): void {
    this.workingDirectory = dir;
  }

  public getWorkingDirectory(): string {
    return this.workingDirectory;
  }
}
```

## Priority

Priority 1
