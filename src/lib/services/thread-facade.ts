/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type {
  Thread,
  ModelDetails,
  MessageDTO,
  RequestOptionsDTO,
  ApiResponse,
} from '../../../src-electron/preload.js';
import type { Message } from '$lib/types/thread.type.js';
import { ThreadContext } from '$lib/utils/thread-context';
import { ThreadDisplay } from '$lib/utils/thread-display';
import { threadStreamService } from './thread-stream.service';
import { threadCrudService } from './thread-crud.service';
import { threadMessageService } from './thread-message.service';
import { threadBranchService } from './thread-branch.service';

// Re-export domain types for backward compatibility
export type { StreamingSession, BackgroundStream } from './thread-stream.service';
export type {
  MessagePair,
  Lane,
  MessageDisplay,
  BranchDisplay,
  DisplayItem,
} from '$lib/utils/thread-display';

/**
 * Stateless facade that provides a unified public API for all thread operations.
 *
 * Most methods are simple delegations to the four domain services:
 *   - ThreadCrudService     (create, update, delete, list, move)
 *   - ThreadMessageService  (sendChatMessage, appendMessage, appendPrompt, submitPromptToChat)
 *   - ThreadStreamService   (subscribe, streaming sessions, background streams, merge)
 *   - ThreadBranchService   (selectBranchLane, deleteBranch)
 *
 * Multi-statement methods that coordinate across services live here
 * (getMessages, calculateNextBranchId, createVariation) — all stateless,
 * each ≤15 statements.
 */
class ThreadFacade {
  // ── CRUD delegations ──

  getAll(options?: {
    projectId?: string | null;
    includeProjectOnly?: boolean;
    updateStore?: boolean;
  }): Promise<ApiResponse<Thread[]>> {
    return threadCrudService.getAll(options);
  }

  listPersonal(): Promise<ApiResponse<Thread[]>> {
    return threadCrudService.listPersonal();
  }

  listForProject(projectId: string): Promise<ApiResponse<Thread[]>> {
    return threadCrudService.listForProject(projectId);
  }

  create(
    title: string,
    projectId: string | null,
    agentId: string,
    initialModel?: string,
  ): Promise<ApiResponse<Thread>> {
    return threadCrudService.create(title, projectId, agentId, initialModel);
  }

  update(id: string, updates: Partial<Thread>): Promise<ApiResponse<Thread>> {
    return threadCrudService.update(id, updates);
  }

  rename(threadId: string, newTitle: string): Promise<ApiResponse<Thread>> {
    return threadCrudService.rename(threadId, newTitle);
  }

  delete(id: string): Promise<ApiResponse<boolean>> {
    return threadCrudService.delete(id);
  }

  softDelete(id: string): Promise<ApiResponse<boolean>> {
    return threadCrudService.softDelete(id);
  }

  getThread(id: string): Promise<ApiResponse<Thread | null>> {
    return threadCrudService.getThread(id);
  }

  moveToProject(
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ): Promise<ApiResponse<Thread>> {
    return threadCrudService.moveToProject(threadId, targetProjectId, options);
  }

  isAgentAvailable(agentId: string | null | undefined): Promise<boolean> {
    return threadCrudService.isAgentAvailable(agentId);
  }

  // ── Message delegations ──

  sendChatMessage(
    threadId: string,
    branchId: string,
    request: Record<string, unknown>,
  ): Promise<ApiResponse<void>> {
    return threadMessageService.sendChatMessage(threadId, branchId, request);
  }

