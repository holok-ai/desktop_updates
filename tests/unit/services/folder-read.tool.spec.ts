import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolContext } from '../../../src-electron/services/tool-calling/tools/base-tool';
import type { ToolExecutionContext } from '../../../src-electron/services/tool-calling/orchestrator-types';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  promises: {
    stat: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: fsMocks,
  existsSync: fsMocks.existsSync,
  promises: fsMocks.promises,
}));

import { FolderReadTool } from '../../../src-electron/services/tool-calling/tools/folder-read.tool';

describe('FolderReadTool', () => {
  let tool: FolderReadTool;
  let mockContext: ToolContext;
  let executionContext: ToolExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      service: {
        resolvePath: vi.fn((p: string, workingDir: string) => {
          if (p.startsWith('/')) return p;
          return `${workingDir}/${p}`;
        }),
        checkPathAccess: vi.fn(() => ({ allowed: true })),
        getMaxFolderFiles: vi.fn(() => 1000),
        readDirectoryRecursive: vi.fn(async () => []),
      } as any,
    };

    tool = new FolderReadTool(mockContext);

    executionContext = {
      workingDirectory: '/test/working/dir',
      threadId: 'thread-1',
      branchId: 'branch-1',
    };
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('read_folder');
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('read_folder');
      expect(definition.input_schema.type).toBe('object');
      expect(definition.input_schema.properties).toHaveProperty('path');
      expect(definition.input_schema.required).toContain('path');
    });
  });

  describe('execute', () => {
    describe('access control', () => {
      it('should return blacklist error when path is in a system-protected directory', async () => {
        (mockContext.service.checkPathAccess as any).mockReturnValue({
          allowed: false,
          reason: 'blacklist',
        });

        const result = await tool.execute({ path: '/etc/secrets' }, executionContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('ACCESS_DENIED (system blacklist)');
        expect(result.error).toContain('cannot be overridden');
      });

      it('should return whitelist error when path is not in allowed folders', async () => {
        (mockContext.service.checkPathAccess as any).mockReturnValue({
          allowed: false,
          reason: 'whitelist',
        });

        const result = await tool.execute(
          { path: '/Users/peterbaxter/Documents/samples' },
          executionContext,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('ACCESS_DENIED (not in whitelist)');
        expect(result.error).toContain('Settings');
      });

      it('should succeed when path passes access check', async () => {
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.promises.stat.mockResolvedValue({ isDirectory: () => true });

        const result = await tool.execute(
          { path: '/Users/peterbaxter/Documents/samples' },
          executionContext,
        );

        expect(result.success).toBe(true);
        expect(mockContext.service.checkPathAccess).toHaveBeenCalledWith(
          '/Users/peterbaxter/Documents/samples',
        );
      });
    });

    describe('path resolution', () => {
      it('should resolve relative path against working directory', async () => {
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.promises.stat.mockResolvedValue({ isDirectory: () => true });

        await tool.execute({ path: './my-folder' }, executionContext);

        expect(mockContext.service.resolvePath).toHaveBeenCalledWith(
          './my-folder',
          '/test/working/dir',
        );
      });

      it('should pass absolute path through unchanged', async () => {
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.promises.stat.mockResolvedValue({ isDirectory: () => true });

        await tool.execute({ path: '/absolute/folder' }, executionContext);

        expect(mockContext.service.resolvePath).toHaveBeenCalledWith(
          '/absolute/folder',
          '/test/working/dir',
        );
      });
    });

    describe('existence and type checks', () => {
      it('should return error when path does not exist', async () => {
        fsMocks.existsSync.mockReturnValue(false);

        const result = await tool.execute({ path: '/nonexistent/folder' }, executionContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('PATH_NOT_FOUND');
      });

      it('should return error when path is a file not a directory', async () => {
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.promises.stat.mockResolvedValue({ isDirectory: () => false });

        const result = await tool.execute({ path: '/some/file.txt' }, executionContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('NOT_A_DIRECTORY');
      });
    });

    describe('file limit', () => {
      it('should return error when folder exceeds max file count', async () => {
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.promises.stat.mockResolvedValue({ isDirectory: () => true });
        (mockContext.service.getMaxFolderFiles as any).mockReturnValue(5);
        (mockContext.service.readDirectoryRecursive as any).mockResolvedValue(
          Array.from({ length: 6 }, (_, i) => ({ name: `file${i}.txt`, type: 'file' })),
        );

        const result = await tool.execute({ path: '/large/folder' }, executionContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('TOO_MANY_FILES');
      });
    });

    describe('successful read', () => {
      it('should return folder entries with counts', async () => {
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.promises.stat.mockResolvedValue({ isDirectory: () => true });
        (mockContext.service.readDirectoryRecursive as any).mockResolvedValue([
          { name: 'file1.txt', type: 'file' },
          { name: 'file2.md', type: 'file' },
          { name: 'subdir', type: 'directory' },
        ]);

        const result = await tool.execute({ path: '/some/folder' }, executionContext);

        expect(result.success).toBe(true);
        expect(result.data.total_files).toBe(2);
        expect(result.data.total_directories).toBe(1);
        expect(result.data.entries).toHaveLength(3);
      });

      it('should pass recursive and depth options to readDirectoryRecursive', async () => {
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.promises.stat.mockResolvedValue({ isDirectory: () => true });

        await tool.execute(
          { path: '/some/folder', recursive: true, max_depth: 5 },
          executionContext,
        );

        expect(mockContext.service.readDirectoryRecursive).toHaveBeenCalledWith(
          expect.any(String),
          true,
          5,
          false,
          undefined,
          0,
        );
      });
    });
  });
});
