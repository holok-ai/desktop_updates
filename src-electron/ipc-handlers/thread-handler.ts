import { ipcMain, BrowserWindow } from 'electron';
import { threadRepository } from '../repository/thread-repository.js';
import { threadApiService } from '../services/mokuapi/thread-api.service.js';
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';
import type { MessageDTO, RequestOptionsDTO } from '../services/mokuapi/thread.types.js';

import type { Thread as RendererThread } from '../preload.js';
import { ThreadMetadata, Message } from '../types/thread.types.js';
import type { Thread as InternalThread } from '../types/thread.types.js';
import type { CreateThreadRequest } from '../services/mokuapi/thread.types.js';

import { createScopedLogger, logPerformance } from '../utils/logger.js';
import { getAuthService } from './auth-handler.js';
import { CreateThreadCommand } from '../commands/thread.create.js';
import { RenameThreadCommand } from '../commands/thread.rename.js';
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
    ): Promise<ApiResponse<RendererThread[]>> => {
      try {
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
        return apiOk(mapped);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        threadLog.error('[thread:getAll] Error:', message);
        return apiFail(-1, message);
      }
    },
  );

  ipcMain.handle(
    'thread:getById',
    async (_event, id: string): Promise<ApiResponse<RendererThread | null>> => {
      try {
        const t = await threadRepository.loadThread(id);
        return apiOk(toRendererThread(t));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        threadLog.error('[thread:getById] Error:', message);
        return apiFail(-1, message);
      }
    },
  );

  // List messages for a thread (createdAt ascending, excluding soft-deleted)
  ipcMain.handle(
    'thread:getMessages',
    async (_event, id: string): Promise<ApiResponse<Message[]>> => {
      try {
        const t = await threadRepository.loadThread(id);
        if (!t) return apiOk([]);
        const items: Message[] = t.messages
          .filter((m) => !m.deletedAt)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((m) => ({ ...m }));
        const toolUseCount = items.filter((m) => (m.toolUses?.length ?? 0) > 0).length;
        threadLog.info(
          '[thread:getMessages] Loaded',
          t.messages.length,
          'total, returning',
          items.length,
          'after filtering',
          { threadId: id, toolUseCount },
        );
        return apiOk(items);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        threadLog.error('[thread:getMessages] Error:', message);
        return apiFail(-1, message);
      }
    },
  );

  ipcMain.handle(
    'thread:create',
    async (_event, request: CreateThreadRequest): Promise<ApiResponse<RendererThread>> => {
      const perfLog = logPerformance('thread:create');
      threadLog.info('Create called', { title: request.title, agentId: request.agentId });

      try {
        const cmd = new CreateThreadCommand();
        const result = await cmd.execute(request);
        if (!result.success) return result as ApiResponse<RendererThread>;

        const rt = toRendererThread(result.data);
        if (!rt) return apiFail(-1, 'Failed to convert created thread');
        broadcast('thread:created', rt);
        perfLog.end({ threadId: result.data.id });
        return apiOk(rt);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        threadLog.error('[thread:create] Error:', message);
        return apiFail(-1, message);
      }
    },
  );

  ipcMain.handle(
    'thread:update',
    async (
      _event,
      id: string,
      updates: Partial<RendererThread>,
    ): Promise<ApiResponse<RendererThread>> => {
      try {
        const existing = await threadRepository.loadThread(id);
        if (!existing) return apiFail(404, `Thread with id ${id} not found`);

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
        if (!rt) return apiFail(-1, 'Failed to convert updated thread');
        broadcast('thread:updated', rt);
        return apiOk(rt);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        threadLog.error('[thread:update] Error:', message);
        return apiFail(-1, message);
      }
    },
  );

  // Rename thread with validation and title history tracking
  ipcMain.handle(
    'thread:renameThread',
    async (_event, threadId: string, newTitle: string): Promise<ApiResponse<RendererThread>> => {
      const auth = getAuthService();

      // Authorization check
      if (!auth.isAuthenticated()) {
        return apiFail(403, 'THREAD_ACCESS_DENIED');
      }

      const currentUser = auth.getUser();

      const cmd = new RenameThreadCommand();
      const result = await cmd.execute(threadId, newTitle, currentUser?.id);
      if (!result.success) return result as ApiResponse<RendererThread>;

      const rt = toRendererThread(result.data);
      if (!rt) return apiFail(-1, 'Failed to convert thread after rename');

      broadcast('thread:updated', rt);
      return apiOk(rt);
    },
  );

  ipcMain.handle('thread:delete', async (_event, id: string): Promise<ApiResponse<boolean>> => {
    try {
      const deleted = await threadRepository.deleteThread(id);
      if (deleted) broadcast('thread:deleted', id);
      return apiOk(deleted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      threadLog.error('[thread:delete] Error:', message);
      return apiFail(-1, message);
    }
  });

  // Soft delete thread (set deletedAt/status) and broadcast deletion
  ipcMain.handle('thread:softDelete', async (_event, id: string): Promise<ApiResponse<boolean>> => {
    try {
      const ok = await threadRepository.softDeleteThread(id);
      if (ok) broadcast('thread:deleted', id);
      return apiOk(ok);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      threadLog.error('[thread:softDelete] Error:', message);
      return apiFail(-1, message);
    }
  });

  // Delete a branch
  ipcMain.handle(
    'thread:deleteBranch',
    async (_event, threadId: string, branchId: string): Promise<ApiResponse<void>> => {
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
        return apiOk(undefined) as ApiResponse<void>;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiFail(-1, errorMessage);
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
      ApiResponse<{
        message: { id: string; role: string; content: string; createdAt: number };
        thread: RendererThread;
      }>
    > => {
      const auth = getAuthService();

      // Authorization check
      if (!auth.isAuthenticated()) {
        return apiFail(403, 'THREAD_ACCESS_DENIED');
      }

      const _currentUser = auth.getUser();
      const internal = await threadRepository.loadThread(threadId);
      if (!internal) {
        return apiFail(404, 'THREAD_NOT_FOUND');
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
        if (!rt) return apiFail(-1, 'Failed to convert thread after append');

        // Broadcast thread updated and audit event
        broadcast('thread:updated', rt);
        broadcast('message:persisted', {
          thread_id: threadId,
          message_id: msg.id,
          timestamp: new Date(msg.createdAt).toISOString(),
        });
        return apiOk({
          message: {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          },
          thread: rt,
        });
      } catch (e) {
        const err = e as Error;
        if (err.message === 'MESSAGE_TOO_LARGE') {
          return apiFail(413, 'MESSAGE_TOO_LARGE');
        }
        return apiFail(400, String(e));
      }
    },
  );

  // Add assistant response
  ipcMain.handle(
    'thread:addAssistantResponse',
    async (
      _event,
      threadId: string,
      response: string,
      model?: string,
    ): Promise<ApiResponse<{ id: string; role: string; content: string; createdAt: number }>> => {
      try {
        // Check if title generation will happen
        const threadBefore = await threadRepository.loadThread(threadId);
        let willGenerateTitle = false;

        if (threadBefore) {
          const assistantCount =
            threadBefore.messages?.filter((m) => m.role === 'assistant').length || 0;
          const needsTitle = !threadBefore.title || threadBefore.title.trim() === '';
          willGenerateTitle = assistantCount === 0 && needsTitle;

          if (willGenerateTitle) {
            threadLog.debug(
              `[thread-handler] Title generation will trigger for thread ${threadId}`,
            );
            broadcast('thread:titleGenerationStarted', { threadId });
          }
        }

        // get a branch id
        let branchId: string = '1.0.0';
        if (threadBefore && threadBefore.messages && threadBefore.messages.length > 0) {
          branchId = threadBefore?.messages[threadBefore.messages.length - 1]?.branchId ?? '1.0.0';
        }

        // Add the assistant response (this may trigger auto-title generation)
        const msg = await threadRepository.addAssistantResponse(
          threadId,
          response,
          branchId,
          model,
        );
        const threadObj = await threadRepository.loadThread(threadId);
        const thread = toRendererThread(threadObj);
        if (!thread) return apiFail(-1, 'Failed to convert thread after assistant response');

        // If title was generated, emit completion event
        if (willGenerateTitle && thread.title) {
          threadLog.debug(
            `[thread-handler] Title generation completed for thread ${threadId}: "${thread.title}"`,
          );
          broadcast('thread:titleGenerationFinished', { threadId, title: thread.title });
        }

        broadcast('thread:updated', thread);

        return apiOk({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        threadLog.error('[thread:addAssistantResponse] Error:', message);
        return apiFail(-1, message);
      }
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
    ): Promise<ApiResponse<RendererThread>> => {
      const auth = getAuthService();

      if (!auth.isAuthenticated()) {
        return apiFail(401, 'Authentication required');
      }

      try {
        const thread = await threadRepository.loadThread(threadId);
        if (!thread) {
          return apiFail(404, `Thread not found: ${threadId}`);
        }
        const rt = toRendererThread(thread);
        if (!rt) return apiFail(-1, 'Failed to convert thread');
        return apiOk(rt);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        threadLog.error('[thread:moveToProject] Error:', message);
        return apiFail(-1, message);
      }
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
    ): Promise<ApiResponse<{ message: Message; thread: RendererThread }>> => {
      threadLog.info('[IPC] thread:updateMessage called', { threadId, messageId });

      try {
        const updatedMessage = threadRepository.updateMessage(threadId, messageId, newContent);
        const thread = await threadRepository.loadThread(threadId);
        const rt = thread ? toRendererThread(thread) : null;

        if (!rt) return apiFail(-1, 'Failed to load thread after update');

        broadcast('thread:updated', rt);
        broadcast('message:updated', {
          thread_id: threadId,
          message_id: messageId,
          timestamp: new Date(updatedMessage.editedAt ?? Date.now()).toISOString(),
        });

        return apiOk({
          message: updatedMessage,
          thread: rt,
        });
      } catch (error) {
        const err = error as Error;
        threadLog.error('[IPC] Error updating message:', err);
        return apiFail(-1, err.message);
      }
    },
  );

  // Update message branch ID via Moku API
  ipcMain.handle(
    'thread:updateMessageBranch',
    async (
      _event,
      threadId: string,
      messageId: string,
      branchId: string,
    ): Promise<ApiResponse<MessageDTO>> => {
      return threadApiService.updateRequestBranch(threadId, messageId, branchId);
    },
  );

  // Update message desktop options via Moku API
  ipcMain.handle(
    'thread:updateMessageDesktopOptions',
    async (
      _event,
      threadId: string,
      messageId: string,
      desktopOptions: RequestOptionsDTO,
    ): Promise<ApiResponse<MessageDTO>> => {
      return threadApiService.updateRequestDesktopOptions(threadId, messageId, desktopOptions);
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
  ipcMain.removeHandler('thread:updateMessageBranch');
  ipcMain.removeHandler('thread:updateMessageDesktopOptions');
  threadLog.info('Handlers unregistered');
}
