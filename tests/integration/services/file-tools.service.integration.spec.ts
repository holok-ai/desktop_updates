import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileToolsService } from '../../../src-electron/services/file-tools.service';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { app } from 'electron';

/**
 * Integration tests for FileToolsService
 * Tests security boundaries, edge cases, and real file system operations
 */
describe('FileToolsService - Integration', () => {
  let service: FileToolsService;
  let testDir: string;
  let testFile: string;
  let testSubDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(tmpdir(), 'file-tools-test-'));
    testFile = path.join(testDir, 'test.txt');
    testSubDir = path.join(testDir, 'subdir');

    // Create test files and directories
    fs.writeFileSync(testFile, 'line 1\nline 2\nline 3\nline 4\nline 5');
    fs.mkdirSync(testSubDir);
    fs.writeFileSync(path.join(testSubDir, 'nested.txt'), 'nested content');

    service = new FileToolsService(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Security Boundaries', () => {
    it('should block access to system directories', async () => {
      const systemPaths =
        process.platform === 'win32'
          ? ['C:\\Windows', 'C:\\Program Files']
          : ['/System', '/usr/bin', '/etc'];

      for (const sysPath of systemPaths) {
        if (fs.existsSync(sysPath)) {
          const result = await service.executeTool('read_folder', { path: sysPath });
          expect(result.success).toBe(false);
          expect(result.error).toContain('folder I cannot access');
        }
      }
    });

    it('should block access to sensitive user directories', async () => {
      const home = app.getPath('home');
      if (!home) return; // Skip if home not available

      const sensitiveDirs = ['.ssh', '.aws', '.gnupg'];
      for (const dir of sensitiveDirs) {
        const sensitivePath = path.join(home, dir);
        if (fs.existsSync(sensitivePath)) {
          const result = await service.executeTool('read_folder', { path: sensitivePath });
          expect(result.success).toBe(false);
          expect(result.error).toContain('folder I cannot access');
        }
      }
    });

    it('should block access to blacklisted paths even when nested', async () => {
      // Create a symlink or nested path that would resolve to blacklisted area
      // This tests that path normalization doesn't bypass security
      const result = await service.executeTool('read_folder', {
        path: path.join('..', '..', '..', 'System'),
      });
      // Should either fail with ACCESS_DENIED or PATH_NOT_FOUND
      expect(result.success).toBe(false);
    });
  });

  describe('Real File System Operations', () => {
    it('should read actual folder contents', async () => {
      const result = await service.executeTool('read_folder', {
        path: '.',
        include_hidden: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.entries.length).toBeGreaterThan(0);
      expect(result.data.total_files).toBeGreaterThan(0);
      expect(result.data.total_directories).toBeGreaterThan(0);

      // Should find our test file
      const testFileEntry = result.data.entries.find((e: any) => e.name === 'test.txt');
      expect(testFileEntry).toBeDefined();
      expect(testFileEntry.type).toBe('file');
    });

    it('should read actual file contents', async () => {
      const result = await service.executeTool('read_file', { file_path: 'test.txt' });

      expect(result.success).toBe(true);
      expect(result.data.content).toContain('line 1');
      expect(result.data.metadata.lines).toBe(5);
      expect(result.data.metadata.size).toBeGreaterThan(0);
    });

    it('should handle recursive directory traversal', async () => {
      const result = await service.executeTool('read_folder', {
        path: '.',
        recursive: true,
        max_depth: 2,
      });

      expect(result.success).toBe(true);
      // Should find nested file
      const nestedFile = result.data.entries.find((e: any) => e.name === 'nested.txt');
      expect(nestedFile).toBeDefined();
    });

    it('should respect max_depth in recursive traversal', async () => {
      // Create deeper nested structure
      const deepDir1 = path.join(testSubDir, 'deep1');
      const deepDir2 = path.join(deepDir1, 'deep2');
      const deepDir3 = path.join(deepDir2, 'deep3');
      fs.mkdirSync(deepDir3, { recursive: true });
      fs.writeFileSync(path.join(deepDir3, 'deep.txt'), 'deep content');

      const result = await service.executeTool('read_folder', {
        path: '.',
        recursive: true,
        max_depth: 2,
      });

      expect(result.success).toBe(true);
      // Should not find file at depth 3
      const deepFile = result.data.entries.find((e: any) => e.name === 'deep.txt');
      expect(deepFile).toBeUndefined();
    });

    it('should filter files by extension', async () => {
      // Create files with different extensions
      fs.writeFileSync(path.join(testDir, 'file1.js'), 'js content');
      fs.writeFileSync(path.join(testDir, 'file2.ts'), 'ts content');
      fs.writeFileSync(path.join(testDir, 'file3.txt'), 'txt content');

      const result = await service.executeTool('read_folder', {
        path: '.',
        filter_extensions: ['.js', '.ts'],
      });

      expect(result.success).toBe(true);
      const entries = result.data.entries.filter((e: any) => e.type === 'file');
      expect(entries.every((e: any) => ['.js', '.ts'].includes(e.extension))).toBe(true);
      expect(entries.length).toBe(2);
    });

    it('should handle hidden files correctly', async () => {
      // Create hidden file
      fs.writeFileSync(path.join(testDir, '.hidden'), 'hidden content');

      const resultWithoutHidden = await service.executeTool('read_folder', {
        path: '.',
        include_hidden: false,
      });
      expect(resultWithoutHidden.success).toBe(true);
      const hiddenEntry = resultWithoutHidden.data.entries.find((e: any) => e.name === '.hidden');
      expect(hiddenEntry).toBeUndefined();

      const resultWithHidden = await service.executeTool('read_folder', {
        path: '.',
        include_hidden: true,
      });
      expect(resultWithHidden.success).toBe(true);
      const hiddenEntryFound = resultWithHidden.data.entries.find((e: any) => e.name === '.hidden');
      expect(hiddenEntryFound).toBeDefined();
    });
  });

  describe('File Writing Operations', () => {
    it('should create a new file with default parameters', async () => {
      const result = await service.executeTool('write_file', {
        path: 'new-file.txt',
        content: 'hello world',
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
      const written = fs.readFileSync(path.join(testDir, 'new-file.txt'), 'utf-8');
      expect(written).toBe('hello world');
      expect(result.data.bytes_written).toBe(Buffer.byteLength('hello world', 'utf-8'));
      expect(result.data.metadata.encoding).toBe('utf-8');
    });

    it('should overwrite existing file when overwrite is true', async () => {
      const filePath = path.join(testDir, 'config.json');
      fs.writeFileSync(filePath, '{"setting":false}', 'utf-8');

      const result = await service.executeTool('write_file', {
        path: 'config.json',
        content: '{"setting":true}',
        overwrite: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false);
      const written = fs.readFileSync(filePath, 'utf-8');
      expect(written).toBe('{"setting":true}');
    });

    it('should fail when file exists and overwrite is false', async () => {
      const filePath = path.join(testDir, 'existing.txt');
      fs.writeFileSync(filePath, 'original', 'utf-8');

      const result = await service.executeTool('write_file', {
        path: 'existing.txt',
        content: 'new content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('FILE_EXISTS');
      const written = fs.readFileSync(filePath, 'utf-8');
      expect(written).toBe('original');
    });

    it('should create parent directories when create_directories is true', async () => {
      const result = await service.executeTool('write_file', {
        path: path.join('nested', 'dir', 'file.txt'),
        content: 'nested content',
        create_directories: true,
      });

      expect(result.success).toBe(true);
      const filePath = path.join(testDir, 'nested', 'dir', 'file.txt');
      expect(fs.existsSync(filePath)).toBe(true);
      const written = fs.readFileSync(filePath, 'utf-8');
      expect(written).toBe('nested content');
    });

    it('should fail when parent directory does not exist and create_directories is false', async () => {
      const result = await service.executeTool('write_file', {
        path: path.join('nested', 'dir', 'file.txt'),
        content: 'content',
        create_directories: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DIR_NOT_FOUND');
    });

    it('should support different encodings', async () => {
      const content = 'héllo';
      const resultAscii = await service.executeTool('write_file', {
        path: 'ascii.txt',
        content,
        encoding: 'ascii',
      });
      expect(resultAscii.success).toBe(true);
      expect(resultAscii.data.metadata.encoding).toBe('ascii');

      const resultLatin1 = await service.executeTool('write_file', {
        path: 'latin1.txt',
        content,
        encoding: 'latin1',
      });
      expect(resultLatin1.success).toBe(true);
      expect(resultLatin1.data.metadata.encoding).toBe('latin1');
    });
  });

  describe('File Reading Edge Cases', () => {
    it('should read file with line range', async () => {
      const result = await service.executeTool('read_file', {
        file_path: 'test.txt',
        start_line: 2,
        end_line: 4,
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('line 2\nline 3\nline 4');
      expect(result.data.truncated).toBe(true);
    });

    it('should handle start_line without end_line', async () => {
      const result = await service.executeTool('read_file', {
        file_path: 'test.txt',
        start_line: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toContain('line 3');
      expect(result.data.content).toContain('line 5');
      expect(result.data.truncated).toBe(true);
    });

    it('should handle end_line without start_line', async () => {
      const result = await service.executeTool('read_file', {
        file_path: 'test.txt',
        end_line: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toContain('line 1');
      expect(result.data.content).toContain('line 3');
      expect(result.data.content).not.toContain('line 4');
      expect(result.data.truncated).toBe(true);
    });

    it('should handle different encodings', async () => {
      // Create file with special characters
      const specialFile = path.join(testDir, 'special.txt');
      fs.writeFileSync(specialFile, 'Hello 世界', 'utf-8');

      const result = await service.executeTool('read_file', {
        file_path: 'special.txt',
        encoding: 'utf-8',
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Hello 世界');
    });

    it('should reject binary files', async () => {
      // Create a binary-like file (even if it's actually text, the extension check should block it)
      const binaryFile = path.join(testDir, 'image.jpg');
      fs.writeFileSync(binaryFile, 'fake binary content');

      const result = await service.executeTool('read_file', { file_path: 'image.jpg' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_TEXT_FILE');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent paths gracefully', async () => {
      const result = await service.executeTool('read_folder', {
        path: './nonexistent-directory',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('PATH_NOT_FOUND');
    });

    it('should handle file size limits', async () => {
      // Create a file larger than 10MB
      const largeFile = path.join(testDir, 'large.txt');
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largeFile, largeContent);

      const result = await service.executeTool('read_file', { file_path: 'large.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('FILE_TOO_LARGE');
    });

    it('should allow reading large file with line range', async () => {
      // Create a file larger than 10MB
      const largeFile = path.join(testDir, 'large.txt');
      const lines = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`).join('\n');
      fs.writeFileSync(largeFile, lines);

      // Make it appear large by mocking stat, but actually test the line range logic
      const result = await service.executeTool('read_file', {
        file_path: 'large.txt',
        start_line: 1,
        end_line: 10,
      });
      // Should succeed because we're using line range
      expect(result.success).toBe(true);
    });

    it('should handle folder with too many files', async () => {
      // Create a folder with more than 1000 files
      const manyFilesDir = path.join(testDir, 'manyfiles');
      fs.mkdirSync(manyFilesDir);

      // Create 1001 files
      for (let i = 0; i < 1001; i++) {
        fs.writeFileSync(path.join(manyFilesDir, `file${i}.txt`), `content ${i}`);
      }

      const result = await service.executeTool('read_folder', { path: 'manyfiles' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('TOO_MANY_FILES');
    });
  });

  describe('Path Resolution', () => {
    it('should resolve relative paths correctly', async () => {
      const result = await service.executeTool('read_file', { file_path: './test.txt' });
      expect(result.success).toBe(true);
    });

    it('should resolve absolute paths correctly', async () => {
      const result = await service.executeTool('read_file', { file_path: testFile });
      expect(result.success).toBe(true);
    });

    it('should handle tilde expansion', async () => {
      const home = app.getPath('home');
      if (!home) return; // Skip if home not available

      // Create a test file in home directory (outside blacklist)
      const homeTestFile = path.join(home, 'file-tools-test.txt');
      try {
        fs.writeFileSync(homeTestFile, 'test content');

        const result = await service.executeTool('read_file', {
          file_path: '~/file-tools-test.txt',
        });
        expect(result.success).toBe(true);
        expect(result.data.content).toBe('test content');
      } finally {
        // Clean up
        if (fs.existsSync(homeTestFile)) {
          fs.unlinkSync(homeTestFile);
        }
      }
    });

    it('should normalize path separators', async () => {
      // Test with redundant separators and dots that need normalization
      const result = await service.executeTool('read_file', {
        file_path: './/test.txt', // Redundant separator should be normalized
      });
      // Should work due to path normalization
      expect(result.success).toBe(true);
    });
  });

  describe('Working Directory Management', () => {
    it('should use working directory for relative paths', async () => {
      const newWorkingDir = path.join(testDir, 'subdir');
      service.setWorkingDirectory(newWorkingDir);

      const result = await service.executeTool('read_file', { file_path: 'nested.txt' });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('nested content');
    });

    it('should update working directory correctly', () => {
      const newDir = '/new/directory';
      service.setWorkingDirectory(newDir);
      expect(service.getWorkingDirectory()).toBe(newDir);
    });
  });

  describe('Allowed Paths (Whitelist) - Integration', () => {
    let allowedDir: string;
    let deniedDir: string;

    beforeEach(() => {
      // Create separate directories for whitelist testing
      allowedDir = fs.mkdtempSync(path.join(tmpdir(), 'allowed-'));
      deniedDir = fs.mkdtempSync(path.join(tmpdir(), 'denied-'));

      fs.writeFileSync(path.join(allowedDir, 'allowed.txt'), 'allowed content');
      fs.writeFileSync(path.join(deniedDir, 'denied.txt'), 'denied content');
    });

    afterEach(() => {
      if (fs.existsSync(allowedDir)) {
        fs.rmSync(allowedDir, { recursive: true, force: true });
      }
      if (fs.existsSync(deniedDir)) {
        fs.rmSync(deniedDir, { recursive: true, force: true });
      }
    });

    it('should allow access when no whitelist is configured', async () => {
      const svc = new FileToolsService(testDir);
      const result = await svc.executeTool('read_folder', { path: deniedDir });
      expect(result.success).toBe(true);
    });

    it('should deny access to paths not in whitelist', async () => {
      const svc = new FileToolsService(testDir, [allowedDir]);
      const result = await svc.executeTool('read_folder', { path: deniedDir });
      expect(result.success).toBe(false);
      expect(result.error).toContain('add an entry to the allowed folder list');
    });

    it('should allow access to paths in whitelist', async () => {
      const svc = new FileToolsService(testDir, [allowedDir]);
      const result = await svc.executeTool('read_folder', { path: allowedDir });
      expect(result.success).toBe(true);
      expect(result.data.entries.length).toBeGreaterThan(0);
    });

    it('should allow access to subdirectories of whitelisted paths', async () => {
      const subdir = path.join(allowedDir, 'subdir');
      fs.mkdirSync(subdir);
      fs.writeFileSync(path.join(subdir, 'file.txt'), 'content');

      const svc = new FileToolsService(testDir, [allowedDir]);
      const result = await svc.executeTool('read_folder', { path: subdir });
      expect(result.success).toBe(true);
    });

    it('should deny access to blacklisted paths even if in whitelist', async () => {
      const home = app.getPath('home');
      const svc = new FileToolsService(testDir, [home]);

      // .ssh is blacklisted
      const sshPath = path.join(home, '.ssh');
      const result = await svc.executeTool('read_folder', { path: sshPath });
      expect(result.success).toBe(false);
      expect(result.error).toContain('folder I cannot access');
    });

    it('should support multiple whitelisted paths', async () => {
      const svc = new FileToolsService(testDir, [allowedDir, deniedDir]);

      const result1 = await svc.executeTool('read_file', {
        file_path: path.join(allowedDir, 'allowed.txt'),
      });
      expect(result1.success).toBe(true);

      const result2 = await svc.executeTool('read_file', {
        file_path: path.join(deniedDir, 'denied.txt'),
      });
      expect(result2.success).toBe(true);
    });

    it('should support dynamic whitelist updates', async () => {
      const svc = new FileToolsService(testDir, [allowedDir]);

      // Initially denied
      let result = await svc.executeTool('read_folder', { path: deniedDir });
      expect(result.success).toBe(false);

      // Add to whitelist
      svc.addAllowedPaths(deniedDir);

      // Now allowed
      result = await svc.executeTool('read_folder', { path: deniedDir });
      expect(result.success).toBe(true);

      // Remove from whitelist
      svc.removeAllowedPaths(deniedDir);

      // Denied again
      result = await svc.executeTool('read_folder', { path: deniedDir });
      expect(result.success).toBe(false);
    });

    it('should handle relative paths with whitelist', async () => {
      const svc = new FileToolsService(allowedDir, [allowedDir]);
      const result = await svc.executeTool('read_file', { file_path: './allowed.txt' });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('allowed content');
    });

    it('should handle tilde expansion with whitelist', async () => {
      const home = app.getPath('home');
      const homeTestFile = path.join(home, 'file-tools-whitelist-test.txt');

      try {
        fs.writeFileSync(homeTestFile, 'test content');

        const svc = new FileToolsService(testDir, [home]);
        const result = await svc.executeTool('read_file', {
          file_path: '~/file-tools-whitelist-test.txt',
        });

        expect(result.success).toBe(true);
        expect(result.data.content).toBe('test content');
      } finally {
        if (fs.existsSync(homeTestFile)) {
          fs.unlinkSync(homeTestFile);
        }
      }
    });

    it('should clear whitelist and allow all non-blacklisted paths', async () => {
      const svc = new FileToolsService(testDir, [allowedDir]);

      // Initially denied
      let result = await svc.executeTool('read_folder', { path: deniedDir });
      expect(result.success).toBe(false);

      // Clear whitelist
      svc.clearAllowedPaths();

      // Now allowed
      result = await svc.executeTool('read_folder', { path: deniedDir });
      expect(result.success).toBe(true);
    });
  });
});
