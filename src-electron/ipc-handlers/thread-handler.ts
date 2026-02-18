import { ipcMain, BrowserWindow } from 'electron';
import { threadRepository } from '../repository/thread-repository.js';
import { modelRepository } from '../repository/model-repository.js';
import { titleValidationService } from '../services/title-validation.service.js';

import type { Thread as RendererThread } from '../preload.js';
import { ThreadMetadata, Message } from '../types/thread.types.js';
import type { Thread as InternalThread } from '../types/thread.types.js';
import type { CreateThreadRequest } from '../services/mokuapi/thread.types.js';

import { createScopedLogger, logPerformance } from '../utils/logger.js';
import { getAuthService } from './auth-handler.js';

const threadLog = createScopedLogger('thread');

/**
 * Helper to convert internal thread representation to renderer-friendly shape
 * (convert epoch ms to Date objects for compatibility with renderer code).
 */
function toRendererThread(t: InternalThread | null): RendererThread | null {
  if (!t) return null;
  return {
    messages: t.messages?.map((m) => ({ ...m })) ?? [],
    id: t.id,
    type: t.type,
    projectId: t.projectId,
    title: t.title && t.title.length > 0 ? t.title : '',
    description: '',
    status: 'active',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    metadata: { ...t.metadata },
    createdUserId: t.createdUserId,
    currentBranchId: t.currentBranchId,
  };
}

function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, ...args);
  });
}

