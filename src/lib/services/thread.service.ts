/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type {
  Thread,
  CreateThreadRequest,
  ModelDetails,
  MessageDTO,
  RequestOptionsDTO,
  ApiResponse,
} from '../../../src-electron/preload.js';
import { threads } from '../stores/thread.store.js';
import type { Message } from '$lib/types/thread.type.js';
import { BaseElectronService } from './base-electron.service';
import { ThreadContext } from '$lib/utils/thread-context';
import { ThreadDisplay } from '$lib/utils/thread-display';
import type { ThreadMetadata } from '../../../src-electron/types/thread.types.js';

// Re-export display types for backward compatibility
export type {
  MessagePair,
  Lane,
  MessageDisplay,
  BranchDisplay,
  DisplayItem,
} from '$lib/utils/thread-display';

/**
 * Represents an active streaming session for a specific thread + branch.
 * Holds the user prompt message and the in-progress assistant response content
 * so that getMessages() can merge them with API results when the user switches
 * back to a thread mid-stream.
 */
export interface StreamingSession {
  threadId: string;
  branchId: string;
  userMessage: Message;
  assistantContent: string;
  modelId?: string;
}

/**
 * Represents a background stream for a thread.
 * Lives in the ThreadService singleton so it survives component destruction
 * (e.g., when ThreadPage sets loading=true and the {#if loading} conditional
 * removes ThreadChatView from the DOM).
 */
export interface BackgroundStream {
  threadId: string;
  branchId: string;
  accumulatedText: string;
  unsubscribe: (() => void) | null;
}

export class ThreadService extends BaseElectronService {
  // Map: "threadId:branchId" -> Set of callbacks for streaming tokens
  private streamCallbacks = new Map<string, Set<(token: string) => void>>();

  /**
   * Active streaming sessions keyed by threadId.
   * Registered when a prompt is submitted and streaming starts.
   * Updated as tokens arrive. Removed when streaming completes.
   * Used by getMessages() to merge streaming data with API results.
   */
  private streamingSessions = new Map<string, StreamingSession>();

