import { ipcMain, BrowserWindow } from 'electron';
import { Thread } from '../preload.js';
import { createScopedLogger, logPerformance } from '../utils/logger.js';

/**
 * Thread IPC Handlers
 *
 * This module contains all IPC handlers for thread-related operations.
 * It demonstrates the pattern for organizing IPC handlers by domain.
 *
 * In a real application, this would interact with a database or file system.
 * For this prototype, we use an in-memory store.
 */

// In-memory thread store (replace with real database in production)
const threads: Map<string, Thread> = new Map();

const threadLog = createScopedLogger('thread');

// Initialize with some sample data
function initializeSampleData(): void {
  const sampleThreads: Thread[] = [
    {
      id: '1',
      title: 'Welcome Thread',
      description: 'This is a sample thread to demonstrate the architecture',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { tags: ['sample', 'welcome'] },
    },
    {
      id: '2',
      title: 'Architecture Discussion',
      description: 'Discussion about software architecture patterns',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { tags: ['architecture', 'design'] },
    },
  ];

  sampleThreads.forEach((thread) => threads.set(thread.id, thread));
}

/**
 * Helper function to broadcast events to all windows
 */
function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, ...(args as [unknown]));
  });
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Register all thread-related IPC handlers
 */
export function registerThreadHandlers(): void {
  // Initialize sample data
  initializeSampleData();

  /**
   * Get all threads
   */
  ipcMain.handle('thread:getAll', (): Promise<Thread[]> => {
    threadLog.info('thread:getAll called');
    return Promise.resolve(Array.from(threads.values()));
  });

  /**
   * Get a thread by ID
   */
  ipcMain.handle('thread:getById', (_event, id: string): Promise<Thread | null> => {
    threadLog.info('thread:getById called', { id });
    return Promise.resolve(threads.get(id) ?? null);
  });

  /**
   * Create a new thread
   */
  ipcMain.handle(
    'thread:create',
    (_event, threadData: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>): Promise<Thread> => {
      const perfLog = logPerformance('thread:create');
      threadLog.info('thread:create called', { title: threadData.title, status: threadData.status });

      const newThread: Thread = {
        ...threadData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      threads.set(newThread.id, newThread);

      // Broadcast the new thread to all windows
      broadcast('thread:created', newThread);

      perfLog.end({ threadId: newThread.id });
      return Promise.resolve(newThread);
    },
  );

  /**
   * Update a thread
   */
  ipcMain.handle(
    'thread:update',
    (_event, id: string, updates: Partial<Thread>): Promise<Thread> => {
      threadLog.info('thread:update called', { id, updates });

      const existingThread = threads.get(id);
      if (!existingThread) {
        threadLog.error('Thread not found for update', { id });
        throw new Error(`Thread with id ${id} not found`);
      }

      const updatedThread: Thread = {
        ...existingThread,
        ...updates,
        id: existingThread.id, // Prevent ID from being changed
        createdAt: existingThread.createdAt, // Prevent createdAt from being changed
        updatedAt: new Date(),
      };

      threads.set(id, updatedThread);

      // Broadcast the update to all windows
      broadcast('thread:updated', updatedThread);

      return Promise.resolve(updatedThread);
    },
  );

  /**
   * Delete a thread
   */
  ipcMain.handle('thread:delete', (_event, id: string): Promise<boolean> => {
    threadLog.info('thread:delete called', { id });

    const deleted = threads.delete(id);

    if (deleted) {
      // Broadcast the deletion to all windows
      broadcast('thread:deleted', id);
      threadLog.info('Thread deleted successfully', { id });
    } else {
      threadLog.warn('Thread not found for deletion', { id });
    }

    return Promise.resolve(deleted);
  });

  threadLog.info('Thread handlers registered');
}

/**
 * Clean up handlers (called when app is closing)
 */
export function unregisterThreadHandlers(): void {
  ipcMain.removeHandler('thread:getAll');
  ipcMain.removeHandler('thread:getById');
  ipcMain.removeHandler('thread:create');
  ipcMain.removeHandler('thread:update');
  ipcMain.removeHandler('thread:delete');
  threadLog.info('Thread handlers unregistered');
}

// Export internal helpers for unit testing
export { initializeSampleData, broadcast, generateId };