/**
 * Generate a unique ID (kept for test compatibility)
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Export helpers for tests
export { broadcast, generateId };

export function registerThreadHandlers(): void {
  ipcMain.handle(
    'thread:getAll',
    async (
      _event,
      options?: { projectId?: string | null; includeProjectOnly?: boolean },
    ): Promise<RendererThread[]> => {
      // Use server-side filtering when projectId is specified
      const list = await threadRepository.listThreads({
        projectId: options?.projectId || undefined,
      });
      let filtered = list;

      // Client-side filtering based on context
      if (options?.projectId) {
        // In project context: show only threads belonging to this project
        filtered = list.filter((t) => t.projectId === options.projectId);
      } else {
        filtered = list.filter((t) => !t.projectId);
      }

      const mapped = filtered
        .map((t) => toRendererThread(t))
        .filter((x): x is RendererThread => x !== null);
      return mapped;
    },
  );

  ipcMain.handle('thread:getById', async (_event, id: string): Promise<RendererThread | null> => {
    const t = await threadRepository.loadThread(id);
    return toRendererThread(t);
  });

  // List messages for a thread (createdAt ascending, excluding soft-deleted)
  ipcMain.handle('thread:getMessages', async (_event, id: string): Promise<Message[]> => {
    const t = await threadRepository.loadThread(id);
    if (!t) return [];
    const items: Message[] = t.messages
      .filter((m) => !m.deletedAt)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({ ...m }));
    threadLog.info(
      '[thread:getMessages] Loaded',
      t.messages.length,
      'total, returning',
      items.length,
      'after filtering',
    );
    return items;
  });

  ipcMain.handle(
    'thread:create',
    async (_event, request: CreateThreadRequest): Promise<RendererThread> => {
      const perfLog = logPerformance('thread:create');
      threadLog.info('Create called', { title: request.title, agentId: request.agentId });

      // Server-side validation: ensure provided model is available
      if (request.initalModel) {
        const allModels = await modelRepository.listAll();
        const mdl = allModels.find(
          (m) => m.id === request.initalModel || m.accessName === request.initalModel,
        );
        if (!mdl) {
          throw new Error('Model unavailable—choose another');
        }
      }

      const th = await threadRepository.createThread(request);
      const rt = toRendererThread(th);
      if (!rt) throw new Error('Failed to convert created thread');
      broadcast('thread:created', rt);
      perfLog.end({ threadId: th.id });
      return rt;
    },
  );

  ipcMain.handle(
    'thread:update',
    async (_event, id: string, updates: Partial<RendererThread>): Promise<RendererThread> => {
      const existing = await threadRepository.loadThread(id);
      if (!existing) throw new Error(`Thread with id ${id} not found`);

      // Merge metadata and top-level fields
      const newMetadata: ThreadMetadata = { ...existing.metadata, ...(updates.metadata ?? {}) };

      const updated: ReturnType<(typeof threadRepository)['saveThread']> =
        threadRepository.saveThread({
          ...existing,
          title: typeof updates.title === 'string' ? updates.title : existing.title,
          metadata: newMetadata,
          // keep messages
          messages: existing.messages,
          updatedAt: Date.now(),
        });
      const rt = toRendererThread(updated);
      if (!rt) throw new Error('Failed to convert updated thread');
      broadcast('thread:updated', rt);
      return rt;
    },
  );

  // Rename thread with validation and title history tracking
  ipcMain.handle(
    'thread:renameThread',
    async (
      _event,
      threadId: string,
      newTitle: string,
    ): Promise<
      | { success: true; thread: RendererThread }
      | { success: false; status: number; error: string; code?: string }
    > => {
      const auth = getAuthService();

      // Authorization check
      if (!auth.isAuthenticated()) {
        return {
          success: false,
          status: 403,
          error: 'THREAD_ACCESS_DENIED',
        };
      }

      const _currentUser = auth.getUser();
      const internal = await threadRepository.loadThread(threadId);
      if (!internal) {
        return {
          success: false,
          status: 404,
          error: 'THREAD_NOT_FOUND',
        };
      }

      try {
        // Get all existing thread titles for duplicate checking
        const allThreads = await threadRepository.listThreads();
        const existingTitles = allThreads.filter((t) => t.id !== threadId).map((t) => t.title);

        // Validate the new title
        const validation = titleValidationService.validate(
          newTitle,
          existingTitles,
          internal.title,
        );

        if (!validation.valid) {
          return {
            success: false,
            status: 400,
            error: validation.error || 'Invalid title',
            code: validation.code,
          };
        }

        // Rename the thread (uses sanitized title from validation)
        const sanitizedTitle = validation.sanitizedTitle || newTitle;
        const userId = _currentUser?.id;
        const updated = await threadRepository.renameThread(threadId, sanitizedTitle, userId);

        const rt = toRendererThread(updated);
        if (!rt) throw new Error('Failed to convert thread after rename');

        // Broadcast the update
        broadcast('thread:updated', rt);

        threadLog.info(`Thread ${threadId} renamed to "${sanitizedTitle}"`);

        return {
          success: true,
          thread: rt,
        };
      } catch (error) {
        const err = error as Error;
        threadLog.error(`Failed to rename thread ${threadId}:`, err);

        // Map repository errors to appropriate status codes
        if (err.message === 'TITLE_EMPTY' || err.message === 'TITLE_TOO_LONG') {
          return {
            success: false,
            status: 400,
            error: err.message,
            code: err.message,
          };
        }

        return {
          success: false,
          status: 500,
          error: err.message || 'Failed to rename thread',
        };
      }
    },
  );

  ipcMain.handle('thread:delete', async (_event, id: string): Promise<boolean> => {
    const deleted = await threadRepository.deleteThread(id);
    if (deleted) broadcast('thread:deleted', id);
    return deleted;
  });

  // Soft delete thread (set deletedAt/status) and broadcast deletion
  ipcMain.handle('thread:softDelete', async (_event, id: string): Promise<boolean> => {
    const ok = await threadRepository.softDeleteThread(id);
    if (ok) broadcast('thread:deleted', id);
    return ok;
  });

  // Delete a branch
  ipcMain.handle(
    'thread:deleteBranch',
    async (
      _event,
      threadId: string,
      branchId: string,
    ): Promise<{ success: true } | { success: false; error: string }> => {
      try {
        threadRepository.deleteBranch(threadId, branchId);
        // Broadcast thread update after branch deletion
        const thread = await threadRepository.loadThread(threadId);
        if (thread) {
          const rendererThread = toRendererThread(thread);
          if (rendererThread) {
            broadcast('thread:updated', rendererThread);
          }
        }
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Append message with idempotency and auth checks (memory approach)
  ipcMain.handle(
    'thread:appendMessage',
    async (
      _event,
      threadId: string,
      payload: {
        role: 'user' | 'assistant' | 'system';
        content: string;
        metadata?: Record<string, unknown>;
        client_message_id?: string;
        branch_id?: string;
      },
    ): Promise<
      | {
          success: true;
          message: { id: string; role: string; content: string; createdAt: number };
          thread: RendererThread;
        }
      | { success: false; status: number; error: string; thread_id?: string }
    > => {
      const auth = getAuthService();

      // Authorization check
      if (!auth.isAuthenticated()) {
        return {
          success: false,
          status: 403,
          error: 'THREAD_ACCESS_DENIED',
          thread_id: threadId,
        };
      }

      const _currentUser = auth.getUser();
      const internal = await threadRepository.loadThread(threadId);
      if (!internal) {
        return {
          success: false,
          status: 404,
          error: 'THREAD_NOT_FOUND',
          thread_id: threadId,
        };
      }

      try {
        // Extract branchId from payload if provided
        const branchId = payload.branch_id ?? (payload.metadata?.branchId as string | undefined);

        const msg: Message = await threadRepository.appendMessage(threadId, {
          role: payload.role,
          content: payload.content,
          metadata: payload.metadata,
          clientMessageId: payload.client_message_id,
          branchId,
          provider: '',
        });

        const rt = toRendererThread(await threadRepository.loadThread(threadId));
        if (!rt) throw new Error('Failed to convert thread after append');

        // Broadcast thread updated and audit event
        broadcast('thread:updated', rt);
        broadcast('message:persisted', {
          thread_id: threadId,
          message_id: msg.id,
          timestamp: new Date(msg.createdAt).toISOString(),
        });
        return {
          success: true,
          message: {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          },
          thread: rt,
        } as const;
      } catch (e) {
        const err = e as Error;
        if (err.message === 'MESSAGE_TOO_LARGE') {
          return {
            success: false,
            status: 413,
            error: 'MESSAGE_TOO_LARGE',
            thread_id: threadId,
          };
        }
        return { success: false, status: 400, error: String(e) };
      }
    },
  );

  // // Add user prompt (creates thread if id null)
  // ipcMain.handle(
  //   'thread:addUserPrompt',
  //   async (
  //     _event,
  //     threadId: string | null,
  //     prompt: string,
  //     opts: {
  //       title?: string;
  //       description?: string;
  //       model?: string;
  //       projectId?: string; // Associate thread with a project
  //       metadata?: Record<string, unknown>;
  //     } = {},
  //   ): Promise<{
  //     thread: RendererThread;
  //     message: { id: string; role: string; content: string; createdAt: number };
  //   }> => {
  //     // Pass opts directly - metadata is already properly structured
  //     const res = await threadRepository.addUserPrompt(threadId, prompt, opts);
  //     const rt = toRendererThread(res.thread);
  //     if (!rt) throw new Error('Failed to convert thread');
  //     const msg = {
  //       id: res.message.id,
  //       role: res.message.role,
  //       content: res.message.content,
  //       createdAt: res.message.createdAt,
  //     };
  //     broadcast('thread:updated', rt);
  //     return { thread: rt, message: msg };
  //   },
  // );

  // Add assistant response
  ipcMain.handle(
    'thread:addAssistantResponse',
    async (_event, threadId: string, response: string, model?: string) => {
      // Check if title generation will happen
      const threadBefore = await threadRepository.loadThread(threadId);
      let willGenerateTitle = false;

      if (threadBefore) {
        const assistantCount =
          threadBefore.messages?.filter((m) => m.role === 'assistant').length || 0;
        const needsTitle = !threadBefore.title || threadBefore.title.trim() === '';
        willGenerateTitle = assistantCount === 0 && needsTitle;

        if (willGenerateTitle) {
          threadLog.debug(`[thread-handler] Title generation will trigger for thread ${threadId}`);
          broadcast('thread:titleGenerationStarted', { threadId });
        }
      }

      // Add the assistant response (this may trigger auto-title generation)
      const msg = await threadRepository.addAssistantResponse(threadId, response, model);
      const threadObj = await threadRepository.loadThread(threadId);
      const thread = toRendererThread(threadObj);
      if (!thread) throw new Error('Failed to convert thread after assistant response');

      // If title was generated, emit completion event
      if (willGenerateTitle && thread.title) {
        threadLog.debug(
          `[thread-handler] Title generation completed for thread ${threadId}: "${thread.title}"`,
        );
        broadcast('thread:titleGenerationFinished', { threadId, title: thread.title });
      }

      broadcast('thread:updated', thread);
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      };
    },
  );

  // Move thread to/from project
  ipcMain.handle(
    'thread:moveToProject',
    async (
      _event,
      threadId: string,
      _targetProjectId: string | null,
      _options?: { privacyMode?: string; contextHandling?: string },
    ): Promise<RendererThread> => {
      const auth = getAuthService();

      if (!auth.isAuthenticated()) {
        throw new Error('Authentication required');
      }

      const thread = await threadRepository.loadThread(threadId);
      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }
      return thread;

      // const currentUser = auth.getUser();
      // const ownerId = (thread.metadata?.userId as string | undefined) ?? undefined;
      // if (ownerId && currentUser && ownerId !== currentUser.id) {
      //   throw new Error('THREAD_ACCESS_DENIED');
      // }

      // const currentProjectId = (thread.metadata?.projectId as string | undefined) ?? undefined;

      // // If moving to the same project, no-op
      // if (currentProjectId === targetProjectId) {
      //   const rt = toRendererThread(thread);
      //   if (!rt) throw new Error('Failed to convert thread');
      //   return rt;
      // }

      // // Update thread metadata with new project assignment
      // const newMetadata: ThreadMetadata = { ...thread.metadata };
      // if (targetProjectId === null) {
      //   // Moving to general history - remove projectId using explicit undefined (handled in repo)
      //   (newMetadata as Record<string, unknown>).projectId = undefined;
      // } else {
      //   // Moving to a project - set projectId
      //   newMetadata.projectId = targetProjectId;
      // }

      // // Handle privacy mode if provided
      // if (options?.privacyMode) {
      //   newMetadata.privacyMode = options.privacyMode;
      // }

      // // Handle context/memory transition if provided
      // if (options?.contextHandling) {
      //   newMetadata.contextHandling = options.contextHandling;
      // }

      // const updated = threadRepository.updateThreadMetadata(threadId, newMetadata);
      // const rt = toRendererThread(updated);
      // if (!rt) throw new Error('Failed to convert updated thread');

      // broadcast('thread:updated', rt);
      // threadLog.info('Thread moved', {
      //   threadId,
      //   fromProject: currentProjectId ?? 'general',
      //   toProject: targetProjectId ?? 'general',
      // });

      // return rt;
    },
  );

  // Update message (edit)
  ipcMain.handle(
    'thread:updateMessage',
    async (
      _event,
      threadId: string,
      messageId: string,
      newContent: string,
    ): Promise<
      | { success: true; message: Message; thread: RendererThread }
      | { success: false; error: string }
    > => {
      threadLog.info('[IPC] thread:updateMessage called', { threadId, messageId });

      try {
        const updatedMessage = threadRepository.updateMessage(threadId, messageId, newContent);
        const thread = await threadRepository.loadThread(threadId);
        const rt = thread ? toRendererThread(thread) : null;

        if (!rt) throw new Error('Failed to load thread after update');

        broadcast('thread:updated', rt);
        broadcast('message:updated', {
          thread_id: threadId,
          message_id: messageId,
          timestamp: new Date(updatedMessage.editedAt ?? Date.now()).toISOString(),
        });

        return {
          success: true as const,
          message: updatedMessage,
          thread: rt,
        };
      } catch (error) {
        const err = error as Error;
        threadLog.error('[IPC] Error updating message:', err);
        return { success: false, error: err.message };
      }
    },
  );

  threadLog.info('Handlers registered');
}

export function unregisterThreadHandlers(): void {
  ipcMain.removeHandler('thread:getAll');
  ipcMain.removeHandler('thread:getById');
  ipcMain.removeHandler('thread:create');
  ipcMain.removeHandler('thread:update');
  ipcMain.removeHandler('thread:renameThread');
  ipcMain.removeHandler('thread:delete');
  ipcMain.removeHandler('thread:moveToProject');
  ipcMain.removeHandler('thread:updateMessage');
  threadLog.info('Handlers unregistered');
}
