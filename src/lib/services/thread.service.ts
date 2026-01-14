/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Thread } from '../../../src-electron/preload.js';
import { threads } from '../stores/thread.store.js';
import type { Message } from '$lib/types/thread.type.js';
import { wrapElectronCall, wrapElectronCallWithFallback } from '$lib/utils/apiWrapper';
import { BaseElectronService } from './base-electron.service';

export class ThreadService extends BaseElectronService {
  private constructor() {
    super();
  }

  public static getInstance(): ThreadService {
    return this.getSingletonInstance();
  }

  protected initializeEventListeners(): void {
    // Listen for thread created events
    const unsubCreated = window.electronAPI.thread.onThreadCreated((thread: Thread) => {
      threads.addThread(thread);
    });
    this.registerCleanup(unsubCreated);

    // Listen for thread updated events
    const unsubUpdated = window.electronAPI.thread.onThreadUpdated((thread: Thread) => {
      threads.updateThread(thread);
    });
    this.registerCleanup(unsubUpdated);

    // Listen for thread deleted events
    const unsubDeleted = window.electronAPI.thread.onThreadDeleted((threadId: string) => {
      threads.deleteThread(threadId);
    });
    this.registerCleanup(unsubDeleted);
  }

  async getAll(options?: {
    projectId?: string | null;
    includeProjectOnly?: boolean;
    updateStore?: boolean;
  }): Promise<Thread[]> {
    const allThreads = await wrapElectronCall(
      () => window.electronAPI.thread.getAll(options),
      'Failed to load threads',
    );

    if (options?.updateStore !== false) {
      threads.setThreads(allThreads);
    }

    return allThreads;
  }

  /**
   * Get only personal threads (threads without a projectId)
   */
  async listPersonal(): Promise<Thread[]> {
    return this.getAll({ projectId: null, updateStore: true });
  }

  /**
   * Get threads for a specific project
   */
  async listForProject(projectId: string): Promise<Thread[]> {
    return this.getAll({ projectId, updateStore: true });
  }

  async create(data: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>): Promise<Thread> {
    return wrapElectronCall(
      () => window.electronAPI.thread.create(data),
      'Failed to create thread',
    );
  }

  async update(id: string, updates: Partial<Thread>): Promise<Thread> {
    return wrapElectronCall(
      () => window.electronAPI.thread.update(id, updates),
      'Failed to update thread',
    );
  }

  async rename(
    threadId: string,
    newTitle: string,
  ): Promise<
    | { success: true; thread: Thread }
    | { success: false; status: number; error: string; code?: string }
  > {
    return wrapElectronCall(
      () => window.electronAPI.thread.renameThread(threadId, newTitle),
      'Failed to rename thread',
    );
  }

  async delete(id: string): Promise<boolean> {
    return wrapElectronCall(() => window.electronAPI.thread.delete(id), 'Failed to delete thread');
  }

  async softDelete(id: string): Promise<boolean> {
    return wrapElectronCall(
      () => window.electronAPI.thread.softDelete(id),
      'Failed to soft delete thread',
    );
  }

  async getThread(id: string): Promise<Thread | null> {
    return wrapElectronCall(() => window.electronAPI.thread.getById(id), 'Failed to get thread');
  }

  async getMessages(id: string): Promise<Message[]> {
    return wrapElectronCallWithFallback(
      () => window.electronAPI.thread.getMessages(id),
      'Failed to get thread messages',
      [],
    );
  }

  async moveToProject(
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ): Promise<Thread> {
    return wrapElectronCall(
      () => window.electronAPI.thread.moveToProject(threadId, targetProjectId, options),
      'Failed to move thread to project',
    );
  }

  async copyThread(
    threadId: string,
    targetProjectId: string | null,
    options?: { allowDuplicate?: boolean },
  ): Promise<Thread> {
    return wrapElectronCall(
      () => window.electronAPI.thread.copyThread(threadId, targetProjectId, options),
      'Failed to copy thread',
    );
  }

  async checkLargeFiles(threadId: string): Promise<{
    needsConfirmation: boolean;
    totalSize: number;
    fileCount: number;
    estimatedTransferTime?: number;
    largeFiles?: Array<{ filename: string; size: number }>;
  }> {
    return wrapElectronCall(
      () => window.electronAPI.thread.checkLargeFiles(threadId),
      'Failed to check large files',
    );
  }

  async checkDuplicate(
    threadId: string,
    targetProjectId: string | null,
  ): Promise<{
    isDuplicate: boolean;
    previousCopyDate?: number;
    previousThreadId?: string;
  }> {
    return wrapElectronCall(
      () => window.electronAPI.thread.checkDuplicate(threadId, targetProjectId),
      'Failed to check duplicate',
    );
  }

  async cancelCopy(operationId: string): Promise<void> {
    return wrapElectronCall(
      () => window.electronAPI.thread.cancelCopy(operationId),
      'Failed to cancel copy operation',
    );
  }

