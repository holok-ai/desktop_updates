import { ipcMain, BrowserWindow } from 'electron';
import { Thread } from '../preload.js';

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
    console.log('[IPC] thread:getAll called');
    return Promise.resolve(Array.from(threads.values()));
  });

  /**
   * Get a thread by ID
   */
  ipcMain.handle('thread:getById', (_event, id: string): Promise<Thread | null> => {
    console.log('[IPC] thread:getById called with id:', id);
    return Promise.resolve(threads.get(id) ?? null);
  });

  /**
   * Create a new thread
   */
  ipcMain.handle(
    'thread:create',
    (_event, threadData: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>): Promise<Thread> => {
      console.log('[IPC] thread:create called with data:', threadData);

      const newThread: Thread = {
        ...threadData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      threads.set(newThread.id, newThread);

      // Broadcast the new thread to all windows
      broadcast('thread:created', newThread);

      return Promise.resolve(newThread);
    },
  );

  /**
   * Update a thread
   */
  ipcMain.handle(
    'thread:update',
    (_event, id: string, updates: Partial<Thread>): Promise<Thread> => {
      console.log('[IPC] thread:update called with id:', id, 'updates:', updates);

      const existingThread = threads.get(id);
      if (!existingThread) {
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
    console.log('[IPC] thread:delete called with id:', id);

    const deleted = threads.delete(id);

    if (deleted) {
      // Broadcast the deletion to all windows
      broadcast('thread:deleted', id);
    }

    return Promise.resolve(deleted);
  });

  console.log('[IPC] Thread handlers registered');
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
  console.log('[IPC] Thread handlers unregistered');
}
