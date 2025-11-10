import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Attachment } from '../../../src-shared/types/attachment.types';

const handlers = new Map<string, (...args: any[]) => any>();
const sentEvents: Array<{ channel: string; args: unknown[] }> = [];

// Mock Electron IPC
vi.mock('electron', () => {
  const ipcMain = {
    handle: (channel: string, fn: (...args: any[]) => any) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
    __invoke: async (channel: string, ...args: any[]) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`No handler for ${channel}`);
      return await fn({}, ...args);
    },
  } as any;

  const BrowserWindow = {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
        },
      },
    ],
  } as any;

  // @ts-ignore
  globalThis.__mock_ipcMain = ipcMain;

  return { ipcMain, BrowserWindow };
});

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock FileStorageService
const mockFileStorageService = {
  saveFile: vi.fn(),
  getFile: vi.fn(),
  deleteFile: vi.fn(),
  deleteThreadFiles: vi.fn(),
  fileExists: vi.fn(),
  getFileSize: vi.fn(),
  getFilePath: vi.fn(),
};

vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: mockFileStorageService,
}));

// Mock FileValidationService
const mockFileValidationService = {
  validate: vi.fn(),
  isAllowedType: vi.fn(),
  isAllowedSize: vi.fn(),
  sanitizeFilename: vi.fn(),
  getMaxFileSize: vi.fn(),
  getAllowedFileTypes: vi.fn(),
  getAllowedTypesDescription: vi.fn(),
};

vi.mock('../../../src-electron/services/file-validation.service', () => ({
  fileValidationService: mockFileValidationService,
}));

