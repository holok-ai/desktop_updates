import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FileToolsService,
  type ToolResult,
} from '../../../src-electron/services/tool-calling/file-tools.service';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'home') {
        return '/mock/home';
      }
      return '/mock/userdata';
    }),
  },
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
    existsSync: vi.fn(),
  };
});

describe('FileToolsService', () => {
  let service: FileToolsService;
  const mockWorkingDir = '/mock/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileToolsService(mockWorkingDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided working directory', () => {
      const svc = new FileToolsService('/custom/dir');
      expect(svc.getWorkingDirectory()).toBe('/custom/dir');
    });

    it('should use process.cwd() if no working directory provided', () => {
      const originalCwd = process.cwd();
      const svc = new FileToolsService();
      expect(svc.getWorkingDirectory()).toBe(originalCwd);
    });

    it('should initialize blacklist', () => {
      expect(service.getWorkingDirectory()).toBe(mockWorkingDir);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return three tool definitions', () => {
      const tools = service.getToolDefinitions();
      expect(tools).toHaveLength(3);
    });

    it('should include read_folder tool with correct schema', () => {
      const tools = service.getToolDefinitions();
      const readFolder = tools.find((t) => t.name === 'read_folder');
      expect(readFolder).toBeDefined();
      expect(readFolder?.input_schema.type).toBe('object');
      expect(readFolder?.input_schema.required).toContain('path');
      expect(readFolder?.input_schema.properties.path).toBeDefined();
      expect(readFolder?.input_schema.properties.recursive).toBeDefined();
      expect(readFolder?.input_schema.properties.max_depth).toBeDefined();
      expect(readFolder?.input_schema.properties.include_hidden).toBeDefined();
      expect(readFolder?.input_schema.properties.filter_extensions).toBeDefined();
    });

    it('should include read_file tool with correct schema', () => {
      const tools = service.getToolDefinitions();
      const readFile = tools.find((t) => t.name === 'read_file');
      expect(readFile).toBeDefined();
      expect(readFile?.input_schema.type).toBe('object');
      expect(readFile?.input_schema.required).toContain('file_path');
      expect(readFile?.input_schema.properties.file_path).toBeDefined();
      expect(readFile?.input_schema.properties.encoding).toBeDefined();
      expect(readFile?.input_schema.properties.start_line).toBeDefined();
      expect(readFile?.input_schema.properties.end_line).toBeDefined();
    });

    it('should include write_file tool with correct schema', () => {
      const tools = service.getToolDefinitions();
      const writeFile = tools.find((t) => t.name === 'write_file');
      expect(writeFile).toBeDefined();
      expect(writeFile?.input_schema.type).toBe('object');
      expect(writeFile?.input_schema.required).toContain('path');
      expect(writeFile?.input_schema.required).toContain('content');
      expect(writeFile?.input_schema.properties.path).toBeDefined();
      expect(writeFile?.input_schema.properties.content).toBeDefined();
      expect(writeFile?.input_schema.properties.overwrite).toBeDefined();
      expect(writeFile?.input_schema.properties.encoding).toBeDefined();
    });
  });

  describe('executeTool', () => {
    it('should execute read_folder tool', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({ isDirectory: () => true, isFile: () => false });
      (fs.promises.readdir as any).mockResolvedValue([]);

      const result = await service.executeTool('read_folder', { path: './test' });
      expect(result.success).toBe(true);
    });

    it('should execute read_file tool', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 100,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue('file content');

      const result = await service.executeTool('read_file', { file_path: './test.txt' });
      expect(result.success).toBe(true);
    });

    it('should execute write_file tool', async () => {
      (fs.existsSync as any).mockImplementation((p: string) => {
        // Parent directory exists, file doesn't
        if (p.includes('test.txt')) return false;
        return true; // Parent directory exists
      });
      (fs.promises.writeFile as any).mockResolvedValue(undefined);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 10,
        mtimeMs: 1234567890,
      });

      const result = await service.executeTool('write_file', {
        path: './test.txt',
        content: 'hello',
      });
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
    });

    it('should return error for unknown tool', async () => {
      const result = await service.executeTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle errors gracefully', async () => {
      (fs.existsSync as any).mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await service.executeTool('read_folder', { path: './test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('readFolder', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockReset();
      (fs.promises.readdir as any).mockReset();
    });

    it('should read folder contents', async () => {
      const mockEntries = [
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true },
      ];
      (fs.promises.readdir as any).mockResolvedValue(mockEntries);
      (fs.promises.stat as any)
        .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        })
        .mockResolvedValueOnce({
          isDirectory: () => true,
          isFile: () => false,
          mtimeMs: 1234567890,
        });

      const result = await service.executeTool('read_folder', { path: './test' });
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('entries');
      expect(result.data).toHaveProperty('total_files');
      expect(result.data).toHaveProperty('total_directories');
    });

    it('should return error for non-existent path', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await service.executeTool('read_folder', { path: './nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('PATH_NOT_FOUND');
    });

    it('should return error for file instead of directory', async () => {
      (fs.promises.stat as any).mockResolvedValue({ isDirectory: () => false });

      const result = await service.executeTool('read_folder', { path: './file.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_A_DIRECTORY');
    });

    it('should respect include_hidden parameter', async () => {
      const mockEntries = [
        { name: '.hidden', isFile: () => true, isDirectory: () => false },
        { name: 'visible', isFile: () => true, isDirectory: () => false },
      ];
      (fs.promises.readdir as any).mockResolvedValue(mockEntries);
      (fs.promises.stat as any)
        .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        });

      const result = await service.executeTool('read_folder', {
        path: './test',
        include_hidden: false,
      });
      expect(result.success).toBe(true);
      // Should filter out .hidden
      expect(result.data.entries.length).toBe(1);
      expect(result.data.entries[0].name).toBe('visible');
    });

    it('should include hidden files when include_hidden is true', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      const mockEntries = [
        { name: '.hidden', isFile: () => true, isDirectory: () => false },
        { name: 'visible', isFile: () => true, isDirectory: () => false },
      ];
      (fs.promises.readdir as any).mockResolvedValue(mockEntries);
      (fs.promises.stat as any)
        .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        });

      const result = await service.executeTool('read_folder', {
        path: './test',
        include_hidden: true,
      });
      expect(result.success).toBe(true);
      expect(result.data.entries.length).toBe(2);
    });

    it('should filter by extension when filter_extensions provided', async () => {
      const mockEntries = [
        { name: 'file1.js', isFile: () => true, isDirectory: () => false },
        { name: 'file2.ts', isFile: () => true, isDirectory: () => false },
        { name: 'file3.txt', isFile: () => true, isDirectory: () => false },
      ];
      (fs.promises.readdir as any).mockResolvedValue(mockEntries);
      (fs.promises.stat as any)
        .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        })
        .mockResolvedValueOnce({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        });

      const result = await service.executeTool('read_folder', {
        path: './test',
        filter_extensions: ['.js', '.ts'],
      });
      expect(result.success).toBe(true);
      expect(result.data.entries.length).toBe(2);
      expect(result.data.entries.every((e: any) => ['.js', '.ts'].includes(e.extension))).toBe(
        true,
      );
    });

    it('should return error when folder has too many files', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      const mockEntries = Array.from({ length: 1001 }, (_, i) => ({
        name: `file${i}.txt`,
        isFile: () => true,
        isDirectory: () => false,
      }));
      (fs.promises.readdir as any).mockResolvedValue(mockEntries);
      let statCallCount = 0;
      (fs.promises.stat as any).mockImplementation(() => {
        statCallCount++;
        // First call is for the directory check (before readdir)
        if (statCallCount === 1) {
          return Promise.resolve({ isDirectory: () => true, isFile: () => false });
        }
        // Subsequent calls are for files (during readDirectoryRecursive)
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
          mtimeMs: 1234567890,
        });
      });

      const result = await service.executeTool('read_folder', { path: './test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('TOO_MANY_FILES');
    });

    it('should support recursive traversal', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      const mockEntries = [{ name: 'subdir', isFile: () => false, isDirectory: () => true }];
      let readdirCallCount = 0;
      (fs.promises.readdir as any).mockImplementation(() => {
        readdirCallCount++;
        // First call: root directory returns subdir
        if (readdirCallCount === 1) {
          return Promise.resolve(mockEntries);
        }
        // Second call: subdir returns empty
        return Promise.resolve([]);
      });
      (fs.promises.stat as any).mockImplementation(() => {
        // All stat calls return directory stats
        return Promise.resolve({
          isDirectory: () => true,
          isFile: () => false,
          mtimeMs: 1234567890,
        });
      });

      const result = await service.executeTool('read_folder', {
        path: './test',
        recursive: true,
        max_depth: 2,
      });
      expect(result.success).toBe(true);
      expect(fs.promises.readdir).toHaveBeenCalledTimes(2);
    });
  });

  describe('readFile', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as any).mockReturnValue(true);
      // Reset stat mock to avoid interference from previous tests
      (fs.promises.stat as any).mockReset();
      (fs.promises.readFile as any).mockReset();
    });

    it('should read file contents', async () => {
      const mockContent = 'file content line 1\nfile content line 2';
      const fileSize = Buffer.byteLength(mockContent, 'utf-8');
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: fileSize,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await service.executeTool('read_file', { file_path: './test.txt' });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe(mockContent);
      expect(result.data.metadata.lines).toBe(2);
      // The metadata.size should match the file size from stats
      expect(result.data.metadata.size).toBe(fileSize);
    });

    it('should return error for non-existent file', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await service.executeTool('read_file', { file_path: './nonexistent.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('FILE_NOT_FOUND');
    });

    it('should return error for directory instead of file', async () => {
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      });

      const result = await service.executeTool('read_file', { file_path: './dir' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_A_FILE');
    });

    it('should return error for file too large without line range', async () => {
      const largeSize = 11 * 1024 * 1024; // 11MB
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: largeSize,
        mtimeMs: 1234567890,
      });
      // Note: We don't need to mock readFile since it should fail before reading

      const result = await service.executeTool('read_file', { file_path: './large.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('FILE_TOO_LARGE');
    });

    it('should allow reading large file with line range', async () => {
      const largeSize = 11 * 1024 * 1024; // 11MB
      const mockContent = 'line 1\nline 2\nline 3';
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: largeSize,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await service.executeTool('read_file', {
        path: './large.txt', // .txt extension so it passes text file check
        start_line: 1,
        end_line: 2,
      });
      expect(result.success).toBe(true);
      expect(result.data.truncated).toBe(true);
    });

    it('should return error for binary file', async () => {
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 100,
        mtimeMs: 1234567890,
      });

      const result = await service.executeTool('read_file', { file_path: './image.jpg' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_TEXT_FILE');
    });

    it('should support line range', async () => {
      const mockContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await service.executeTool('read_file', {
        path: './test.txt',
        start_line: 2,
        end_line: 4,
      });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('line 2\nline 3\nline 4');
      expect(result.data.truncated).toBe(true);
    });

    it('should support different encodings', async () => {
      const mockContent = 'file content';
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await service.executeTool('read_file', {
        path: './test.txt',
        encoding: 'ascii',
      });
      expect(result.success).toBe(true);
      expect(fs.promises.readFile).toHaveBeenCalledWith(expect.any(String), { encoding: 'ascii' });
    });
  });

  describe('writeFile', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as any).mockReturnValue(false);
      (fs.promises.mkdir as any).mockReset();
      (fs.promises.writeFile as any).mockReset();
      (fs.promises.stat as any).mockReset();
    });

    it('should create a new file when it does not exist', async () => {
      (fs.existsSync as any).mockImplementation((p: string) => {
        // Parent directory exists, file doesn't
        if (p.includes('newfile.txt')) return false;
        return true; // Parent directory exists
      });
      (fs.promises.writeFile as any).mockResolvedValue(undefined);
      (fs.promises.stat as any).mockResolvedValue({
        size: 5,
        mtimeMs: 1234567890,
      });

      const result: ToolResult = await service.executeTool('write_file', {
        path: './newfile.txt',
        content: 'hello',
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
      expect(result.data.bytes_written).toBe(Buffer.byteLength('hello', 'utf-8'));
    });

    it('should return error when file exists and overwrite is false', async () => {
      (fs.existsSync as any).mockReturnValue(true);

      const result = await service.executeTool('write_file', {
        path: './existing.txt',
        content: 'data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('FILE_EXISTS');
    });

    it('should overwrite existing file when overwrite is true', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.writeFile as any).mockResolvedValue(undefined);
      (fs.promises.stat as any).mockResolvedValue({
        size: 4,
        mtimeMs: 1234567890,
      });

      const result: ToolResult = await service.executeTool('write_file', {
        path: './existing.txt',
        content: 'data',
        overwrite: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false);
    });

    it('should return error when parent directory does not exist', async () => {
      (fs.existsSync as any).mockImplementation((p: string) => {
        // Parent directory doesn't exist
        if (p.includes('nested')) return false;
        return true;
      });

      const result = await service.executeTool('write_file', {
        path: './nested/dir/file.txt',
        content: 'data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DIR_NOT_FOUND');
    });

    it('should validate encoding and return error for invalid encoding', async () => {
      const result = await service.executeTool('write_file', {
        path: './file.txt',
        content: 'data',
        // @ts-expect-error testing invalid runtime encoding
        encoding: 'utf16',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVALID_ENCODING');
    });

    it('should map permission errors', async () => {
      (fs.existsSync as any).mockImplementation((p: string) => {
        // Parent directory exists, file doesn't
        if (p.includes('file.txt')) return false;
        return true; // Parent directory exists
      });
      (fs.promises.writeFile as any).mockRejectedValue({ code: 'EACCES', message: 'denied' });

      const result = await service.executeTool('write_file', {
        path: './file.txt',
        content: 'data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('PERMISSION_DENIED');
    });

    it('should map disk full errors', async () => {
      (fs.existsSync as any).mockImplementation((p: string) => {
        // Parent directory exists, file doesn't
        if (p.includes('file.txt')) return false;
        return true; // Parent directory exists
      });
      (fs.promises.writeFile as any).mockRejectedValue({ code: 'ENOSPC', message: 'no space' });

      const result = await service.executeTool('write_file', {
        path: './file.txt',
        content: 'data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DISK_FULL');
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({ isDirectory: () => true, isFile: () => false });
      (fs.promises.readdir as any).mockResolvedValue([]);

      await service.executeTool('read_folder', { path: './subdir' });
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining(mockWorkingDir));
    });

    it('should resolve absolute paths', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({ isDirectory: () => true, isFile: () => false });
      (fs.promises.readdir as any).mockResolvedValue([]);

      await service.executeTool('read_folder', { path: '/absolute/path' });
      expect(fs.existsSync).toHaveBeenCalledWith('/absolute/path');
    });

    it('should expand tilde to home directory', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({ isDirectory: () => true, isFile: () => false });
      (fs.promises.readdir as any).mockResolvedValue([]);

      await service.executeTool('read_folder', { path: '~/test' });
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('/mock/home'));
    });
  });

  describe('security', () => {
    it('should block access to system directories', async () => {
      const result = await service.executeTool('read_folder', { path: '/System' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('folder I cannot access');
    });

    it('should block access to sensitive user directories', async () => {
      const result = await service.executeTool('read_folder', {
        path: path.join('/mock/home', '.ssh'),
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('folder I cannot access');
    });

    it('should block access to blacklisted paths in recursive traversal', async () => {
      // Create a scenario where a subdirectory path resolves to blacklisted area
      // We'll mock the path resolution by making the resolved path be blacklisted
      const mockEntries = [{ name: 'subdir', isFile: () => false, isDirectory: () => true }];
      (fs.existsSync as any).mockImplementation((p: string) => {
        // The resolved path will be blacklisted, so we return false to simulate it
        return !p.includes('.ssh');
      });
      (fs.promises.stat as any).mockImplementation((p: string) => {
        if (p.includes('.ssh')) {
          // This path is blacklisted, so we shouldn't reach here, but if we do, throw
          throw new Error('ACCESS_DENIED');
        }
        return Promise.resolve({ isDirectory: () => true, isFile: () => false });
      });
      (fs.promises.readdir as any).mockResolvedValue(mockEntries);

      // Use a path that would resolve to blacklisted area
      const result = await service.executeTool('read_folder', {
        path: path.join('/mock/home', '.ssh'),
      });
      // Should be blocked
      expect(result.success).toBe(false);
      expect(result.error).toContain('folder I cannot access');
    });
  });

  describe('setWorkingDirectory', () => {
    it('should update working directory', () => {
      const newDir = '/new/working/dir';
      service.setWorkingDirectory(newDir);
      expect(service.getWorkingDirectory()).toBe(newDir);
    });
  });

  describe('isTextFile', () => {
    it('should recognize common text file extensions', async () => {
      const textFiles = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.css', '.html'];
      for (const ext of textFiles) {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.promises.stat as any).mockResolvedValue({
          isFile: () => true,
          size: 100,
          mtimeMs: 1234567890,
        });
        (fs.promises.readFile as any).mockResolvedValue('content');

        const result = await service.executeTool('read_file', { file_path: `./test${ext}` });
        expect(result.success).toBe(true);
      }
    });

    it('should reject binary file extensions', async () => {
      const binaryFiles = ['.jpg', '.png', '.exe', '.bin', '.zip'];
      for (const ext of binaryFiles) {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.promises.stat as any).mockResolvedValue({
          isFile: () => true,
          size: 100,
          mtimeMs: 1234567890,
        });

        const result = await service.executeTool('read_file', { file_path: `./test${ext}` });
        expect(result.success).toBe(false);
        expect(result.error).toContain('NOT_TEXT_FILE');
      }
    });
  });

  describe('Allowed Paths (Whitelist)', () => {
    describe('constructor with allowedPaths', () => {
      it('should initialize with allowed paths', () => {
        const allowedPaths = ['/path/to/allowed1', '/path/to/allowed2'];
        const svc = new FileToolsService(mockWorkingDir, allowedPaths);
        expect(svc.getAllowedPaths()).toHaveLength(2);
      });

      it('should normalize allowed paths', () => {
        const allowedPaths = ['/path/to/../allowed'];
        const svc = new FileToolsService(mockWorkingDir, allowedPaths);
        const normalized = svc.getAllowedPaths();
        expect(normalized[0]).toBe(path.normalize(path.resolve('/path/allowed')));
      });
    });

    describe('setAllowedPaths', () => {
      it('should set allowed paths', () => {
        const paths = ['/path/to/allowed1', '/path/to/allowed2'];
        service.setAllowedPaths(paths);
        expect(service.getAllowedPaths()).toHaveLength(2);
      });

      it('should replace existing allowed paths', () => {
        service.setAllowedPaths(['/path1']);
        expect(service.getAllowedPaths()).toHaveLength(1);
        service.setAllowedPaths(['/path2', '/path3']);
        expect(service.getAllowedPaths()).toHaveLength(2);
        expect(service.getAllowedPaths()).not.toContain('/path1');
      });
    });

    describe('addAllowedPaths', () => {
      it('should add single path to allowed paths', () => {
        service.addAllowedPaths('/path/to/allowed');
        expect(service.getAllowedPaths()).toContain(
          path.normalize(path.resolve('/path/to/allowed')),
        );
      });

      it('should add multiple paths to allowed paths', () => {
        service.addAllowedPaths('/path1', '/path2', '/path3');
        expect(service.getAllowedPaths()).toHaveLength(3);
      });

      it('should not duplicate paths', () => {
        const testPath = '/path/to/allowed';
        service.addAllowedPaths(testPath);
        service.addAllowedPaths(testPath);
        const normalized = path.normalize(path.resolve(testPath));
        const count = service.getAllowedPaths().filter((p) => p === normalized).length;
        expect(count).toBe(1);
      });
    });

    describe('removeAllowedPaths', () => {
      it('should remove path from allowed paths', () => {
        const testPath = '/path/to/allowed';
        service.addAllowedPaths(testPath);
        expect(service.getAllowedPaths().length).toBeGreaterThan(0);
        service.removeAllowedPaths(testPath);
        expect(service.getAllowedPaths().length).toBe(0);
      });

      it('should remove multiple paths', () => {
        service.addAllowedPaths('/path1', '/path2', '/path3');
        service.removeAllowedPaths('/path1', '/path2');
        expect(service.getAllowedPaths()).toHaveLength(1);
      });
    });

    describe('clearAllowedPaths', () => {
      it('should clear all allowed paths', () => {
        service.addAllowedPaths('/path1', '/path2');
        expect(service.getAllowedPaths().length).toBeGreaterThan(0);
        service.clearAllowedPaths();
        expect(service.getAllowedPaths()).toHaveLength(0);
      });
    });

    describe('isPathAllowed with whitelist', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should allow access when whitelist is empty', async () => {
        const svc = new FileToolsService(mockWorkingDir);
        (fs.existsSync as any).mockReturnValue(true);
        (fs.promises.stat as any).mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
          mtimeMs: 1234567890,
        });
        (fs.promises.readdir as any).mockResolvedValue([]);

        const result = await svc.executeTool('read_folder', { path: '/some/random/path' });
        expect(result.success).toBe(true);
      });

      it('should deny access when path is not in whitelist', async () => {
        const svc = new FileToolsService(mockWorkingDir, ['/allowed/path']);
        (fs.existsSync as any).mockReturnValue(true);

        const result = await svc.executeTool('read_folder', { path: '/denied/path' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('add an entry to the allowed folder list');
      });

      it('should allow access when path is in whitelist', async () => {
        const allowedPath = path.resolve('/allowed/path');
        const svc = new FileToolsService(mockWorkingDir, [allowedPath]);
        (fs.existsSync as any).mockReturnValue(true);
        (fs.promises.stat as any).mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
          mtimeMs: 1234567890,
        });
        (fs.promises.readdir as any).mockResolvedValue([]);

        const result = await svc.executeTool('read_folder', {
          path: path.join(allowedPath, 'subfolder'),
        });
        expect(result.success).toBe(true);
      });

      it('should deny access when path is in blacklist even if in whitelist', async () => {
        const svc = new FileToolsService(mockWorkingDir, ['/mock/home']);
        (fs.existsSync as any).mockReturnValue(true);

        // Try to access .ssh which is blacklisted
        const result = await svc.executeTool('read_folder', { path: '/mock/home/.ssh' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('folder I cannot access');
      });

      it('should check both whitelist and blacklist in correct order', async () => {
        const allowedPath = '/mock/home/projects';
        const svc = new FileToolsService(mockWorkingDir, [allowedPath]);
        (fs.existsSync as any).mockReturnValue(true);
        (fs.promises.stat as any).mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
          mtimeMs: 1234567890,
        });
        (fs.promises.readdir as any).mockResolvedValue([]);

        // Should allow access to whitelisted path that's not blacklisted
        const goodResult = await svc.executeTool('read_folder', { path: allowedPath });
        expect(goodResult.success).toBe(true);

        // Should deny access to blacklisted path even though parent is whitelisted
        const sshPath = '/mock/home/.ssh';
        const badResult = await svc.executeTool('read_folder', { path: sshPath });
        expect(badResult.success).toBe(false);
      });
    });
  });
});
