import { ipcMain, BrowserWindow } from 'electron';
import { threadsService } from '../services/threads-service.js';
import { mokuService } from '../services/moku.service.js';

import type { Thread as RendererThread } from '../preload.js';
import type ThreadsService from '../services/threads-service.js';
import type { Thread as InternalThread, ThreadMetadata } from '../services/threads-service.js';
import { createScopedLogger, logPerformance } from '../utils/logger.js';

const threadLog = createScopedLogger('thread');

/**
 * Helper to convert internal thread representation to renderer-friendly shape
 * (convert epoch ms to Date objects for compatibility with renderer code).
 */
function toRendererThread(t: InternalThread | null): RendererThread | null {
  if (!t) return null;
  return {
    id: t.id,
    title: typeof t.metadata?.title === 'string' ? t.metadata.title : '',
    description: t.metadata?.description ?? '',
    // Normalize status from metadata if present and valid, otherwise default to 'active'
    status: (() => {
      const s = t.metadata?.status;
      if (typeof s === 'string') {
        if (s === 'active' || s === 'archived' || s === 'deleted') return s;
      }
      return 'active';
    })(),
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    metadata: { ...t.metadata },
  };
}

function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, ...(args as [unknown]));
  });
}

/**
 * Generate a unique ID (kept for test compatibility)
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Initialize sample data (kept for test compatibility)
 */
export function initializeSampleData(): void {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  const samples = [
    // Recent (today)
    {
      title: 'Recent: Design Sync',
      description: "Notes from today's design sync",
      tags: ['recent', 'design'],
      updatedAt: now - 1 * oneHour,
      createdAt: now - 3 * oneHour,
    },
    {
      title: 'Recent: Quick Ideas',
      description: 'Brain dump of quick ideas',
      tags: ['recent'],
      updatedAt: now - 5 * oneHour,
      createdAt: now - 8 * oneHour,
    },
    {
      title: 'Recent: Quick Ideas 2',
      description: 'Brain dump of quick ideas',
      tags: ['recent'],
      updatedAt: now - 5 * oneHour,
      createdAt: now - 8 * oneHour,
    },
    // Yesterday
    {
      title: 'Yesterday: Standup Notes',
      description: "Summary from yesterday's standup",
      tags: ['yesterday'],
      updatedAt: now - 1 * oneDay + 2 * oneHour,
      createdAt: now - 1 * oneDay - 3 * oneHour,
    },
    {
      title: 'Yesterday: Standup Notes 2',
      description: "Summary from yesterday's standup",
      tags: ['yesterday'],
      updatedAt: now - 1 * oneDay + 2 * oneHour,
      createdAt: now - 1 * oneDay - 3 * oneHour,
    },
    // Last 7 Days
    {
      title: 'This Week: Architecture Discussion',
      description: 'Discussion about software architecture patterns',
      tags: ['last7', 'architecture', 'design'],
      updatedAt: now - 3 * oneDay,
      createdAt: now - 4 * oneDay,
    },
    {
      title: 'This Week: Architecture Discussion 2',
      description: 'Discussion about software architecture patterns',
      tags: ['last7', 'architecture', 'design'],
      updatedAt: now - 3 * oneDay,
      createdAt: now - 4 * oneDay,
    },
    // Last 30 Days
    {
      title: 'Last 2 Weeks: Performance Audit',
      description: 'Profiling results and action items',
      tags: ['last30', 'performance'],
      updatedAt: now - 12 * oneDay,
      createdAt: now - 14 * oneDay,
    },
    // Older (> 30 days)
    {
      title: 'Older: Welcome Thread',
      description: 'This is a sample thread to demonstrate the architecture',
      tags: ['older', 'sample', 'welcome'],
      updatedAt: now - 45 * oneDay,
      createdAt: now - 50 * oneDay,
    },
    {
      title: 'Older: Welcome Thread 2',
      description: 'This is a sample thread to demonstrate the architecture',
      tags: ['older', 'sample', 'welcome'],
      updatedAt: now - 45 * oneDay,
      createdAt: now - 50 * oneDay,
    },
    {
      title: 'Older: Tutorial',
      description: 'This is a sample thread to demonstrate the architecture',
      tags: ['older', 'sample', 'welcome'],
      updatedAt: now - 45 * oneDay,
      createdAt: now - 50 * oneDay,
    },
    {
      title: 'Older: Tutorial 2',
      description: 'This is a sample thread to demonstrate the architecture',
      tags: ['older', 'sample', 'welcome'],
      updatedAt: now - 45 * oneDay,
      createdAt: now - 50 * oneDay,
    },
  ];

  const svc: ThreadsService = threadsService;

  samples.forEach((s) => {
    const thread = svc.createThread({
      title: s.title,
      description: s.description,
      tags: s.tags,
    });
    svc.setThreadTimestamps(thread.id, s.createdAt, s.updatedAt);
  });
}

// Export helpers for tests
export { broadcast, generateId };