describe('File IPC Handlers - Integration', () => {
  const mockThreadId = 'thread-123';
  const mockFileId = '12345678-1234-1234-1234-123456789abc';
  const mockFilename = 'test.jpg';
  const mockMimeType = 'image/jpeg';
  const mockFileBuffer = Buffer.from('fake image data');
  const mockAttachment: Attachment = {
    id: mockFileId,
    filename: mockFilename,
    mimeType: mockMimeType,
    size: mockFileBuffer.length,
    uploadedAt: Date.now(),
    status: 'success',
    localPath: `/path/to/${mockFileId}.jpg`,
  };

  beforeEach(async () => {
    handlers.clear();
    sentEvents.length = 0;
    vi.clearAllMocks();

    // Default mock behaviors
    mockFileValidationService.validate.mockReturnValue({ valid: true });
    mockFileValidationService.sanitizeFilename.mockImplementation((fn) => fn); // Return as-is by default
    mockFileStorageService.saveFile.mockResolvedValue(mockAttachment);
    mockFileStorageService.getFile.mockResolvedValue(mockFileBuffer);
    mockFileStorageService.deleteFile.mockResolvedValue(true);

    // Import and register handlers after mocks are set up
    const { registerFileHandlers } = await import(
      '../../../src-electron/ipc-handlers/file-handler'
    );
    registerFileHandlers();
  });

  afterEach(() => {
    handlers.clear();
    vi.clearAllMocks();
  });

  describe('file:upload', () => {
    it('should upload file successfully', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        filename: mockFilename,
        mimeType: mockMimeType,
      });

      expect(result.success).toBe(true);
      expect(result.attachment).toMatchObject({
        id: mockFileId,
        filename: mockFilename,
        mimeType: mockMimeType,
        size: mockFileBuffer.length,
        status: 'success',
      });

      expect(mockFileValidationService.validate).toHaveBeenCalledWith(
        mockFilename,
        mockMimeType,
        mockFileBuffer.length,
      );
      expect(mockFileStorageService.saveFile).toHaveBeenCalledWith(
        mockThreadId,
        mockFileBuffer,
        mockFilename,
        mockMimeType,
      );
    });

    it('should reject upload if validation fails', async () => {
      mockFileValidationService.validate.mockReturnValue({
        valid: false,
        error: 'File type not allowed',
        code: 'INVALID_TYPE',
      });

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        filename: 'malware.exe',
        mimeType: 'application/x-msdownload',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File type not allowed');
      expect(mockFileStorageService.saveFile).not.toHaveBeenCalled();
    });

    it('should handle missing required parameters', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      // Missing threadId
      let result = await ipcMain.__invoke('file:upload', {
        fileBuffer: mockFileBuffer,
        filename: mockFilename,
        mimeType: mockMimeType,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');

      // Missing fileBuffer
      result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        filename: mockFilename,
        mimeType: mockMimeType,
      });
      expect(result.success).toBe(false);

      // Missing filename
      result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        mimeType: mockMimeType,
      });
      expect(result.success).toBe(false);

      // Missing mimeType
      result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        filename: mockFilename,
      });
      expect(result.success).toBe(false);
    });

    it('should handle storage service errors', async () => {
      mockFileStorageService.saveFile.mockRejectedValue(new Error('Disk full'));

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        filename: mockFilename,
        mimeType: mockMimeType,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');
    });

    it('should reject files exceeding size limit', async () => {
      mockFileValidationService.validate.mockReturnValue({
        valid: false,
        error: 'File too large (max 5.00MB)',
        code: 'FILE_TOO_LARGE',
      });

      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: largeBuffer,
        filename: 'huge.jpg',
        mimeType: mockMimeType,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should sanitize filename before upload', async () => {
      const maliciousFilename = '../../../etc/passwd.txt';

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        filename: maliciousFilename,
        mimeType: 'text/plain',
      });

      expect(mockFileValidationService.validate).toHaveBeenCalledWith(
        maliciousFilename,
        'text/plain',
        mockFileBuffer.length,
      );
    });
  });

  describe('file:get', () => {
    it('should retrieve file successfully', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:get', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(true);
      expect(result.buffer).toEqual(mockFileBuffer);
      expect(mockFileStorageService.getFile).toHaveBeenCalledWith(mockThreadId, mockFileId);
    });

    it('should return error if file not found', async () => {
      mockFileStorageService.getFile.mockResolvedValue(null);

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:get', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle missing parameters', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      // Missing threadId
      let result = await ipcMain.__invoke('file:get', {
        fileId: mockFileId,
      });
      expect(result.success).toBe(false);

      // Missing fileId
      result = await ipcMain.__invoke('file:get', {
        threadId: mockThreadId,
      });
      expect(result.success).toBe(false);
    });

    it('should handle storage service errors', async () => {
      mockFileStorageService.getFile.mockRejectedValue(new Error('Access denied'));

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:get', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('file:delete', () => {
    it('should delete file successfully', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:delete', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(true);
      expect(mockFileStorageService.deleteFile).toHaveBeenCalledWith(mockThreadId, mockFileId);
    });

    it('should return error if file not found', async () => {
      mockFileStorageService.deleteFile.mockResolvedValue(false);

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:delete', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle missing parameters', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      // Missing threadId
      let result = await ipcMain.__invoke('file:delete', {
        fileId: mockFileId,
      });
      expect(result.success).toBe(false);

      // Missing fileId
      result = await ipcMain.__invoke('file:delete', {
        threadId: mockThreadId,
      });
      expect(result.success).toBe(false);
    });

    it('should handle storage service errors', async () => {
      mockFileStorageService.deleteFile.mockRejectedValue(new Error('Permission denied'));

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:delete', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('file:validate', () => {
    it('should validate file successfully', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:validate', {
        filename: mockFilename,
        mimeType: mockMimeType,
        size: 1024,
      });

      expect(result.valid).toBe(true);
      expect(mockFileValidationService.validate).toHaveBeenCalledWith(
        mockFilename,
        mockMimeType,
        1024,
      );
    });

    it('should return validation errors', async () => {
      mockFileValidationService.validate.mockReturnValue({
        valid: false,
        error: 'File type not allowed',
        code: 'INVALID_TYPE',
      });

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:validate', {
        filename: 'script.js',
        mimeType: 'application/javascript',
        size: 1024,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    it('should handle missing parameters', async () => {
      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      // Missing filename
      let result = await ipcMain.__invoke('file:validate', {
        mimeType: mockMimeType,
        size: 1024,
      });
      expect(result.valid).toBe(false);

      // Missing mimeType
      result = await ipcMain.__invoke('file:validate', {
        filename: mockFilename,
        size: 1024,
      });
      expect(result.valid).toBe(false);

      // Missing size
      result = await ipcMain.__invoke('file:validate', {
        filename: mockFilename,
        mimeType: mockMimeType,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('handler registration', () => {
    it('should register all file handlers', () => {
      expect(handlers.has('file:upload')).toBe(true);
      expect(handlers.has('file:get')).toBe(true);
      expect(handlers.has('file:delete')).toBe(true);
      expect(handlers.has('file:validate')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should catch and handle unexpected errors in upload', async () => {
      mockFileValidationService.validate.mockImplementation(() => {
        throw new Error('Unexpected validation error');
      });

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        filename: mockFilename,
        mimeType: mockMimeType,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should catch and handle unexpected errors in get', async () => {
      mockFileStorageService.getFile.mockImplementation(() => {
        throw new Error('Unexpected storage error');
      });

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:get', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should catch and handle unexpected errors in delete', async () => {
      mockFileStorageService.deleteFile.mockImplementation(() => {
        throw new Error('Unexpected delete error');
      });

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:delete', {
        threadId: mockThreadId,
        fileId: mockFileId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle empty file buffer', async () => {
      const emptyBuffer = Buffer.from([]);

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      const result = await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: emptyBuffer,
        filename: 'empty.txt',
        mimeType: 'text/plain',
      });

      // Validation service should be called with size 0
      expect(mockFileValidationService.validate).toHaveBeenCalledWith('empty.txt', 'text/plain', 0);
    });

    it('should handle special characters in thread ID', async () => {
      const specialThreadId = 'thread-with-special_chars-123';

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      await ipcMain.__invoke('file:upload', {
        threadId: specialThreadId,
        fileBuffer: mockFileBuffer,
        filename: mockFilename,
        mimeType: mockMimeType,
      });

      expect(mockFileStorageService.saveFile).toHaveBeenCalledWith(
        specialThreadId,
        mockFileBuffer,
        mockFilename,
        mockMimeType,
      );
    });

    it('should handle very long filenames', async () => {
      const longFilename = 'a'.repeat(200) + '.jpg';

      // @ts-ignore
      const ipcMain = globalThis.__mock_ipcMain;

      await ipcMain.__invoke('file:upload', {
        threadId: mockThreadId,
        fileBuffer: mockFileBuffer,
        filename: longFilename,
        mimeType: mockMimeType,
      });

      expect(mockFileValidationService.validate).toHaveBeenCalledWith(
        longFilename,
        mockMimeType,
        mockFileBuffer.length,
      );
    });
  });
});
