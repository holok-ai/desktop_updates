import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  ThreadDTO,
  PagedResponse,
  CreateThreadRequest,
} from '../../../src-electron/services/mokuapi/thread.types';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Create mock instances with default return values
const mockAuthService = {
  getAccessToken: vi.fn().mockReturnValue('test-access-token'),
};

const mockSettingsService = {
  get: vi.fn().mockReturnValue('https://api-test.holok.ai'),
};

// Mock the auth and settings services
vi.mock('../../../src-electron/services/auth/auth.service.js', () => ({
  authService: mockAuthService,
}));

vi.mock('../../../src-electron/services/settings/settings.service.js', () => ({
  settingsService: mockSettingsService,
}));

// Import service and test helpers
const { threadApiService, __setDependenciesForTesting, __resetDependenciesForTesting } =
  await import('../../../src-electron/services/mokuapi/thread-api.service.js');

describe('ThreadApiService (unit)', () => {
  let fetchMock: any;

  beforeEach(() => {
    // Inject mock dependencies
    __setDependenciesForTesting(mockAuthService, mockSettingsService);

    // Reset fetch mock
    if (fetchMock) {
      fetchMock.mockReset();
    }
    fetchMock = vi.spyOn(globalThis as any, 'fetch');

    // Reset mock call counts but keep default implementations
    mockAuthService.getAccessToken.mockClear();
    mockSettingsService.get.mockClear();
  });

  afterEach(() => {
    __resetDependenciesForTesting();
    if (fetchMock) {
      fetchMock.mockRestore();
    }
  });

  describe('getThreads()', () => {
    it('should successfully fetch threads with filters', async () => {
      // Arrange
      const mockResponse: PagedResponse<ThreadDTO> = {
        content: [
          {
            id: 'thread-1',
            title: 'Test Thread 1',
            type: 'personal',
            ownerId: 'user-1',
            projectId: null,
            createdUserId: 'user-1',
            status: 'active',
            createdAt: '2024-01-01T10:00:00Z',
            updatedAt: '2024-01-01T10:00:00Z',
          },
          {
            id: 'thread-2',
            title: 'Test Thread 2',
            type: 'personal',
            ownerId: 'user-1',
            projectId: null,
            createdUserId: 'user-1',
            status: 'active',
            createdAt: '2024-01-01T11:00:00Z',
            updatedAt: '2024-01-01T11:00:00Z',
          },
        ],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
        first: true,
        last: true,
        hasNext: false,
        hasPrevious: false,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      const result = await threadApiService.getThreads({
        type: 'personal',
        page: 0,
        size: 20,
      });

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.content).toHaveLength(2);
      expect(result.content[0].title).toBe('Test Thread 1');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api-test.holok.ai/api/threads?type=personal&page=0&size=20',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should throw error when not authenticated', async () => {
      // Arrange
      mockAuthService.getAccessToken.mockReturnValueOnce(null);

      // Act & Assert
      await expect(threadApiService.getThreads()).rejects.toThrow(
        'Not authenticated. Please log in.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('createThread()', () => {
    it('should successfully create a new thread', async () => {
      // Arrange
      const createRequest: CreateThreadRequest = {
        title: 'New Test Thread',
        projectId: null,
        metadata: { description: 'Test description' },
      };

      const mockCreatedThread: ThreadDTO = {
        id: 'thread-new',
        title: 'New Test Thread',
        type: 'personal',
        ownerId: 'user-1',
        projectId: null,
        createdUserId: 'user-1',
        status: 'active',
        createdAt: '2024-01-02T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedThread,
      });

      // Act
      const result = await threadApiService.createThread(createRequest);

      // Assert
      expect(result).toEqual(mockCreatedThread);
      expect(result.id).toBe('thread-new');
      expect(result.title).toBe('New Test Thread');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api-test.holok.ai/api/threads',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createRequest),
        }),
      );
    });

    it('should throw error when API returns 401 unauthorized', async () => {
      // Arrange
      const createRequest: CreateThreadRequest = {
        title: 'New Thread',
        projectId: null,
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      // Act & Assert
      await expect(threadApiService.createThread(createRequest)).rejects.toThrow(
        'Authentication failed',
      );
    });
  });

  describe('getThread()', () => {
    it('should successfully fetch a single thread by ID', async () => {
      // Arrange
      const threadId = 'thread-123';
      const mockThread: ThreadDTO = {
        id: threadId,
        title: 'Fetched Thread',
        type: 'personal',
        ownerId: 'user-1',
        projectId: null,
        createdUserId: 'user-1',
        status: 'active',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockThread,
      });

      // Act
      const result = await threadApiService.getThread(threadId);

      // Assert
      expect(result).toEqual(mockThread);
      expect(result.id).toBe(threadId);
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api-test.holok.ai/api/threads/${threadId}`,
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should throw error when thread not found (404)', async () => {
      // Arrange
      const threadId = 'non-existent-thread';

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Thread not found',
      });

      // Act & Assert
      await expect(threadApiService.getThread(threadId)).rejects.toThrow('Thread not found');
    });
  });
});
