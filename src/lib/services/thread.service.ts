/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Thread } from '../../../src-electron/preload.js';
import { threads } from '../stores/thread.store.js';
import type { Message, BranchType } from '$lib/types/thread.type.js';
import { getNextBranchIndex } from '$lib/utils/branch-utils.js';

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

  async getAll(options?: {
    projectId?: string | null;
    includeProjectOnly?: boolean;
  }): Promise<Thread[]> {
    const allThreads = await window.electronAPI.thread.getAll(options);
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

  async softDelete(id: string): Promise<boolean> {
    return window.electronAPI.thread.softDelete(id);
  }

  async getThread(id: string): Promise<Thread | null> {
    return window.electronAPI.thread.getById(id);
  }

  async getMessages(id: string): Promise<Message[]> {
    return window.electronAPI.thread.getMessages(id);
  }

  async moveToProject(
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ): Promise<Thread> {
    return window.electronAPI.thread.moveToProject(threadId, targetProjectId, options);
  }

  async appendMessage(
    threadId: string,
    payload: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
      parentMessageId?: string | null;
      branchIndex?: number;
      branchType?: BranchType;
      modelId?: string | null;
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
    if (payload.parentMessageId !== undefined) {
      (wirePayload as Record<string, unknown>).parent_message_id = payload.parentMessageId;
    }
    if (payload.branchIndex !== undefined) {
      (wirePayload as Record<string, unknown>).branch_index = payload.branchIndex;
    }
    if (payload.branchType !== undefined && payload.branchType !== null) {
      (wirePayload as Record<string, unknown>).branch_type = payload.branchType;
    }
    if (payload.modelId !== undefined && payload.modelId !== null) {
      (wirePayload as Record<string, unknown>).model_id = payload.modelId;
    }
    const res: unknown = await window.electronAPI.thread.appendMessage(threadId, wirePayload);
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
    const res: unknown = await window.electronAPI.thread.updateMessage(
      threadId,
      messageId,
      newContent,
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
    const res: unknown = await window.electronAPI.thread.updateMessageMetadata(
      threadId,
      messageId,
      metadataUpdates,
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
    const res: unknown = await window.electronAPI.thread.getMessageVersions(threadId, messageId);
    return res as
      | { success: true; versions: Array<{ content: string; editedAt: number }> }
      | { success: false; error: string };
  }

  async deleteMessagesAfter(
    threadId: string,
    messageId: string,
  ): Promise<{ success: true; thread: Thread } | { success: false; error: string }> {
    const res: unknown = await window.electronAPI.thread.deleteMessagesAfter(threadId, messageId);
    return res as { success: true; thread: Thread } | { success: false; error: string };
  }

  /**
   * Create a prompt or model variation branch
   * @param threadId - Thread ID
   * @param originalMessageId - The user message being varied (we'll use its parent as the branch point)
   * @param content - New prompt content
   * @param branchType - 'prompt-variation' or 'model-variation'
   * @param modelId - Model ID (required for model-variation)
   * @param messages - Current messages array for calculating branch index
   */
  async createVariation(
    threadId: string,
    originalMessageId: string,
    content: string,
    branchType: BranchType,
    modelId: string | null,
    messages: Message[],
  ): Promise<
    | { success: true; message: Message; branchIndex: number }
    | { success: false; error: string }
  > {
    // Find the original message to get its parent
    const originalMessage = messages.find((m) => m.id === originalMessageId);
    if (!originalMessage) {
      return { success: false, error: 'Original message not found' };
    }

    // The parent of the variation is the original user message itself
    const parentMessageId = originalMessageId;

    // Calculate next branch index for this specific user message (will throw if limit reached)
    let branchIndex: number;
    try {
      branchIndex = getNextBranchIndex(messages, parentMessageId, branchType);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Branch limit reached' };
    }

    const clientMessageId = crypto.randomUUID();

    const res = await this.appendMessage(threadId, {
      role: 'user',
      content,
      metadata: {},
      clientMessageId,
      parentMessageId,
      branchIndex,
      branchType,
      modelId,
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    const message: Message = {
      id: res.message.id,
      role: 'user',
      content,
      createdAt: res.message.createdAt,
      clientMessageId,
      parentMessageId,
      branchIndex,
      branchType,
      modelId,
    };

    return { success: true, message, branchIndex };
  }
}

export const threadService = new ThreadService();
