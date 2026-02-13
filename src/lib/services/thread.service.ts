/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Thread } from '../../../src-electron/preload.js';
import { threads } from '../stores/thread.store.js';
import type { Message } from '$lib/types/thread.type.js';
import { wrapElectronCall, wrapElectronCallWithFallback } from '$lib/utils/apiWrapper';
import { BaseElectronService } from './base-electron.service';
import { getNextVariationBranchId } from '$lib/utils/branch-utils';
import { formatResponseContent } from '$lib/utils/response-formatter';

export class ThreadService extends BaseElectronService {
  // Map: "threadId:branchId" -> Set of callbacks for streaming tokens
  private streamCallbacks = new Map<string, Set<(token: string) => void>>();

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

    // Listen for streaming token events
    const unsubTokens = window.electronAPI.chat.onToken((data: {
      threadId: string;
      branchId: string;
      token: string;
    }) => {
      if (!data.branchId) {
        console.error('[ThreadService] Token event missing branchId - this is an error!', data);
        return;
      }

      const key = this.buildStreamKey(data.threadId, data.branchId);
      const callbacks = this.streamCallbacks.get(key);

      if (callbacks) {
        callbacks.forEach(callback => callback(data.token));
      } else {
        console.warn('[ThreadService] No subscribers for stream:', key);
      }
    });
    this.registerCleanup(unsubTokens);
  }

  /**
   * Subscribe to streaming tokens for a specific thread + branch
   * branchId format: "1.0", "1.1", "2.1.3", etc. - uniquely identifies message stream
   * @returns Unsubscribe function
   */
  subscribeToStream(
    threadId: string,
    branchId: string,
    callback: (token: string) => void
  ): () => void {
    if (!threadId || !branchId) {
      throw new Error('[ThreadService] threadId and branchId are required for stream subscription');
    }

    const key = this.buildStreamKey(threadId, branchId);

    if (!this.streamCallbacks.has(key)) {
      this.streamCallbacks.set(key, new Set());
    }
    this.streamCallbacks.get(key)!.add(callback);

    console.log('[ThreadService] Subscribed to stream:', key);

    // Return unsubscribe function
    return () => {
      const callbacks = this.streamCallbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.streamCallbacks.delete(key);
          console.log('[ThreadService] Unsubscribed from stream:', key);
        }
      }
    };
  }

  /**
   * Send chat message to specific thread + branch
   */
  /**
   * Calculate the next branchId based on a given branchId or the last message in thread
   * @param threadId - The thread ID
   * @param lastMessageBranchId - Optional branchId to base calculation on. If blank, uses last main lane message
   * @returns The calculated next branchId
   */
  async calculateNextBranchId(threadId: string, lastMessageBranchId?: string): Promise<string> {
    try {
      let baseBranchId: string;

      if (lastMessageBranchId && lastMessageBranchId.trim()) {
        // Use provided branchId
        baseBranchId = lastMessageBranchId;
      } else {
        // Find last message in main lane (lane 0)
        const messages = await this.getMessages(threadId);

        if (messages.length === 0) {
          // First message in thread
          console.log('[ThreadService] First message in thread, using branchId: 1.0.0');
          return '1.0.0';
        }

        // Find last message in main lane (where second part is 0)
        const mainLaneMessages = messages.filter(m => {
          const parts = (m.branchId || '').split('.');
          const lane = parseInt(parts[1]) || 0;
          return lane === 0;
        });

        if (mainLaneMessages.length > 0) {
          baseBranchId = mainLaneMessages[mainLaneMessages.length - 1].branchId || '0.0.0';
        } else {
          // No main lane messages, use last message
          baseBranchId = messages[messages.length - 1].branchId || '0.0.0';
        }
      }

      // Parse the branchId (format: "row.lane.iteration")
      const parts = baseBranchId.split('.');
      const row = parseInt(parts[0]) || 0;
      const lane = parseInt(parts[1]) || 0;
      const iteration = parseInt(parts[2]) || 0;

      let nextBranchId: string;

      if (lane === 0) {
        // Main lane (no branch) - increment row, reset iteration to 0
        nextBranchId = `${row + 1}.0.0`;
      } else {
        // Branch lane - increment iteration, keep row and lane
        nextBranchId = `${row}.${lane}.${iteration + 1}`;
      }

      console.log('[ThreadService] Calculated next branchId:', {
        baseBranchId,
        nextBranchId,
        rule: lane === 0 ? 'main lane: increment row' : 'branch lane: increment iteration'
      });

      return nextBranchId;
    } catch (error) {
      console.error('[ThreadService] Failed to calculate next branchId, using default: 1.0.0', error);
      return '1.0.0';
    }
  }

  async sendChatMessage(
    threadId: string,
    branchId: string,
    request: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    if (!threadId || !branchId) {
      throw new Error('[ThreadService] threadId and branchId are required for chat message');
    }

    const payload = {
      ...request,
      thread_id: threadId,
      branch_id: branchId,
    };

    return await wrapElectronCall(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => window.electronAPI.chat.chat(threadId, payload as any),
      'Failed to send chat message'
    );
  }

  /**
   * Build stream key from threadId and branchId
   */
  private buildStreamKey(threadId: string, branchId: string): string {
    return `${threadId}:${branchId}`;
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

  /**
   * Create a thread with an initial prompt message
   * @param projectId - Project ID to associate the thread with (optional)
   * @param modelAccessName - Model access name to use
   * @param prompt - Initial message content
   * @param status - Thread status (defaults to ACTIVE)
   * @returns Thread ID
   */
  async createThreadWithPrompt(
    projectId: string | null,
    modelAccessName: string,
    prompt: string,
    status: string = 'active'
  ): Promise<string> {
    // Get model details
    const models = await wrapElectronCall(
      () => window.electronAPI.models.listAll(),
      'Failed to get models'
    );
    const modelDetails = models.find(m => m.accessName === modelAccessName);

    if (!modelDetails) {
      throw new Error('Model not found');
    }

    // Create thread metadata
    const metadata: Record<string, unknown> = {
      modelTitle: modelDetails.title,
      modelProvider: modelDetails.provider,
      modelId: modelDetails.id,
      modelAccessName: modelDetails.accessName,
    };

    if (projectId) {
      metadata.projectId = projectId;
    }

    // Create thread
    const thread = await wrapElectronCall(
      () => window.electronAPI.thread.create({
        title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
        description: '',
        status,
        metadata,
      }),
      'Failed to create thread'
    );

    const threadId = thread.id;

    // Send initial message
    await wrapElectronCall(
      () => window.electronAPI.chat.sendMessage({
        threadId,
        branchId: '1.0',
        content: prompt,
        modelId: modelDetails.id,
      }),
      'Failed to send initial message'
    );

    return threadId;
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
    const thread = await wrapElectronCall(() => window.electronAPI.thread.getById(id), 'Failed to get thread');
    if (thread) {
      threads.addThread(thread);
    }
    return thread;
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
      branchId?: string;
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

    if (typeof payload.branchId === 'string' && payload.branchId.length > 0) {
      (wirePayload as Record<string, unknown>).branch_id = payload.branchId;
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

  /**
   * Switch the active branch for a thread
   */
  async switchBranch(
    threadId: string,
    branchId: string,
  ): Promise<{ success: true; thread: Thread } | { success: false; error: string }> {
    return wrapElectronCall(async () => {
      const result = await window.electronAPI.thread.switchBranch(threadId, branchId);
      if (result.success && result.thread) {
        return { success: true, thread: result.thread };
      }
      if (!result.success) {
        const errorMessage: string = typeof result.error === 'string' ? result.error : 'Failed to switch branch';
        return { success: false, error: errorMessage };
      }
      return { success: false, error: 'Failed to switch branch' };
    }, 'Failed to switch branch');
  }

  /**
   * Delete a branch from a thread
   */
  async deleteBranch(
    threadId: string,
    branchId: string,
  ): Promise<{ success: true } | { success: false; error: string }> {
    return wrapElectronCall(async () => {
      const result = await window.electronAPI.thread.deleteBranch(threadId, branchId);
      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to delete branch' };
    }, 'Failed to delete branch');
  }

  /**
   * Create a variation of a message using new branchId hierarchy
   * @param thread - The thread to create variation in
   * @param originalMessage - The message to create a variation from
   * @param variationContent - The content for the variation (if different from original)
   * @param modelId - Optional model ID for the variation
   * @param currentMessages - Optional current messages array to use instead of fetching from backend
   *                         (useful when creating multiple variations to avoid race conditions)
   */
  async createVariation(
    thread: Thread,
    originalMessage: Message,
    variationContent?: string,
    modelId?: string,
    currentMessages?: Message[],
  ): Promise<
    | { success: true; message: Message; newBranchId: string }
    | { success: false; error: string }
  > {
    // Generate next branchId hierarchically from the original message's branchId
    // E.g., "1.0" -> "1.0.1", "1.0" -> "1.0.2" (if 1.0.1 exists)
    // Use provided messages if available (for multiple variations), otherwise fetch from backend
    const messages = currentMessages ?? await this.getMessages(thread.id);
    const newBranchId = getNextVariationBranchId(originalMessage.branchId, messages);

    const clientMessageId = crypto.randomUUID();
    const content = variationContent ?? originalMessage.content;
    // Use provided modelId or fall back to original message's modelId
    const finalModelId = modelId ?? originalMessage.modelId;
    
    // Create variation message with new branchId
    const res = await this.appendMessage(thread.id, {
      role: 'user',
      content: content,
      metadata: { modelId: finalModelId },
      clientMessageId,
      branchId: newBranchId,
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    const message: Message = {
      id: res.message.id,
      role: 'user',
      content: content,
      createdAt: res.message.createdAt,
      clientMessageId,
      branchId: newBranchId,
      modelId: finalModelId,
    };

    return { success: true, message, newBranchId };
  }

  /**
   * Build display items from messages - handles both regular messages and branches
   * Returns an array of items that can be either single messages or branches with multiple lanes
   */
  buildDisplayItems(messages: Message[], isStreaming: boolean = false, responseText: string = ''): DisplayItem[] {
    if (messages.length === 0) {
      return [];
    }

    // Sort messages by branchId first
    const sortedMessages = [...messages].sort((a, b) => {
      const [aRow, aLane, aIter] = a.branchId.split('.').map(Number);
      const [bRow, bLane, bIter] = b.branchId.split('.').map(Number);

      // Sort by row, then lane, then iteration
      if (aRow !== bRow) {
        return aRow - bRow;
      }
      if (aLane !== bLane) {
        return aLane - bLane;
      }
      return aIter - bIter;
    });

    // Group messages by row (first number in branchId)
    const rowMap = new Map<number, Message[]>();

    for (const msg of sortedMessages) {
      const row = this.getBranchRow(msg.branchId);

      if (!rowMap.has(row)) {
        rowMap.set(row, []);
      }

      const rowArray = rowMap.get(row);
      if (rowArray) {
        rowArray.push(msg);
      }
    }

    // Build display items
    const items: DisplayItem[] = [];
    const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

    for (const row of sortedRows) {
      const rowMessages = rowMap.get(row);
      if (!rowMessages) {
        continue;
      }

      // Check if this row has branches (any message with lane != 0)
      const rowHasBranches = rowMessages.some((msg) => this.getBranchLane(msg.branchId) !== 0);

      if (!rowHasBranches) {
        // Single lane (main branch only) - display as regular message pairs
        const pairs = this.buildMessagePairs(rowMessages, isStreaming, responseText);

        for (const pair of pairs) {
          items.push({
            type: 'message',
            pair,
          });
        }
      } else {
        // Multiple lanes - display as branch
        const laneMap = new Map<string, Message[]>();

        for (const msg of rowMessages) {
          const laneKey = this.getLaneKey(msg.branchId);

          if (!laneMap.has(laneKey)) {
            laneMap.set(laneKey, []);
          }

          const laneArray = laneMap.get(laneKey);
          if (laneArray) {
            laneArray.push(msg);
          }
        }

        // Build lanes sorted by lane number
        const laneKeys = Array.from(laneMap.keys()).sort((a, b) => {
          const laneA = this.getBranchLane(a);
          const laneB = this.getBranchLane(b);
          return laneA - laneB;
        });

        const lanes: Lane[] = laneKeys.map((laneKey, index) => {
          const msgs = laneMap.get(laneKey);
          if (!msgs) {
            return {
              id: `lane-${row}-${index}`,
              branchId: laneKey,
              messagePairs: [],
              modelName: undefined,
            };
          }

          const pairs = this.buildMessagePairs(msgs, isStreaming, responseText);

          // Try to extract model name from first message
          const modelName = msgs[0]?.modelId ?? undefined;

          return {
            id: `lane-${row}-${index}`,
            branchId: laneKey,
            messagePairs: pairs,
            modelName,
          };
        });

        items.push({
          type: 'branch',
          id: `branch-${row}`,
          position: row,
          lanes,
        });
      }
    }

    return items;
  }

  /**
   * Parse branchId to extract row number
   * "1.0" → 1, "2.1.3" → 2
   */
  private getBranchRow(branchId: string): number {
    const [firstPart] = branchId.split('.');
    return parseInt(firstPart) ?? 0;
  }

  /**
   * Parse branchId to extract lane number
   * "1.0" → 0, "1.1" → 1, "2.1.3" → 1
   */
  private getBranchLane(branchId: string): number {
    const [, secondPart] = branchId.split('.');
    return secondPart ? (parseInt(secondPart) ?? 0) : 0;
  }

  /**
   * Get lane key (first two parts of branchId)
   * "1.0" → "1.0", "2.1.3" → "2.1"
   */
  private getLaneKey(branchId: string): string {
    const parts = branchId.split('.');
    return parts.slice(0, 2).join('.');
  }

  /**
   * Build message pairs from a list of messages
   * Formats response content based on the provider for each message
   */
  private buildMessagePairs(msgs: Message[], isStreaming: boolean, responseText: string): MessagePair[] {
    const pairs: MessagePair[] = [];
    let i = 0;
    while (i < msgs.length) {
      const msg = msgs[i];
      if (msg.role === 'user') {
        const next = i + 1 < msgs.length ? msgs[i + 1] : null;
        if (next && next.role === 'assistant') {
          // Get provider from message metadata
          const provider = (next.metadata?.provider as string) || '';
          const modelId = next.modelId || msg.modelId || '';

          console.log('[ThreadService] Formatting response:', {
            provider,
            modelId,
            contentType: typeof next.content,
            contentPreview: typeof next.content === 'string' ? next.content.substring(0, 100) : next.content
          });

          // Format the response content based on provider and model ID
          const formattedContent = formatResponseContent(next.content, provider, modelId);

          console.log('[ThreadService] Formatted content preview:', formattedContent.substring(0, 100));

          const formattedResponse = {
            ...next,
            content: formattedContent,
          };

          pairs.push({
            request: msg,
            response: formattedResponse,
            isStreamingResponse: false,
            streamingContent: '',
          });
          i += 2;
        } else {
          // User message without response yet — might be streaming
          const isLastMessage = i === msgs.length - 1;
          pairs.push({
            request: msg,
            response: null,
            isStreamingResponse: isLastMessage && isStreaming,
            streamingContent: isLastMessage && isStreaming ? responseText : '',
          });
          i += 1;
        }
      } else {
        // Orphan assistant message (shouldn't happen normally)
        i += 1;
      }
    }
    return pairs;
  }
}

// Export types for use in components
export interface MessagePair {
  request: Message;
  response: Message | null;
  isStreamingResponse: boolean;
  streamingContent: string;
}

export interface Lane {
  id: string;
  branchId: string;
  messagePairs: MessagePair[];
  modelName?: string;
}

export interface MessageDisplay {
  type: 'message';
  pair: MessagePair;
}

export interface BranchDisplay {
  type: 'branch';
  id: string;
  position: number;
  lanes: Lane[];
}

export type DisplayItem = MessageDisplay | BranchDisplay;

export const threadService = ThreadService.getInstance();
