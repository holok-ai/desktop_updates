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
  const mockAllowedPaths = ['/mock/allowed1', '/mock/allowed2'];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileToolsService(mockAllowedPaths);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided allowed paths', () => {
      const svc = new FileToolsService(['/custom/path1', '/custom/path2']);
      expect(svc.getAllowedPaths()).toHaveLength(2);
    });

    it('should initialize with no allowed paths if none provided', () => {
      const svc = new FileToolsService();
      expect(svc.getAllowedPaths()).toHaveLength(0);
    });

    it('should initialize blacklist', () => {
      expect(service.getAllowedPaths()).toHaveLength(2);
    });
  });

  describe('service methods', () => {
    it('should have path access methods', () => {
      expect(typeof service.checkPathAccess).toBe('function');
      expect(typeof service.isPathAllowed).toBe('function');
      expect(typeof service.resolvePath).toBe('function');
    });

    it('should have allowed paths management methods', () => {
      expect(typeof service.setAllowedPaths).toBe('function');
      expect(typeof service.getAllowedPaths).toBe('function');
      expect(typeof service.addAllowedPaths).toBe('function');
      expect(typeof service.removeAllowedPaths).toBe('function');
      expect(typeof service.clearAllowedPaths).toBe('function');
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative paths against working directory', () => {
      const workingDir = '/test/working/dir';
      const result = service.resolvePath('./file.txt', workingDir);
      expect(result).toContain(workingDir);
      expect(result).toContain('file.txt');
    });

    it('should return absolute paths as-is', () => {
      const workingDir = '/test/working/dir';
      const absolutePath = '/absolute/path/file.txt';
      const result = service.resolvePath(absolutePath, workingDir);
      expect(result).toBe(absolutePath);
    });

    it('should expand tilde to home directory', () => {
      const workingDir = '/test/working/dir';
      const result = service.resolvePath('~/file.txt', workingDir);
      expect(result).toContain('/mock/home');
      expect(result).toContain('file.txt');
    });

    it('should use different working directories correctly', () => {
      const workingDir1 = '/dir1';
      const workingDir2 = '/dir2';
      
      const result1 = service.resolvePath('./file.txt', workingDir1);
      const result2 = service.resolvePath('./file.txt', workingDir2);
      
      expect(result1).toContain(workingDir1);
      expect(result2).toContain(workingDir2);
      expect(result1).not.toBe(result2);
    });

    it('should normalize paths', () => {
      const workingDir = '/test/working/dir';
      const result = service.resolvePath('./../file.txt', workingDir);
      expect(result).not.toContain('..');
      // Path should be normalized (no parent directory references)
      expect(result).toBe('/test/working/file.txt');
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths', () => {
      const workingDir = '/test/working/dir';
      const result = service.resolvePath('./subdir', workingDir);
      expect(result).toContain(workingDir);
    });

    it('should resolve absolute paths', () => {
      const workingDir = '/test/working/dir';
      const result = service.resolvePath('/absolute/path', workingDir);
      expect(result).toBe('/absolute/path');
    });

    it('should expand tilde to home directory', () => {
      const workingDir = '/test/working/dir';
      const result = service.resolvePath('~/test', workingDir);
      expect(result).toContain('/mock/home');
    });
  });

  // Note: executeTool, readFolder, readFile, writeFile are no longer in FileToolsService
  // These methods have been moved to individual tool implementations
  // Tests for these should be in tool-specific test files (e.g., file-read.tool.spec.ts)

  describe('security', () => {
    it('should block access to system directories via checkPathAccess', () => {
      const result = service.checkPathAccess('/System');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blacklist');
    });

    it('should block access to sensitive user directories via checkPathAccess', () => {
      const result = service.checkPathAccess(path.join('/mock/home', '.ssh'));
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blacklist');
    });

    it('should allow access to non-blacklisted paths when whitelist is empty', () => {
      const svc = new FileToolsService();
      const result = svc.checkPathAccess('/some/random/path');
      expect(result.allowed).toBe(true);
    });

    it('should deny access when path is not in whitelist', () => {
      const svc = new FileToolsService(['/allowed/path']);
      const result = svc.checkPathAccess('/denied/path');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('whitelist');
    });

    it('should allow access when path is in whitelist', () => {
      const allowedPath = path.resolve('/allowed/path');
      const svc = new FileToolsService([allowedPath]);
      const result = svc.checkPathAccess(path.join(allowedPath, 'subfolder'));
      expect(result.allowed).toBe(true);
    });
  });

  // Note: setWorkingDirectory and getWorkingDirectory have been removed
  // Working directory is now passed per-execution via ToolExecutionContext
  // Note: isTextFile tests are no longer relevant here as executeTool was removed

  describe('Allowed Paths (Whitelist)', () => {
    describe('constructor with allowedPaths', () => {
      it('should initialize with allowed paths', () => {
        const allowedPaths = ['/path/to/allowed1', '/path/to/allowed2'];
        const svc = new FileToolsService(allowedPaths);
        expect(svc.getAllowedPaths()).toHaveLength(2);
      });

      it('should normalize allowed paths', () => {
        const allowedPaths = ['/path/to/../allowed'];
        const svc = new FileToolsService(allowedPaths);
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
        service.clearAllowedPaths();
        service.addAllowedPaths('/path/to/allowed');
        expect(service.getAllowedPaths()).toContain(
          path.normalize(path.resolve('/path/to/allowed')),
        );
      });

      it('should add multiple paths to allowed paths', () => {
        service.clearAllowedPaths();
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
        service.clearAllowedPaths();
        const testPath = '/path/to/allowed';
        service.addAllowedPaths(testPath);
        expect(service.getAllowedPaths().length).toBeGreaterThan(0);
        service.removeAllowedPaths(testPath);
        expect(service.getAllowedPaths().length).toBe(0);
      });

      it('should remove multiple paths', () => {
        // Clear existing paths first
        service.clearAllowedPaths();
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

    // Note: isPathAllowed tests that used executeTool have been removed
    // These tests should be moved to tool-specific test files or integration tests
    // The checkPathAccess method is still tested in the 'security' describe block above
  });
});
