import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileStorageService } from '../../../src-electron/services/file-storage.service';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userdata'),
  },
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
      stat: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

describe('FileStorageService', () => {
  let service: FileStorageService;
  const mockThreadId = 'thread-123';
  const mockFileId = '12345678-1234-1234-1234-123456789abc';
  const mockFilename = 'test.jpg';
  const mockMimeType = 'image/jpeg';
  const mockBuffer = Buffer.from('fake image data');

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    (fs.existsSync as any).mockReturnValue(false);
    (fs.mkdirSync as any).mockReturnValue(undefined);
    service = new FileStorageService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct storage path', () => {
      expect(app.getPath).toHaveBeenCalledWith('userData');
      const expectedPath = path.join('/mock/userdata', 'holokai', 'desktop', 'attachments');
      // Service should create base directory on initialization
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should create base storage directory if it does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      new FileStorageService();
      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('saveFile()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as any).mockReturnValue(true);
    });

    it('should save file and return attachment metadata', async () => {
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(mockThreadId, mockBuffer, mockFilename, mockMimeType);

      expect(result).toMatchObject({
        id: expect.any(String),
        filename: mockFilename,
        mimeType: mockMimeType,
        size: mockBuffer.length,
        uploadedAt: expect.any(Number),
        status: 'success',
        localPath: expect.stringContaining(mockThreadId),
      });

      expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.jpg'),
        mockBuffer,
      );
    });

    it('should generate unique file IDs', async () => {
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result1 = await service.saveFile(mockThreadId, mockBuffer, mockFilename, mockMimeType);
      const result2 = await service.saveFile(mockThreadId, mockBuffer, mockFilename, mockMimeType);

      expect(result1.id).not.toBe(result2.id);
    });

    it('should preserve file extension from filename', async () => {
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(mockThreadId, mockBuffer, 'photo.png', 'image/png');

      expect(result.localPath).toContain('.png');
    });

    it('should use MIME type for extension if filename has no extension', async () => {
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(mockThreadId, mockBuffer, 'noextension', 'image/jpeg');

      expect(result.localPath).toContain('.jpg');
    });

    it('should create thread directory if it does not exist', async () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      await service.saveFile(mockThreadId, mockBuffer, mockFilename, mockMimeType);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(mockThreadId),
        expect.objectContaining({ recursive: true }),
      );
    });

    it('should throw error if file write fails', async () => {
      const error = new Error('Disk full');
      (fs.promises.writeFile as any).mockRejectedValue(error);

      await expect(
        service.saveFile(mockThreadId, mockBuffer, mockFilename, mockMimeType),
      ).rejects.toThrow('Failed to save file');
    });

    it('should handle various file types', async () => {
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const fileTypes = [
        { name: 'document.pdf', mime: 'application/pdf' },
        { name: 'data.json', mime: 'application/json' },
        { name: 'sheet.csv', mime: 'text/csv' },
        { name: 'text.txt', mime: 'text/plain' },
      ];

      for (const { name, mime } of fileTypes) {
        const result = await service.saveFile(mockThreadId, mockBuffer, name, mime);
        expect(result.mimeType).toBe(mime);
        expect(result.filename).toBe(name);
      }
    });
  });

  describe('getFile()', () => {
    it('should retrieve file by ID', async () => {
      const mockFileContent = Buffer.from('file content');
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([`${mockFileId}.jpg`]);
      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await service.getFile(mockThreadId, mockFileId);

      expect(result).toEqual(mockFileContent);
      expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
    });

    it('should return null if file not found', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await service.getFile(mockThreadId, mockFileId);

      expect(result).toBeNull();
    });

    it('should return null if thread directory does not exist', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await service.getFile(mockThreadId, mockFileId);

      expect(result).toBeNull();
    });

    it('should return null if file read fails', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([`${mockFileId}.jpg`]);
      (fs.promises.readFile as any).mockRejectedValue(new Error('Read error'));

      const result = await service.getFile(mockThreadId, mockFileId);

      expect(result).toBeNull();
    });

    it('should find file without knowing extension', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([
        'other-file.txt',
        `${mockFileId}.jpg`,
        'another-file.png',
      ]);
      (fs.promises.readFile as any).mockResolvedValue(Buffer.from('content'));

      const result = await service.getFile(mockThreadId, mockFileId);

      expect(result).not.toBeNull();
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining(`${mockFileId}.jpg`),
      );
    });
  });

  describe('deleteFile()', () => {
    it('should delete file and return true', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([`${mockFileId}.jpg`]);
      (fs.promises.unlink as any).mockResolvedValue(undefined);

      const result = await service.deleteFile(mockThreadId, mockFileId);

      expect(result).toBe(true);
      expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
      expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringContaining(`${mockFileId}.jpg`));
    });

    it('should return false if file not found', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await service.deleteFile(mockThreadId, mockFileId);

      expect(result).toBe(false);
      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should return false if delete fails', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([`${mockFileId}.jpg`]);
      (fs.promises.unlink as any).mockRejectedValue(new Error('Delete failed'));

      const result = await service.deleteFile(mockThreadId, mockFileId);

      expect(result).toBe(false);
    });
  });

  describe('deleteThreadFiles()', () => {
    it('should delete all files in thread directory', async () => {
      const mockFiles = ['file1.jpg', 'file2.png', 'file3.pdf'];
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.readdir as any).mockResolvedValue(mockFiles);
      (fs.promises.unlink as any).mockResolvedValue(undefined);
      (fs.promises.rmdir as any).mockResolvedValue(undefined);

      await service.deleteThreadFiles(mockThreadId);

      expect(fs.promises.unlink).toHaveBeenCalledTimes(mockFiles.length);
      expect(fs.promises.rmdir).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if thread directory does not exist', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      await service.deleteThreadFiles(mockThreadId);

      expect(fs.promises.readdir).not.toHaveBeenCalled();
      expect(fs.promises.unlink).not.toHaveBeenCalled();
      expect(fs.promises.rmdir).not.toHaveBeenCalled();
    });

    it('should handle empty thread directory', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.readdir as any).mockResolvedValue([]);
      (fs.promises.rmdir as any).mockResolvedValue(undefined);

      await service.deleteThreadFiles(mockThreadId);

      expect(fs.promises.unlink).not.toHaveBeenCalled();
      expect(fs.promises.rmdir).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.readdir as any).mockRejectedValue(new Error('Access denied'));

      // Should not throw
      await expect(service.deleteThreadFiles(mockThreadId)).resolves.toBeUndefined();
    });
  });

  describe('getFilePath()', () => {
    it('should return correct file path with extension', () => {
      const filePath = service.getFilePath(mockThreadId, mockFileId, '.jpg');

      expect(filePath).toContain(mockThreadId);
      expect(filePath).toContain(`${mockFileId}.jpg`);
      expect(filePath).toContain('attachments');
    });

    it('should return file path without extension', () => {
      const filePath = service.getFilePath(mockThreadId, mockFileId);

      expect(filePath).toContain(mockThreadId);
      expect(filePath).toContain(mockFileId);
    });
  });

  describe('fileExists()', () => {
    it('should return true if file exists', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([`${mockFileId}.jpg`]);

      const result = service.fileExists(mockThreadId, mockFileId);

      expect(result).toBe(true);
    });

    it('should return false if file does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = service.fileExists(mockThreadId, mockFileId);

      expect(result).toBe(false);
    });

    it('should return false if directory does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = service.fileExists(mockThreadId, mockFileId);

      expect(result).toBe(false);
    });
  });

  describe('getFileSize()', () => {
    it('should return file size', async () => {
      const mockSize = 12345;
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([`${mockFileId}.jpg`]);
      (fs.promises.stat as any).mockResolvedValue({ size: mockSize });

      const result = await service.getFileSize(mockThreadId, mockFileId);

      expect(result).toBe(mockSize);
    });

    it('should return null if file not found', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await service.getFileSize(mockThreadId, mockFileId);

      expect(result).toBeNull();
    });

    it('should return null if stat fails', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([`${mockFileId}.jpg`]);
      (fs.promises.stat as any).mockRejectedValue(new Error('Stat error'));

      const result = await service.getFileSize(mockThreadId, mockFileId);

      expect(result).toBeNull();
    });
  });

  describe('generateThumbnail()', () => {
    it('should return null (not implemented)', async () => {
      const result = await service.generateThumbnail('/some/path.jpg');

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in thread ID', async () => {
      const specialThreadId = 'thread-with-special_chars-123';
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(
        specialThreadId,
        mockBuffer,
        mockFilename,
        mockMimeType,
      );

      expect(result.localPath).toContain(specialThreadId);
    });

    it('should handle very long filenames', async () => {
      const longFilename = 'a'.repeat(200) + '.jpg';
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(mockThreadId, mockBuffer, longFilename, mockMimeType);

      expect(result.filename).toBe(longFilename);
    });

    it('should handle files with multiple extensions', async () => {
      const filename = 'archive.tar.gz';
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(mockThreadId, mockBuffer, filename, 'application/gzip');

      // Should use the last extension
      expect(result.localPath).toContain('.gz');
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.from([]);
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(mockThreadId, emptyBuffer, mockFilename, mockMimeType);

      expect(result.size).toBe(0);
    });

    it('should handle large buffers', async () => {
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.saveFile(mockThreadId, largeBuffer, mockFilename, mockMimeType);

      expect(result.size).toBe(largeBuffer.length);
    });
  });
});