  /**
   * Background streams keyed by threadId.
   * Each thread can have an independent background stream that survives
   * component destruction. Tokens keep accumulating even when the UI
   * component is torn down and re-created.
   */
  private backgroundStreams = new Map<string, BackgroundStream>();

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
    const unsubTokens = window.electronAPI.chat.onToken(
      (data: { threadId: string; branchId: string; token: string }) => {
        if (!data.branchId) {
          console.error('[ThreadService] Token event missing branchId - this is an error!', data);
          return;
        }

        const key = this.buildStreamKey(data.threadId, data.branchId);
        const callbacks = this.streamCallbacks.get(key);

        if (callbacks) {
          callbacks.forEach((callback) => callback(data.token));
        } else {
          console.warn('[ThreadService] No subscribers for stream:', key);
        }
      },
    );
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
    callback: (token: string) => void,
  ): () => void {
    if (!threadId || !branchId) {
      throw new Error('[ThreadService] threadId and branchId are required for stream subscription');
    }

    const key = this.buildStreamKey(threadId, branchId);

    if (!this.streamCallbacks.has(key)) {
      this.streamCallbacks.set(key, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.streamCallbacks.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.streamCallbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.streamCallbacks.delete(key);
        }
      }
    };
  }

  /**
   * Unsubscribe ALL stream callbacks for a given threadId.
   * Useful for cleaning up when navigating away from a thread.
   */
  unsubscribeAllForThread(threadId: string): void {
    const prefix = `${threadId}:`;
    for (const key of Array.from(this.streamCallbacks.keys())) {
      if (key.startsWith(prefix)) {
        this.streamCallbacks.delete(key);
      }
    }
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
        '[ThreadService] Failed to calculate next branchId, using default: 1.0.0',
        error,
      );
      return '1.0.0';
    }
  }

  async sendChatMessage(
    threadId: string,
    branchId: string,
    request: Record<string, unknown>,
  ): Promise<ApiResponse<void>> {
    if (!threadId || !branchId) {
      return {
        success: false,
        data: null,
        errorCode: -1,
        errorText: 'threadId and branchId are required for chat message',
      };
    }

    const payload = {
      ...request,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      thread_id: threadId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      branch_id: branchId,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return window.electronAPI.chat.chat(threadId, payload as any);
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
  }): Promise<ApiResponse<Thread[]>> {
    const result = await window.electronAPI.thread.getAll(options);

    if (result.success && options?.updateStore !== false) {
      threads.setThreads(result.data);
    }

    return result;
  }

  /**
   * Get only personal threads (threads without a projectId)
   */
  async listPersonal(): Promise<ApiResponse<Thread[]>> {
    return this.getAll({ projectId: null, updateStore: true });
  }

  /**
   * Get threads for a specific project
   */
  async listForProject(projectId: string): Promise<ApiResponse<Thread[]>> {
    return this.getAll({ projectId, updateStore: true });
  }

  /**
   *
   * create - creates a new thread
   *
   **/
  async create(
    title: string,
    projectId: string | null,
    agentId: string,
    initialModel?: string,
  ): Promise<ApiResponse<Thread>> {
    console.warn('[ThreadService.create] Starting thread creation', {
      title,
      projectId,
      agentId,
      initialModel,
    });

    let selectedModel: ModelDetails | undefined = undefined;
    const agentResult = await window.electronAPI.models.getAgent(agentId);

    if (!agentResult.success) {
      console.error('[ThreadService.create] Agent not found:', agentId);
      return {
        success: false,
        data: null,
        errorCode: -1,
        errorText: `Agent not found: ${agentId}`,
      };
    }
    const agent = agentResult.data;

    // Build metadata object with agent and model information
    const metadata: ThreadMetadata = {
      agentId,
      initialProvider: agent.provider,
      applicationSlug: agent.slug,
    };

    // find the model the caller specified
    if (initialModel) {
      const modelsResult = await window.electronAPI.models.getModelsForApplication(agentId);
      if (modelsResult.success) {
        selectedModel = modelsResult.data.find(
          (m) => m.id === initialModel || m.accessName === initialModel,
        );
      }
    }

    // or use the first one
    if (!selectedModel && agent.models && agent.models?.length > 0) {
      selectedModel = agent.models?.[0];
    }

    if (selectedModel) {
      metadata.modelTitle = selectedModel.title;
      metadata.initalModel = selectedModel.accessName;
      metadata.modelProvider = selectedModel.provider;
    } else {
      console.warn(
        '[ThreadService.create] No model selected - metadata will not include model info',
      );
    }

    const request: CreateThreadRequest = {
      title,
      projectId,
      agentId,
      applicationSlug: agent.slug,
      initalModel: initialModel ?? undefined,
      metadata,
    };
    console.warn('[ThreadService.create] Final request payload:', request);

    return window.electronAPI.thread.create(request);
  }

  async update(id: string, updates: Partial<Thread>): Promise<ApiResponse<Thread>> {
    return window.electronAPI.thread.update(id, updates);
  }

  async rename(threadId: string, newTitle: string): Promise<ApiResponse<Thread>> {
    return window.electronAPI.thread.renameThread(threadId, newTitle);
  }

  async delete(id: string): Promise<ApiResponse<boolean>> {
    return window.electronAPI.thread.delete(id);
  }

  async softDelete(id: string): Promise<ApiResponse<boolean>> {
    return window.electronAPI.thread.softDelete(id);
  }

  async getThread(id: string): Promise<ApiResponse<Thread | null>> {
    const result = await window.electronAPI.thread.getById(id);
    if (result.success && result.data) {
      threads.addThread(result.data);
    }
    return result;
  }

  // ── Streaming session management ──

  /**
   * Register a streaming session when a prompt is submitted and streaming starts.
   */
  registerStreamingSession(
    threadId: string,
    branchId: string,
    userMessage: Message,
    modelId?: string,
  ): void {
    this.streamingSessions.set(threadId, {
      threadId,
      branchId,
      userMessage,
      assistantContent: '',
      modelId,
    });
  }

  /**
   * Update the accumulated assistant content for an active streaming session.
   * Called by the token callback as tokens arrive.
   */
  updateStreamingContent(threadId: string, content: string): void {
    const session = this.streamingSessions.get(threadId);
    if (session) {
      session.assistantContent = content;
    }
  }

  /**
   * Remove a streaming session when streaming completes (success or error).
   */
  clearStreamingSession(threadId: string): void {
    this.streamingSessions.delete(threadId);
  }

  /**
   * Check if a thread has an active streaming session.
   */
  hasStreamingSession(threadId: string): boolean {
    return this.streamingSessions.has(threadId);
  }

  /**
   * Get the streaming session for a thread (if any).
   */
  getStreamingSession(threadId: string): StreamingSession | undefined {
    return this.streamingSessions.get(threadId);
  }

  // ── Background stream management ──

  /**
   * Get the background stream for a thread (if any).
   */
  getBackgroundStream(threadId: string): BackgroundStream | undefined {
    return this.backgroundStreams.get(threadId);
  }

  /**
   * Store a background stream for a thread.
   */
  setBackgroundStream(threadId: string, stream: BackgroundStream): void {
    this.backgroundStreams.set(threadId, stream);
  }

  /**
   * Remove a background stream for a thread.
   */
  deleteBackgroundStream(threadId: string): void {
    this.backgroundStreams.delete(threadId);
  }

  /**
   * Check if a thread has an active background stream.
   */
  hasBackgroundStream(threadId: string): boolean {
    return this.backgroundStreams.has(threadId);
  }

  // ── Message loading with streaming merge ──

  async getMessages(id: string): Promise<ApiResponse<Message[]>> {
    const result = await window.electronAPI.thread.getMessages(id);
    if (!result.success) {
      return result;
    }

    const session = this.streamingSessions.get(id);
    if (!session) {
      // No active streaming — return API messages as-is
      return result;
    }

    // Merge streaming data with API results
    return {
      ...result,
      data: this.mergeStreamingMessages(result.data, session),
    };
  }

  /**
   * Merge API messages with an active streaming session.
   *
   * Three cases (matched by branchId):
   * 1. API has neither the user prompt nor assistant response for this branch:
   *    → Append both the streaming user message and a synthetic assistant message.
   * 2. API has the user prompt but no assistant response for this branch:
   *    → Append a synthetic assistant message with the streaming content.
   * 3. API has both the user prompt and assistant response for this branch:
   *    → Use the API version (streaming is complete or nearly so).
   */
  private mergeStreamingMessages(apiMessages: Message[], session: StreamingSession): Message[] {
    const { branchId, userMessage, assistantContent, modelId } = session;

    const isuserPresent = apiMessages.some((m) => m.branchId === branchId && m.role === 'user');
    const isassistantPresent = apiMessages.some(
      (m) => m.branchId === branchId && m.role === 'assistant',
    );

    // Case 3: API has both — use API data, streaming is done or nearly done
    if (isuserPresent && isassistantPresent) {
      return apiMessages;
    }

    const merged = [...apiMessages];

    // Case 1: API has neither — append both
    if (!isuserPresent) {
      merged.push(userMessage);
    }

    // Case 1 & 2: API is missing the assistant response — append synthetic one
    if (!isassistantPresent && assistantContent) {
      merged.push({
        id: `streaming-${branchId}`,
        threadId: session.threadId,
        role: 'assistant',
        content: assistantContent,
        createdAt: Date.now(),
        branchId,
        modelId: modelId ?? null,
        isLocal: true,
      });
    }

    return merged;
  }

  async moveToProject(
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ): Promise<ApiResponse<Thread>> {
    return window.electronAPI.thread.moveToProject(threadId, targetProjectId, options);
  }

  async appendMessage(
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
    // Build wire payload with snake_case field mappings
    const wirePayload: Record<string, unknown> = {
      role: payload.role,
      content: payload.content,
      metadata: payload.metadata,
    };

    if (payload.clientMessageId) {
      wirePayload.client_message_id = payload.clientMessageId;
    }
    if (payload.branchId) {
      wirePayload.branch_id = payload.branchId;
    }
    if (payload.modelName) {
      wirePayload.model_name = payload.modelName;
    }

    return window.electronAPI.thread.appendMessage(
      threadId,
      wirePayload as {
        role: 'user' | 'assistant' | 'system';
        content: string;
        metadata?: Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        client_message_id?: string;
      },
    );
  }

  /**
   * Append a user prompt to a thread
   *
   * Creates a local 'user'  message and append it to the specified thread and branch.
   *
   * @param threadId - The ID of the thread to append to
   * @param branchId - The branch ID where the message should be added
   * @param prompt - The prompt text content
   * @param modelId - model ID to associate with the prompt
   * @param messages - Current messages array (for context/reference)
   * @returns A tuple of [success: boolean, message: Message] where success indicates if the append operation succeeded,
   *          and message is either the successfully created message or the local message object on failure
   *
   */

  async appendPrompt(
    threadId: string,
    branchId: string,
    prompt: string,
    modelId: string,
    _messages: Message[],
  ): Promise<[boolean, Message]> {
    // make sure we have a chat service
    const _result = await window.electronAPI.chat.createServiceForThread(
      threadId,
      branchId,
      modelId,
      '',
    );

    const clientMessageId = crypto.randomUUID();
    const newPromptMessage: Message = {
      id: clientMessageId,
      threadId: threadId,
      clientMessageId,
      role: 'user',
      content: prompt,
      createdAt: Date.now(),
      branchId,
      modelId: modelId,
    };

    try {
      const res = await this.appendMessage(threadId, {
        role: newPromptMessage.role,
        content: newPromptMessage.content,
        metadata: modelId ? { modelId } : {},
        clientMessageId,
        branchId,
      });

      if (!res.success) {
        return [false, newPromptMessage];
      }

      return [true, newPromptMessage];
    } catch (error) {
      console.error('[ThreadService.appendPrompt] Exception:', error);
      return [false, newPromptMessage];
    }
  }

  /**
   * Append a user prompt to a thread
   *
   * Creates a local 'user'  message and append it to the specified thread and branch.
   *
   * @param threadId - The ID of the thread to append to
   * @param branchId - The branch ID where the message should be added
   * @param prompt - The prompt text content
   * @param modelId - model ID to associate with the prompt
   * @param messages - Current messages array (for context/reference)
   * @returns A tuple of [success: boolean, message: Message] where success indicates if the append operation succeeded,
   *          and message is either the successfully created message or the local message object on failure
   *
   */

  async submitPromptToChat(
    threadId: string,
    branchId: string,
    modelId: string,
    messages: Message[],
  ): Promise<ApiResponse<null>> {
    try {
      // make sure we have a chat service
      const _result = await window.electronAPI.chat.createServiceForThread(
        threadId,
        branchId,
        modelId,
        '',
      );

      // Build history for the model (include the new prompt)
      const historyMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const request = {
        messages: historyMessages,
        streaming: true,
        model: modelId,
      };

      // Send chat message with the calculated branchId
      const chatResult = await this.sendChatMessage(threadId, branchId, request);
      console.warn('[ThreadService.appendPrompt] sendChatMessage result:', chatResult);

      if (!chatResult.success) {
        const errorMessage = chatResult.errorText ?? 'Chat failed';
        console.error(
          '[ThreadService.appendPrompt] Error check (result validation):',
          errorMessage,
        );
        return { success: false, data: null, errorCode: -1, errorText: errorMessage };
      }

      return { success: true, data: null, errorCode: 0, errorText: '' };
    } catch (error) {
      // Return failure with the error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ThreadService.appendPrompt] Exception:', errorMessage);
      return { success: false, data: null, errorCode: -1, errorText: errorMessage };
    }
  }

  async updateMessage(
    threadId: string,
    messageId: string,
    newContent: string,
  ): Promise<ApiResponse<{ message: Message; thread: Thread }>> {
    return window.electronAPI.thread.updateMessage(threadId, messageId, newContent);
  }

  /**
   * Update the branch ID of a message via Moku API
   */
  async updateMessageBranch(
    threadId: string,
    messageId: string,
    branchId: string,
  ): Promise<ApiResponse<MessageDTO>> {
    return window.electronAPI.thread.updateMessageBranch(threadId, messageId, branchId);
  }

  /**
   * Update the desktop options of a message via Moku API
   */
  async updateMessageDesktopOptions(
    threadId: string,
    messageId: string,
    desktopOptions: RequestOptionsDTO,
  ): Promise<ApiResponse<MessageDTO>> {
    return window.electronAPI.thread.updateMessageDesktopOptions(
      threadId,
      messageId,
      desktopOptions,
    );
  }

  /**
   * Mark the selected branch lane as isSelectedBranch=true and all other lanes in the same
   * branch row as isSelectedBranch=false.
   *
   * @param threadId - The thread ID
   * @param selectedLaneBranchId - The lane.branchId of the selected lane (e.g. "2.1")
   * @param messages - Current messages array to search for user prompts in each lane
   */
  async selectBranchLane(
    threadId: string,
    selectedLaneBranchId: string,
    messages: Message[],
  ): Promise<void> {
    const [rowStr, laneStr] = selectedLaneBranchId.split('.');
    const row = parseInt(rowStr);
    const selectedLaneNum = parseInt(laneStr);

    // Iterate lane numbers 1, 2, 3… stopping when no user message found for that lane
    for (let laneNum = 1; ; laneNum++) {
      const lanePrefix = `${row}.${laneNum}.`;
      const firstUserMsg = messages.find(
        (m) => m.branchId.startsWith(lanePrefix) && m.role === 'user',
      );
      if (!firstUserMsg) {
        break;
      }

      const wasselected = laneNum === selectedLaneNum;
      const result = await this.updateMessageDesktopOptions(threadId, firstUserMsg.id, {
        isSelectedBranch: wasselected,
      });
      if (!result.success) {
        console.error(
          `[ThreadService] selectBranchLane: failed to set isSelectedBranch=${String(wasselected)}`,
          firstUserMsg.id,
          result,
        );
      }
    }
  }

  /**
   * Delete a branch from a thread
   */
  async deleteBranch(threadId: string, branchId: string): Promise<ApiResponse<void>> {
    return window.electronAPI.thread.deleteBranch(threadId, branchId);
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
    { success: true; message: Message; newBranchId: string } | { success: false; error: string }
  > {
    // Generate next branchId hierarchically from the original message's branchId
    // E.g., "1.0" -> "1.0.1", "1.0" -> "1.0.2" (if 1.0.1 exists)
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
    const res = await this.appendMessage(thread.id, {
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

  /**
   * Check whether an agent is still in the available applications list.
   * Returns false if agentId is falsy, not found, or the API call fails.
   */
  async isAgentAvailable(agentId: string | null | undefined): Promise<boolean> {
    if (!agentId) {
      return false;
    }
    const result = await window.electronAPI.models.listAllApplications();
    if (!result.success) {
      return false;
    }
    return result.data.some((a) => a.id === agentId);
  }
}

export const threadService = ThreadService.getInstance();
