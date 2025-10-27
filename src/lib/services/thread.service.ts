import type { Thread } from '../../../src-electron/preload';
import { threads } from '../stores/thread.store';

class ThreadService {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for real-time updates
    window.electronAPI.thread.onThreadCreated((thread) => {
      threads.addThread(thread);
    });

    window.electronAPI.thread.onThreadUpdated((thread) => {
      threads.updateThread(thread);
    });

    window.electronAPI.thread.onThreadDeleted((threadId) => {
      threads.deleteThread(threadId);
    });
  }

  async getAll(): Promise<Thread[]> {
    const allThreads = await window.electronAPI.thread.getAll();
    threads.setThreads(allThreads);
    return allThreads;
  }

  async create(data: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>): Promise<Thread> {
    return window.electronAPI.thread.create(data);
  }

  async update(id: string, updates: Partial<Thread>): Promise<Thread> {
    return window.electronAPI.thread.update(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return window.electronAPI.thread.delete(id);
  }
}

export const threadService = new ThreadService();