  async getCopyProgress(operationId: string): Promise<{
    operationId: string;
    phase: string;
    filesTotal: number;
    filesCompleted: number;
    bytesTotal: number;
    bytesTransferred: number;
    currentFile?: string;
    estimatedTimeRemaining?: number;
  } | null> {
    return wrapElectronCall(
      () => window.electronAPI.thread.getCopyProgress(operationId),
      'Failed to get copy progress',
    );
  }

  async appendMessage(
    threadId: string,
    payload: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
    },
  ): Promise<
    | {
        success: true;
        message: { id: string; role: string; content: string; createdAt: number };
        thread: Thread;
      }
    | { success: false; status: number; error: string; threadId?: string }
  > {
    type AppendWire = {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
    } & Record<string, unknown>;
    const wirePayload: AppendWire = {
      role: payload.role,
      content: payload.content,
      metadata: payload.metadata,
    };
    if (typeof payload.clientMessageId === 'string' && payload.clientMessageId.length > 0) {
      (wirePayload as Record<string, unknown>).client_message_id = payload.clientMessageId;
    }

    const res: unknown = await wrapElectronCall(
      () => window.electronAPI.thread.appendMessage(threadId, wirePayload),
      'Failed to append message to thread',
    );

    if (
      typeof res === 'object' &&
      res !== null &&
      (res as { success?: boolean }).success === true
    ) {
      return res as {
        success: true;
        message: { id: string; role: string; content: string; createdAt: number };
        thread: Thread;
      };
    }
    const failure = res as { status: number; error: string } & Record<string, unknown>;
    let threadIdCamel: string | undefined;
    const maybeThreadId = (failure as Record<string, unknown>).thread_id;
    if (typeof maybeThreadId === 'string') {
      threadIdCamel = maybeThreadId;
    }
    return {
      success: false,
      status: failure.status,
      error: failure.error,
      threadId: threadIdCamel,
    };
  }

  async updateMessage(
    threadId: string,
    messageId: string,
    newContent: string,
  ): Promise<
    { success: true; message: Message; thread: Thread } | { success: false; error: string }
  > {
    const res: unknown = await wrapElectronCall(
      () => window.electronAPI.thread.updateMessage(threadId, messageId, newContent),
      'Failed to update message',
    );
    return res as
      | { success: true; message: Message; thread: Thread }
      | { success: false; error: string };
  }

  async updateMessageMetadata(
    threadId: string,
    messageId: string,
    metadataUpdates: Record<string, unknown>,
  ): Promise<
    { success: true; message: Message; thread: Thread } | { success: false; error: string }
  > {
    const res: unknown = await wrapElectronCall(
      () => window.electronAPI.thread.updateMessageMetadata(threadId, messageId, metadataUpdates),
      'Failed to update message metadata',
    );
    return res as
      | { success: true; message: Message; thread: Thread }
      | { success: false; error: string };
  }

  /**
   * Update or delete comment on a message
   * @param commentContent - The comment text, or null/empty to delete
   */
  async updateMessageComment(
    threadId: string,
    messageId: string,
    commentContent: string | null,
  ): Promise<
    { success: true; message: Message; thread: Thread } | { success: false; error: string }
  > {
    if (!commentContent || commentContent.trim() === '') {
      // Delete comment by setting it to undefined
      return this.updateMessageMetadata(threadId, messageId, { comment: undefined });
    }

    // Get current message to check if comment already exists
    const messages = await this.getMessages(threadId);
    const currentMessage = messages.find((m) => m.id === messageId);
    const existingComment = currentMessage?.metadata?.comment as
      | { content: string; createdAt: number; editedAt?: number }
      | undefined;

    const now = Date.now();
    const comment = {
      content: commentContent.trim(),
      createdAt: existingComment?.createdAt ?? now,
      editedAt: now,
    };

    return this.updateMessageMetadata(threadId, messageId, { comment });
  }

  async getMessageVersions(
    threadId: string,
    messageId: string,
  ): Promise<
    | { success: true; versions: Array<{ content: string; editedAt: number }> }
    | { success: false; error: string }
  > {
    const res: unknown = await wrapElectronCall(
      () => window.electronAPI.thread.getMessageVersions(threadId, messageId),
      'Failed to get message versions',
    );
    return res as
      | { success: true; versions: Array<{ content: string; editedAt: number }> }
      | { success: false; error: string };
  }

  async deleteMessagesAfter(
    threadId: string,
    messageId: string,
  ): Promise<{ success: true; thread: Thread } | { success: false; error: string }> {
    const res: unknown = await wrapElectronCall(
      () => window.electronAPI.thread.deleteMessagesAfter(threadId, messageId),
      'Failed to delete messages',
    );
    return res as { success: true; thread: Thread } | { success: false; error: string };
  }
}

export const threadService = ThreadService.getInstance();
