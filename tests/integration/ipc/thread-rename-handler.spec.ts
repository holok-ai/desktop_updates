import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock auth service
const mockAuthService = {
  isAuthenticated: vi.fn(() => true),
  getUser: vi.fn(() => ({ id: 'test-user-123', email: 'test@example.com' })),
};

// Mock event broadcasting
const sentEvents: Array<{ channel: string; args: unknown[] }> = [];

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

interface MockIpcMain {
  handle(channel: string, fn: IpcHandler): void;
  removeHandler(channel: string): void;
  __invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

vi.mock('electron', () => {
  const ipcMain: MockIpcMain = {
    handle: (channel: string, fn: IpcHandler) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
    __invoke: async (channel: string, ...args: unknown[]) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`No handler for ${channel}`);
      return await Promise.resolve(fn({}, ...args));
    },
  };

  (globalThis as any).__mock_ipcMain = ipcMain;

  const BrowserWindow = {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
        },
      },
    ],
  };

  const app = { getPath: () => '/tmp/test-threads' };
  return { ipcMain, BrowserWindow, app };
});

// Mock auth handler to provide getAuthService
vi.mock('src-electron/ipc-handlers/auth-handler', () => ({
  getAuthService: () => mockAuthService,
}));

// Import after mocks
import {
  registerThreadHandlers,
  unregisterThreadHandlers,
} from '../../../src-electron/ipc-handlers/thread-handler';
import { threadRepository } from '../../../src-electron/repository/thread-repository';

const ipcMain = (globalThis as any).__mock_ipcMain as MockIpcMain;