export function registerThreadHandlers(): void {
  // Initialize sample data for compatibility with tests
  initializeSampleData();

  // No external persistence; threadsService is memory-only

  ipcMain.handle('thread:getAll', (): Promise<RendererThread[]> => {
    const list = threadsService.listThreads();
    const mapped = list
      .map((t) => toRendererThread(t))
      .filter((x): x is RendererThread => x !== null);
    return Promise.resolve(mapped);
  });

  ipcMain.handle('thread:getById', (_event, id: string): Promise<RendererThread | null> => {
    const t = threadsService.loadThread(id);
    return Promise.resolve(toRendererThread(t));
  });

  ipcMain.handle(
    'thread:create',
    async (
      _event,
      threadData: Omit<RendererThread, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<RendererThread> => {
      const perfLog = logPerformance('thread:create');
      threadLog.info('Create called', { title: threadData.title, status: threadData.status });

      const metadata: ThreadMetadata = {
        title: threadData.title,
        description: threadData.description,
        ...(threadData.metadata ?? {}),
      };

      // Server-side validation: ensure provided model/provider are available
      if (typeof metadata.model === 'string' && typeof metadata.provider === 'string') {
        const mdl = await mokuService.getModel(metadata.provider, metadata.model);
        if (!mdl || !mdl.available) {
          throw new Error('Model unavailable—choose another');
        }
      }

      const th = threadsService.createThread(metadata);
      const rt = toRendererThread(th);
      if (!rt) throw new Error('Failed to convert created thread');
      broadcast('thread:created', rt);
      perfLog.end({ threadId: th.id });
      return Promise.resolve(rt);
    },
  );

  ipcMain.handle(
    'thread:update',
    (_event, id: string, updates: Partial<RendererThread>): Promise<RendererThread> => {
      const existing = threadsService.loadThread(id);
      if (!existing) throw new Error(`Thread with id ${id} not found`);

      // Merge metadata and top-level fields
      const newMetadata: ThreadMetadata = { ...existing.metadata, ...(updates.metadata ?? {}) };
      if (typeof updates.title === 'string') newMetadata.title = updates.title;
      if (typeof updates.description === 'string') newMetadata.description = updates.description;
      if (typeof updates.status === 'string') {
        const s = updates.status;
        if (s === 'active' || s === 'archived' || s === 'deleted') newMetadata.status = s;
      }

      const updated: ReturnType<(typeof threadsService)['saveThread']> = threadsService.saveThread({
        ...existing,
        metadata: newMetadata,
        // keep messages
        messages: existing.messages,
        updatedAt: Date.now(),
      });
      const rt = toRendererThread(updated);
      if (!rt) throw new Error('Failed to convert updated thread');
      broadcast('thread:updated', rt);
      return Promise.resolve(rt);
    },
  );

  ipcMain.handle('thread:delete', (_event, id: string): Promise<boolean> => {
    const deleted = threadsService.deleteThread(id);
    if (deleted) broadcast('thread:deleted', id);
    return Promise.resolve(deleted);
  });

  // Add user prompt (creates thread if id null)
  ipcMain.handle(
    'thread:addUserPrompt',
    (
      _event,
      threadId: string | null,
      prompt: string,
      opts: { title?: string; description?: string; model?: string } = {},
    ): Promise<{
      thread: RendererThread;
      message: { id: string; role: string; content: string; createdAt: number };
    }> => {
      const res = threadsService.addUserPrompt(threadId, prompt, opts);
      const rt = toRendererThread(res.thread);
      if (!rt) throw new Error('Failed to convert thread');
      const msg = {
        id: res.message.id,
        role: res.message.role,
        content: res.message.content,
        createdAt: res.message.createdAt,
      };
      broadcast('thread:updated', rt);
      return Promise.resolve({ thread: rt, message: msg });
    },
  );

  // Add assistant response
  ipcMain.handle(
    'thread:addAssistantResponse',
    (_event, threadId: string, response: string, model?: string) => {
      const msg = threadsService.addAssistantResponse(threadId, response, model);
      const threadObj = threadsService.loadThread(threadId);
      const thread = toRendererThread(threadObj);
      if (!thread) throw new Error('Failed to convert thread after assistant response');
      broadcast('thread:updated', thread);
      return Promise.resolve({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      });
    },
  );

  // Save prompt and multiple responses atomically
  ipcMain.handle(
    'thread:savePromptAndResponses',
    (
      _event,
      threadId: string | null,
      prompt: string,
      responses: { text: string; model?: string }[],
      opts: { title?: string; description?: string } = {},
    ) => {
      const res = threadsService.savePromptAndResponses(threadId, prompt, responses, opts);
      const rt = toRendererThread(res.thread);
      if (!rt) throw new Error('Failed to convert thread after savePromptAndResponses');
      const promptMessage = {
        id: res.promptMessage.id,
        role: res.promptMessage.role,
        content: res.promptMessage.content,
        createdAt: res.promptMessage.createdAt,
      };
      const responseMessages = res.responseMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));
      broadcast('thread:updated', rt);
      return Promise.resolve({ thread: rt, promptMessage, responseMessages });
    },
  );

  threadLog.info('Handlers registered');
}

export function unregisterThreadHandlers(): void {
  ipcMain.removeHandler('thread:getAll');
  ipcMain.removeHandler('thread:getById');
  ipcMain.removeHandler('thread:create');
  ipcMain.removeHandler('thread:update');
  ipcMain.removeHandler('thread:delete');
  threadLog.info('Handlers unregistered');
}