  appendMessage(
    threadId: string,
    payload: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
      branchId?: string;
      modelName?: string;
    },
  ): Promise<ApiResponse<{ message: Message; thread: Thread }>> {
    return threadMessageService.appendMessage(threadId, payload);
  }

  appendPrompt(
    threadId: string,
    branchId: string,
    prompt: string,
    modelId: string,
    messages: Message[],
  ): Promise<[boolean, Message]> {
    return threadMessageService.appendPrompt(threadId, branchId, prompt, modelId, messages);
  }

  submitPromptToChat(
    threadId: string,
    branchId: string,
    modelId: string,
    messages: Message[],
  ): Promise<ApiResponse<null>> {
    return threadMessageService.submitPromptToChat(threadId, branchId, modelId, messages);
  }

  updateMessage(
    threadId: string,
    messageId: string,
    newContent: string,
  ): Promise<ApiResponse<{ message: Message; thread: Thread }>> {
    return threadMessageService.updateMessage(threadId, messageId, newContent);
  }

  updateMessageBranch(
    threadId: string,
    messageId: string,
    branchId: string,
  ): Promise<ApiResponse<MessageDTO>> {
    return threadMessageService.updateMessageBranch(threadId, messageId, branchId);
  }

  updateMessageDesktopOptions(
    threadId: string,
    messageId: string,
    desktopOptions: RequestOptionsDTO,
  ): Promise<ApiResponse<MessageDTO>> {
    return threadMessageService.updateMessageDesktopOptions(threadId, messageId, desktopOptions);
  }

  // ── Stream delegations ──

  subscribeToStream(
    threadId: string,
    branchId: string,
    callback: (token: string) => void,
  ): () => void {
    return threadStreamService.subscribeToStream(threadId, branchId, callback);
  }

  unsubscribeAllForThread(threadId: string): void {
    threadStreamService.unsubscribeAllForThread(threadId);
  }

  registerStreamingSession(
    threadId: string,
    branchId: string,
    userMessage: Message,
    modelId?: string,
  ): void {
    threadStreamService.registerStreamingSession(threadId, branchId, userMessage, modelId);
  }

  updateStreamingContent(threadId: string, content: string): void {
    threadStreamService.updateStreamingContent(threadId, content);
  }

  clearStreamingSession(threadId: string): void {
    threadStreamService.clearStreamingSession(threadId);
  }

  hasStreamingSession(threadId: string): boolean {
    return threadStreamService.hasStreamingSession(threadId);
  }

  getStreamingSession(threadId: string): import('./thread-stream.service').StreamingSession | undefined {
    return threadStreamService.getStreamingSession(threadId);
  }

  getBackgroundStream(threadId: string): import('./thread-stream.service').BackgroundStream | undefined {
    return threadStreamService.getBackgroundStream(threadId);
  }

  setBackgroundStream(
    threadId: string,
    stream: import('./thread-stream.service').BackgroundStream,
  ): void {
    threadStreamService.setBackgroundStream(threadId, stream);
  }

  deleteBackgroundStream(threadId: string): void {
    threadStreamService.deleteBackgroundStream(threadId);
  }

  hasBackgroundStream(threadId: string): boolean {
    return threadStreamService.hasBackgroundStream(threadId);
  }

  // ── Branch delegations ──

  selectBranchLane(
    threadId: string,
    selectedLaneBranchId: string,
    messages: Message[],
  ): Promise<void> {
    return threadBranchService.selectBranchLane(threadId, selectedLaneBranchId, messages);
  }

  deleteBranch(threadId: string, branchId: string): Promise<ApiResponse<void>> {
    return threadBranchService.deleteBranch(threadId, branchId);
  }

  // ── Cross-domain methods (facade-level coordination) ──

  /**
   * Fetch messages for a thread, merging in any active streaming session data.
   * Crosses Message + Stream domains.
   */
  async getMessages(id: string): Promise<ApiResponse<Message[]>> {
    const result = await window.electronAPI.thread.getMessages(id);
    if (!result.success) {
      return result;
    }

    const session = threadStreamService.getStreamingSession(id);
    if (!session) {
      // No active streaming — return API messages as-is
      return result;
    }

    // Merge streaming data with API results
    return {
      ...result,
      data: threadStreamService.mergeStreamingMessages(result.data, session),
    };
  }

  /**
   * Calculate the next branchId based on a given branchId or the last message in thread.
   * Crosses Message + Branch logic (reads messages, computes branch numbering).
   *
   * @param threadId - The thread ID
   * @param lastMessageBranchId - Optional branchId to base calculation on. If blank, uses last main lane message
   * @returns The calculated next branchId
   */
  async calculateNextBranchId(threadId: string, lastMessageBranchId?: string): Promise<string> {
    try {
      let baseBranchId: string;

      if (lastMessageBranchId?.trim()) {
        // Use provided branchId
        baseBranchId = lastMessageBranchId;
      } else {
        // Find last message in main lane (lane 0)
        const messagesResult = await this.getMessages(threadId);
        const messages = messagesResult.success ? messagesResult.data : [];

        if (messages.length === 0) {
          // First message in thread
          return '1.0.0';
        }

        // Find last message in main lane (where second part is 0)
        const mainLaneMessages = messages.filter((m) => {
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

      return nextBranchId;
    } catch (error) {
      console.error(
        '[ThreadFacade] Failed to calculate next branchId, using default: 1.0.0',
        error,
      );
      return '1.0.0';
    }
  }

  /**
   * Create a variation of a message using new branchId hierarchy.
   * Crosses Message + Branch domains (reads messages, computes branch ID, appends message).
   *
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
    { success: true; message: Message; newBranchId: string } | { success: false; error: string }
  > {
    // Use provided messages if available (for multiple variations), otherwise fetch from backend
    let messages: Message[];
    if (currentMessages) {
      messages = currentMessages;
    } else {
      const messagesResult = await this.getMessages(thread.id);
      messages = messagesResult.success ? messagesResult.data : [];
    }
    const newBranchId = ThreadContext.getNextVariationBranchId(originalMessage.branchId, messages);

    const clientMessageId = crypto.randomUUID();
    const content = variationContent ?? originalMessage.content;
    // Use provided modelId or fall back to original message's modelId
    const finalModelId = modelId ?? originalMessage.modelId;

    // Create variation message with new branchId
    const res = await threadMessageService.appendMessage(thread.id, {
      role: 'user',
      content: content,
      metadata: { modelId: finalModelId },
      clientMessageId,
      branchId: newBranchId,
    });

    if (!res.success) {
      return { success: false, error: res.errorText };
    }

    const message: Message = {
      id: res.data.message.id,
      threadId: thread.id ?? '',
      role: 'user',
      content: content,
      createdAt: res.data.message.createdAt,
      clientMessageId,
      branchId: newBranchId,
      modelId: finalModelId,
    };

    return { success: true, message, newBranchId };
  }

  // ── Display delegation ──

  /**
   * Build display items from messages — delegates to ThreadDisplay static class.
   * Kept as an instance method for backward compatibility with Svelte component calls.
   */
  buildDisplayItems(
    messages: Message[],
    isStreaming: boolean = false,
    responseText: string = '',
    availableModels: ModelDetails[] = [],
    expandedBranchRows: Set<number> = new Set(),
  ): ReturnType<typeof ThreadDisplay.buildDisplayItems> {
    return ThreadDisplay.buildDisplayItems(
      messages,
      isStreaming,
      responseText,
      availableModels,
      expandedBranchRows,
    );
  }
}

export const threadFacade = new ThreadFacade();
