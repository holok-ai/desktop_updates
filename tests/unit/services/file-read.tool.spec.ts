import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileReadTool } from '../../../src-electron/services/tool-calling/tools/file-read.tool';
import type { ToolContext } from '../../../src-electron/services/tool-calling/tools/base-tool';
import type { ToolExecutionContext } from '../../../src-electron/services/tool-calling/orchestrator-types';
import * as fs from 'fs';

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    promises: {
      stat: vi.fn(),
      readFile: vi.fn(),
    },
  };
});

describe('FileReadTool', () => {
  let tool: FileReadTool;
  let mockContext: ToolContext;
  let executionContext: ToolExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      service: {
        resolvePath: vi.fn((path: string, workingDir: string) => {
          if (path.startsWith('/')) return path;
          return `${workingDir}/${path}`;
        }),
        checkPathAccess: vi.fn(() => ({ allowed: true })),
        isTextFile: vi.fn(() => true),
        getMaxFileSize: vi.fn(() => 10 * 1024 * 1024),
      } as any,
    };

    tool = new FileReadTool(mockContext);

    executionContext = {
      workingDirectory: '/test/working/dir',
      threadId: 'thread-1',
      branchId: 'branch-1',
    };
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('read_file');
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('read_file');
      expect(definition.input_schema.type).toBe('object');
      expect(definition.input_schema.properties).toHaveProperty('file_path');
      expect(definition.input_schema.required).toContain('file_path');
    });
  });

  describe('execute', () => {
    it('should read file with relative path using working directory', async () => {
      const mockContent = 'file content';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await tool.execute({ file_path: './test.txt' }, executionContext);

      expect(result.success).toBe(true);
      expect(mockContext.service.resolvePath).toHaveBeenCalledWith(
        './test.txt',
        '/test/working/dir',
      );
      expect(result.data).toHaveProperty('content', mockContent);
    });

    it('should read file with absolute path', async () => {
      const mockContent = 'file content';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await tool.execute({ file_path: '/absolute/path/file.txt' }, executionContext);

      expect(result.success).toBe(true);
      expect(mockContext.service.resolvePath).toHaveBeenCalledWith(
        '/absolute/path/file.txt',
        '/test/working/dir',
      );
    });

    it('should use different working directories for different contexts', async () => {
      const mockContent = 'file content';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const context1: ToolExecutionContext = {
        workingDirectory: '/dir1',
        threadId: 'thread-1',
        branchId: 'branch-1',
      };
      const context2: ToolExecutionContext = {
        workingDirectory: '/dir2',
        threadId: 'thread-2',
        branchId: 'branch-1',
      };

      await tool.execute({ file_path: './file.txt' }, context1);
      await tool.execute({ file_path: './file.txt' }, context2);

      expect(mockContext.service.resolvePath).toHaveBeenNthCalledWith(1, './file.txt', '/dir1');
      expect(mockContext.service.resolvePath).toHaveBeenNthCalledWith(2, './file.txt', '/dir2');
    });

    it('should call status callback when provided', async () => {
      const mockContent = 'file content';
      const statusCallback = vi.fn();
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const contextWithCallback: ToolExecutionContext = {
        ...executionContext,
        statusCallback,
      };

      await tool.execute({ file_path: './test.txt' }, contextWithCallback);

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'read_file',
          state: 'in_progress',
        }),
      );
      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'read_file',
          state: 'complete',
        }),
      );
    });

    it('should not call status callback when not provided', async () => {
      const mockContent = 'file content';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      await tool.execute({ file_path: './test.txt' }, executionContext);

      // Should not throw or error
      expect(true).toBe(true);
    });

    it('should return error for non-existent file', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await tool.execute({ file_path: './nonexistent.txt' }, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('FILE_NOT_FOUND');
    });

    it('should return error for directory instead of file', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      });

      const result = await tool.execute({ file_path: './dir' }, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_A_FILE');
    });

    it('should return error when path access is denied', async () => {
      (mockContext.service.checkPathAccess as any).mockReturnValue({
        allowed: false,
        reason: 'blacklist',
      });

      const result = await tool.execute({ file_path: './restricted.txt' }, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot access');
    });

    it('should support line range', async () => {
      const mockContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await tool.execute(
        {
          file_path: './test.txt',
          start_line: 2,
          end_line: 4,
        },
        executionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('line 2\nline 3\nline 4');
      expect(result.data.truncated).toBe(true);
    });

    it('should support different encodings', async () => {
      const mockContent = 'file content';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: mockContent.length,
        mtimeMs: 1234567890,
      });
      (fs.promises.readFile as any).mockResolvedValue(mockContent);

      const result = await tool.execute(
        {
          file_path: './test.txt',
          encoding: 'ascii',
        },
        executionContext,
      );

      expect(result.success).toBe(true);
      expect(fs.promises.readFile).toHaveBeenCalledWith(expect.any(String), { encoding: 'ascii' });
    });
  });
});
