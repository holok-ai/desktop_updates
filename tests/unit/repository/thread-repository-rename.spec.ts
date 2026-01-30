import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThreadRepository } from '../../../src-electron/repository/thread-repository';

// Mock electron dependencies
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-app-data',
  },
}));

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock file operations
vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => JSON.stringify({ version: 1, threads: [] })),
    existsSync: vi.fn(() => false),
  },
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => JSON.stringify({ version: 1, threads: [] })),
  existsSync: vi.fn(() => false),
}));

// Mock file-storage service
vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: {
    deleteThreadFiles: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock title-generator service
vi.mock('../../../src-electron/services/title-generator.service', () => ({
  titleGeneratorService: {
    generateTitle: vi.fn((text: string) => {
      const max = 80;
      return text.length > max ? text.substring(0, max) + '...' : text;
    }),
    ensureUniqueTitle: vi.fn((title: string) => title),
  },
}));

// Mock thread-api service
vi.mock('../../../src-electron/services/mokuapi/thread-api.service', () => ({
  threadApiService: {
    updateThread: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('ThreadRepository - Rename Operations', () => {
  let repository: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ThreadRepository();
  });

  afterEach(() => {
    repository.clearAll();
  });

  describe('renameThread()', () => {
    it('should rename a thread successfully', async () => {
      // Create a thread
      const thread = await repository.createThread({ title: 'Original Title' });

      // Rename it
      const renamed = await repository.renameThread(thread.id, 'New Title');

      expect(renamed.title).toBe('New Title');
      expect(renamed.metadata.title).toBe('New Title');
      expect(renamed.id).toBe(thread.id);
    });

    it('should track title history', async () => {
      const thread = await repository.createThread({ title: 'First Title' });

      await repository.renameThread(thread.id, 'Second Title');

      const updated = await repository.loadThread(thread.id);
      expect(updated).not.toBeNull();
      expect(updated!.metadata.titleHistory).toBeDefined();
      expect(updated!.metadata.titleHistory).toHaveLength(1);

      const historyEntry = updated!.metadata.titleHistory![0];
      expect(historyEntry.title).toBe('Second Title');
      expect(historyEntry.previousTitle).toBe('First Title');
      expect(historyEntry.timestamp).toBeGreaterThan(0);
    });

    it('should track multiple renames in history', async () => {
      const thread = await repository.createThread({ title: 'Title 1' });

      await repository.renameThread(thread.id, 'Title 2');
      await repository.renameThread(thread.id, 'Title 3');
      await repository.renameThread(thread.id, 'Title 4');

      const updated = await repository.loadThread(thread.id);
      expect(updated!.metadata.titleHistory).toHaveLength(3);
      expect(updated!.metadata.titleHistory![0].previousTitle).toBe('Title 1');
      expect(updated!.metadata.titleHistory![1].previousTitle).toBe('Title 2');
      expect(updated!.metadata.titleHistory![2].previousTitle).toBe('Title 3');
      expect(updated!.title).toBe('Title 4');
    });

    it('should include userId in history entry when provided', async () => {
      const thread = await repository.createThread({ title: 'Original' });

      await repository.renameThread(thread.id, 'Updated', 'user123');

      const updated = await repository.loadThread(thread.id);
      expect(updated!.metadata.titleHistory![0].userId).toBe('user123');
    });

    it('should trim and sanitize the new title', async () => {
      const thread = await repository.createThread({ title: 'Original' });

      const renamed = await repository.renameThread(thread.id, '  New Title  ');

      expect(renamed.title).toBe('New Title');
    });

    it('should throw error for non-existent thread', async () => {
      await expect(async () => {
        await repository.renameThread('non-existent-id', 'New Title');
      }).rejects.toThrow('Thread not found');
    });

    it('should throw error for empty title', async () => {
      const thread = await repository.createThread({ title: 'Original' });

      await expect(async () => {
        await repository.renameThread(thread.id, '');
      }).rejects.toThrow('TITLE_EMPTY');
    });

    it('should throw error for whitespace-only title', async () => {
      const thread = await repository.createThread({ title: 'Original' });

      await expect(async () => {
        await repository.renameThread(thread.id, '   ');
      }).rejects.toThrow('TITLE_EMPTY');
    });

    it('should throw error for title over 200 characters', async () => {
      const thread = await repository.createThread({ title: 'Original' });
      const longTitle = 'A'.repeat(201);

      await expect(async () => {
        await repository.renameThread(thread.id, longTitle);
      }).rejects.toThrow('TITLE_TOO_LONG');
    });

    it('should allow title at exactly 200 characters', async () => {
      const thread = await repository.createThread({ title: 'Original' });
      const maxTitle = 'A'.repeat(200);

      const renamed = await repository.renameThread(thread.id, maxTitle);

      expect(renamed.title).toBe(maxTitle);
    });

    it('should not modify thread if title is unchanged', async () => {
      const thread = await repository.createThread({ title: 'Same Title' });
      const originalUpdatedAt = thread.updatedAt;

      const renamed = await repository.renameThread(thread.id, 'Same Title');

      expect(renamed.title).toBe('Same Title');
      expect(renamed.metadata.titleHistory).toBeUndefined();
    });

    it('should update thread updatedAt timestamp', async () => {
      const thread = await repository.createThread({ title: 'Original' });
      const originalUpdatedAt = thread.updatedAt;

      // Wait a tiny bit to ensure timestamp changes
      const start = Date.now();
      while (Date.now() === start) {
        // spin
      }

      const renamed = await repository.renameThread(thread.id, 'New Title');

      expect(renamed.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should preserve other thread metadata', async () => {
      const thread = await repository.createThread({
        title: 'Original',
        description: 'Test description',
        model: 'gpt-4',
      });

      const renamed = await repository.renameThread(thread.id, 'New Title');

      expect(renamed.metadata.description).toBe('Test description');
      expect(renamed.metadata.model).toBe('gpt-4');
    });

    it('should preserve thread messages', async () => {
      const thread = await repository.createThread({ title: 'Original' });
      repository.addMessage(thread.id, 'user', 'Hello');
      repository.addMessage(thread.id, 'assistant', 'Hi there');

      const renamed = await repository.renameThread(thread.id, 'New Title');

      expect(renamed.messages).toHaveLength(2);
      expect(renamed.messages[0].content).toBe('Hello');
      expect(renamed.messages[1].content).toBe('Hi there');
    });

    it('should be case-sensitive for unchanged title check', async () => {
      const thread = await repository.createThread({ title: 'Original Title' });

      const renamed = await repository.renameThread(thread.id, 'original title');

      expect(renamed.metadata.titleHistory).toBeDefined();
      expect(renamed.metadata.titleHistory).toHaveLength(1);
    });
  });

  describe('undoRenameThread()', () => {
    it('should restore previous title successfully', async () => {
      const thread = await repository.createThread({ title: 'First' });
      await repository.renameThread(thread.id, 'Second');

      const undone = await repository.undoRenameThread(thread.id);

      expect(undone.title).toBe('First');
      expect(undone.metadata.title).toBe('First');
    });

    it('should remove last history entry', async () => {
      const thread = await repository.createThread({ title: 'First' });
      await repository.renameThread(thread.id, 'Second');
      await repository.renameThread(thread.id, 'Third');

      const undone = await repository.undoRenameThread(thread.id);

      expect(undone.title).toBe('Second');
      expect(undone.metadata.titleHistory).toHaveLength(1);
    });

    it('should handle multiple undo operations', async () => {
      const thread = await repository.createThread({ title: 'Title 1' });
      await repository.renameThread(thread.id, 'Title 2');
      await repository.renameThread(thread.id, 'Title 3');

      await repository.undoRenameThread(thread.id);
      const afterFirst = await repository.loadThread(thread.id);
      expect(afterFirst!.title).toBe('Title 2');

      await repository.undoRenameThread(thread.id);
      const afterSecond = await repository.loadThread(thread.id);
      expect(afterSecond!.title).toBe('Title 1');
    });

    it('should throw error for non-existent thread', async () => {
      await expect(async () => {
        await repository.undoRenameThread('non-existent-id');
      }).rejects.toThrow('Thread not found');
    });

    it('should throw error when no rename history exists', async () => {
      const thread = await repository.createThread({ title: 'Original' });

      await expect(async () => {
        await repository.undoRenameThread(thread.id);
      }).rejects.toThrow('NO_RENAME_HISTORY');
    });

    it('should throw error when history is empty array', async () => {
      const thread = await repository.createThread({
        title: 'Original',
        titleHistory: [],
      });

      await expect(async () => {
        await repository.undoRenameThread(thread.id);
      }).rejects.toThrow('NO_RENAME_HISTORY');
    });

    it('should update thread updatedAt timestamp', async () => {
      const thread = await repository.createThread({ title: 'First' });
      await repository.renameThread(thread.id, 'Second');

      const beforeUndo = await repository.loadThread(thread.id);
      const originalUpdatedAt = beforeUndo!.updatedAt;

      // Wait a bit
      const start = Date.now();
      while (Date.now() === start) {
        // spin
      }

      const undone = await repository.undoRenameThread(thread.id);

      expect(undone.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should preserve other thread metadata', async () => {
      const thread = await repository.createThread({
        title: 'First',
        description: 'Test',
        model: 'gpt-4',
      });
      await repository.renameThread(thread.id, 'Second');

      const undone = await repository.undoRenameThread(thread.id);

      expect(undone.metadata.description).toBe('Test');
      expect(undone.metadata.model).toBe('gpt-4');
    });

    it('should preserve thread messages', async () => {
      const thread = await repository.createThread({ title: 'First' });
      repository.addMessage(thread.id, 'user', 'Message 1');
      await repository.renameThread(thread.id, 'Second');

      const undone = await repository.undoRenameThread(thread.id);

      expect(undone.messages).toHaveLength(1);
      expect(undone.messages[0].content).toBe('Message 1');
    });

    it('should clear history after undoing all renames', async () => {
      const thread = await repository.createThread({ title: 'First' });
      await repository.renameThread(thread.id, 'Second');

      const undone = await repository.undoRenameThread(thread.id);

      expect(undone.metadata.titleHistory).toHaveLength(0);

      // Should throw on second undo
      await expect(async () => {
        await repository.undoRenameThread(thread.id);
      }).rejects.toThrow('NO_RENAME_HISTORY');
    });

    it('should handle complex rename and undo sequences', async () => {
      const thread = await repository.createThread({ title: 'A' });
      await repository.renameThread(thread.id, 'B');
      await repository.renameThread(thread.id, 'C');
      await repository.undoRenameThread(thread.id); // Back to B
      await repository.renameThread(thread.id, 'D');

      const current = await repository.loadThread(thread.id);
      expect(current!.title).toBe('D');
      expect(current!.metadata.titleHistory).toHaveLength(2);

      await repository.undoRenameThread(thread.id);
      const afterUndo = await repository.loadThread(thread.id);
      expect(afterUndo!.title).toBe('B');
    });
  });

  describe('Integration with other repository methods', () => {
    it('should work with saveThread', async () => {
      const thread = await repository.createThread({ title: 'Original' });
      await repository.renameThread(thread.id, 'Renamed');

      const loaded = await repository.loadThread(thread.id);
      const saved = repository.saveThread(loaded!);

      expect(saved.title).toBe('Renamed');
      expect(saved.metadata.titleHistory).toHaveLength(1);
    });

    it('should preserve rename history when updating metadata', async () => {
      const thread = await repository.createThread({ title: 'First' });
      await repository.renameThread(thread.id, 'Second');

      repository.updateThreadMetadata(thread.id, { model: 'gpt-4' });

      const updated = await repository.loadThread(thread.id);
      expect(updated!.metadata.titleHistory).toHaveLength(1);
      expect(updated!.metadata.model).toBe('gpt-4');
    });

    it('should include rename history in loadThread result', async () => {
      const thread = await repository.createThread({ title: 'Original' });
      await repository.renameThread(thread.id, 'Updated');

      const loaded = await repository.loadThread(thread.id);

      expect(loaded!.metadata.titleHistory).toBeDefined();
      expect(loaded!.metadata.titleHistory).toHaveLength(1);
    });

    it('should include renamed threads in listThreads', async () => {
      const thread1 = await repository.createThread({ title: 'Thread 1' });
      const thread2 = await repository.createThread({ title: 'Thread 2' });
      await repository.renameThread(thread2.id, 'Thread 2 Renamed');

      const all = await repository.listThreads();

      expect(all).toHaveLength(2);
      const renamed = all.find((t) => t.id === thread2.id);
      expect(renamed!.title).toBe('Thread 2 Renamed');
    });
  });
});