describe('IPC Integration: thread rename handlers', () => {
  beforeEach(() => {
    unregisterThreadHandlers();
    sentEvents.length = 0;
    handlers.clear();
    threadRepository.clearAll();
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getUser.mockReturnValue({ id: 'test-user-123', email: 'test@example.com' });
    registerThreadHandlers();
  });

  afterEach(() => {
    unregisterThreadHandlers();
    threadRepository.clearAll();
  });

  describe('thread:renameThread', () => {
    it('should rename thread successfully', async () => {
      // Create a thread
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original Title',
        description: 'Test thread',
        metadata: {},
      });

      sentEvents.length = 0; // Clear events from creation

      // Rename the thread
      const result: any = await ipcMain.__invoke('thread:renameThread', created.id, 'New Title');

      expect(result.success).toBe(true);
      expect(result.thread).toBeDefined();
      expect(result.thread.title).toBe('New Title');
      expect(result.thread.metadata.title).toBe('New Title');
    });

    it('should broadcast thread:updated event', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      sentEvents.length = 0;

      await ipcMain.__invoke('thread:renameThread', created.id, 'Updated');

      const updateEvent = sentEvents.find((e) => e.channel === 'thread:updated');
      expect(updateEvent).toBeDefined();
      expect((updateEvent!.args[0] as any).title).toBe('Updated');
    });

    it('should track title history', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'First',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke('thread:renameThread', created.id, 'Second');

      expect(result.thread.metadata.titleHistory).toBeDefined();
      expect(result.thread.metadata.titleHistory.length).toBe(1);
      expect(result.thread.metadata.titleHistory[0].previousTitle).toBe('First');
      expect(result.thread.metadata.titleHistory[0].title).toBe('Second');
    });

    it('should reject empty title', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke('thread:renameThread', created.id, '');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('empty');
      expect(result.code).toBe('TITLE_EMPTY');
    });

    it('should reject title over 200 characters', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      const longTitle = 'A'.repeat(201);
      const result: any = await ipcMain.__invoke('thread:renameThread', created.id, longTitle);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.code).toBe('TITLE_TOO_LONG');
    });

    it('should reject duplicate title', async () => {
      await ipcMain.__invoke('thread:create', {
        title: 'Existing Thread',
        description: '',
        metadata: {},
      });

      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Another Thread',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke(
        'thread:renameThread',
        created.id,
        'Existing Thread',
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.code).toBe('TITLE_DUPLICATE');
    });

    it('should allow same title (case-insensitive) if it matches current title', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original Title',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke(
        'thread:renameThread',
        created.id,
        'original title',
      );

      expect(result.success).toBe(true);
      expect(result.thread.title).toBe('original title');
    });

    it('should sanitize and trim title', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke(
        'thread:renameThread',
        created.id,
        '  New   Title  ',
      );

      expect(result.success).toBe(true);
      expect(result.thread.title).toBe('New Title');
    });

    it('should reject rename when not authenticated', async () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke('thread:renameThread', created.id, 'New Title');

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toBe('THREAD_ACCESS_DENIED');
    });

    it('should reject rename for non-existent thread', async () => {
      const result: any = await ipcMain.__invoke(
        'thread:renameThread',
        'non-existent-id',
        'New Title',
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toBe('THREAD_NOT_FOUND');
    });

    it('should reject rename when user does not own thread', async () => {
      // Create thread with specific userId
      const thread = threadRepository.createThread({
        title: 'Original',
        userId: 'other-user-456',
      });

      const result: any = await ipcMain.__invoke('thread:renameThread', thread.id, 'New Title');

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toBe('THREAD_ACCESS_DENIED');
    });

    it('should allow rename when user owns thread', async () => {
      // Create thread with current user's ID
      const thread = threadRepository.createThread({
        title: 'Original',
        userId: 'test-user-123',
      });

      const result: any = await ipcMain.__invoke('thread:renameThread', thread.id, 'New Title');

      expect(result.success).toBe(true);
      expect(result.thread.title).toBe('New Title');
    });

    it('should include userId in history entry', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke('thread:renameThread', created.id, 'Updated');

      expect(result.thread.metadata.titleHistory[0].userId).toBe('test-user-123');
    });

    it('should handle multiple sequential renames', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Title 1',
        description: '',
        metadata: {},
      });

      await ipcMain.__invoke('thread:renameThread', created.id, 'Title 2');
      await ipcMain.__invoke('thread:renameThread', created.id, 'Title 3');
      const result: any = await ipcMain.__invoke('thread:renameThread', created.id, 'Title 4');

      expect(result.success).toBe(true);
      expect(result.thread.title).toBe('Title 4');
      expect(result.thread.metadata.titleHistory.length).toBe(3);
    });
  });

  describe('thread:undoRename', () => {
    it('should undo rename successfully', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'First',
        description: '',
        metadata: {},
      });

      await ipcMain.__invoke('thread:renameThread', created.id, 'Second');
      sentEvents.length = 0;

      const result: any = await ipcMain.__invoke('thread:undoRename', created.id);

      expect(result.success).toBe(true);
      expect(result.thread.title).toBe('First');
    });

    it('should broadcast thread:updated event', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'First',
        description: '',
        metadata: {},
      });

      await ipcMain.__invoke('thread:renameThread', created.id, 'Second');
      sentEvents.length = 0;

      await ipcMain.__invoke('thread:undoRename', created.id);

      const updateEvent = sentEvents.find((e) => e.channel === 'thread:updated');
      expect(updateEvent).toBeDefined();
      expect((updateEvent!.args[0] as any).title).toBe('First');
    });

    it('should remove history entry after undo', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'First',
        description: '',
        metadata: {},
      });

      await ipcMain.__invoke('thread:renameThread', created.id, 'Second');
      const result: any = await ipcMain.__invoke('thread:undoRename', created.id);

      expect(result.thread.metadata.titleHistory.length).toBe(0);
    });

    it('should handle multiple undo operations', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Title 1',
        description: '',
        metadata: {},
      });

      await ipcMain.__invoke('thread:renameThread', created.id, 'Title 2');
      await ipcMain.__invoke('thread:renameThread', created.id, 'Title 3');

      const firstUndo: any = await ipcMain.__invoke('thread:undoRename', created.id);
      expect(firstUndo.thread.title).toBe('Title 2');

      const secondUndo: any = await ipcMain.__invoke('thread:undoRename', created.id);
      expect(secondUndo.thread.title).toBe('Title 1');
    });

    it('should reject undo when no history exists', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke('thread:undoRename', created.id);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.code).toBe('NO_RENAME_HISTORY');
    });

    it('should reject undo when not authenticated', async () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: '',
        metadata: {},
      });

      const result: any = await ipcMain.__invoke('thread:undoRename', created.id);

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toBe('THREAD_ACCESS_DENIED');
    });

    it('should reject undo for non-existent thread', async () => {
      const result: any = await ipcMain.__invoke('thread:undoRename', 'non-existent-id');

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toBe('THREAD_NOT_FOUND');
    });

    it('should reject undo when user does not own thread', async () => {
      const thread = threadRepository.createThread({
        title: 'Original',
        userId: 'other-user-456',
      });

      threadRepository.renameThread(thread.id, 'Updated');

      const result: any = await ipcMain.__invoke('thread:undoRename', thread.id);

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toBe('THREAD_ACCESS_DENIED');
    });

    it('should allow undo when user owns thread', async () => {
      const thread = threadRepository.createThread({
        title: 'Original',
        userId: 'test-user-123',
      });

      threadRepository.renameThread(thread.id, 'Updated');

      const result: any = await ipcMain.__invoke('thread:undoRename', thread.id);

      expect(result.success).toBe(true);
      expect(result.thread.title).toBe('Original');
    });
  });

  describe('Rename and undo integration', () => {
    it('should handle rename-undo-rename sequence', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'A',
        description: '',
        metadata: {},
      });

      await ipcMain.__invoke('thread:renameThread', created.id, 'B');
      await ipcMain.__invoke('thread:undoRename', created.id);
      const final: any = await ipcMain.__invoke('thread:renameThread', created.id, 'C');

      expect(final.thread.title).toBe('C');
      expect(final.thread.metadata.titleHistory.length).toBe(1);
    });

    it('should preserve metadata through rename and undo', async () => {
      const created: any = await ipcMain.__invoke('thread:create', {
        title: 'Original',
        description: 'Important thread',
        metadata: { model: 'gpt-4' },
      });

      await ipcMain.__invoke('thread:renameThread', created.id, 'Renamed');
      const undone: any = await ipcMain.__invoke('thread:undoRename', created.id);

      expect(undone.thread.description).toBe('Important thread');
      expect(undone.thread.metadata.model).toBe('gpt-4');
    });
  });
});
