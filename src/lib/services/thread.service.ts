/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Thread, CreateThreadRequest, ModelDetails } from '../../../src-electron/preload.js';
import { threads } from '../stores/thread.store.js';
import type { Message } from '$lib/types/thread.type.js';
import { wrapElectronCall, wrapElectronCallWithFallback } from '$lib/utils/apiWrapper';
import { BaseElectronService } from './base-electron.service';
import { getNextVariationBranchId } from '$lib/utils/branch-utils';
import { formatResponseContent } from '$lib/utils/response-formatter';
import type { ThreadMetadata } from '../../../src-electron/types/thread.types.js';

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
        const messages = await this.getMessages(threadId);

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
  ): Promise<{ success: boolean; error?: string }> {
    if (!threadId || !branchId) {
      throw new Error('[ThreadService] threadId and branchId are required for chat message');
    }

    const payload = {
      ...request,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      thread_id: threadId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      branch_id: branchId,
    };

    return wrapElectronCall(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      () => window.electronAPI.chat.chat(threadId, payload as any),
      'Failed to send chat message',
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
  ): Promise<Thread> {
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
      throw new Error(`Agent not found: ${agentId}`);
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

    return wrapElectronCall(
      () => window.electronAPI.thread.create(request),
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
    const thread = await wrapElectronCall(
      () => window.electronAPI.thread.getById(id),
      'Failed to get thread',
    );
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
  ): Promise<
    | {
        success: true;
        message: { id: string; role: string; content: string; createdAt: number };
        thread: Thread;
      }
    | { success: false; status: number; error: string; threadId?: string }
  > {
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

    const res = await wrapElectronCall(
      () =>
        window.electronAPI.thread.appendMessage(
          threadId,
          wirePayload as {
            role: 'user' | 'assistant' | 'system';
            content: string;
            metadata?: Record<string, unknown>;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            client_message_id?: string;
          },
        ),
      'Failed to append message',
    );

    // Return success or normalize error response
    if (res.success) {
      return res as {
        success: true;
        message: { id: string; role: string; content: string; createdAt: number };
        thread: Thread;
      };
    }

    return {
      success: false,
      status: typeof res.status === 'number' ? res.status : 500,
      error: typeof res.error === 'string' ? res.error : 'Unknown error',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      threadId: (res as { thread_id?: string }).thread_id,
    };
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

    // Build wire payload with snake_case field mappings
    const wirePayload: Record<string, unknown> = {
      role: newPromptMessage.role,
      content: newPromptMessage.content,
      metadata: modelId ? { modelId } : {},
      // eslint-disable-next-line @typescript-eslint/naming-convention
      client_message_id: clientMessageId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      branch_id: branchId,
    };

    try {
      const res = (await wrapElectronCall(
        () =>
          window.electronAPI.thread.appendMessage(
            threadId,
            wirePayload as {
              role: 'user' | 'assistant' | 'system';
              content: string;
              metadata?: Record<string, unknown>;
              // eslint-disable-next-line @typescript-eslint/naming-convention
              client_message_id?: string;
            },
          ),
        'Failed to append message',
      )) as {
        success: boolean;
        message?: { id: string; role: string; content: string; createdAt: number };
      };

      // Check if append was successful
      if (!res.success || !res.message) {
        return [false, newPromptMessage];
      }

      return [true, newPromptMessage];
    } catch (error) {
      // Return failure with the local message
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
  ): Promise<{ success: boolean; error?: string }> {
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
        const errorMessage = chatResult.error ?? 'Chat failed';
        console.error(
          '[ThreadService.appendPrompt] Error check (result validation):',
          errorMessage,
        );
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error) {
      // Return failure with the error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ThreadService.appendPrompt] Exception:', errorMessage);
      return { success: false, error: errorMessage };
    }
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
    { success: true; message: Message; newBranchId: string } | { success: false; error: string }
  > {
    // Generate next branchId hierarchically from the original message's branchId
    // E.g., "1.0" -> "1.0.1", "1.0" -> "1.0.2" (if 1.0.1 exists)
    // Use provided messages if available (for multiple variations), otherwise fetch from backend
    const messages = currentMessages ?? (await this.getMessages(thread.id));
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
      threadId: thread.id ?? '',
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
  buildDisplayItems(
    messages: Message[],
    isStreaming: boolean = false,
    responseText: string = '',
    availableModels: ModelDetails[] = [],
  ): DisplayItem[] {
    if (messages.length === 0) {
      return [];
    }

    // Filter out hidden messages (e.g., guard-blocked messages)
    const visibleMessages = messages.filter((m) => !m.isHidden);

    if (visibleMessages.length === 0) {
      return [];
    }

    // Sort messages by branchId first
    const sortedMessages = [...visibleMessages].sort((a, b) => {
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
      const hasrowBranches = rowMessages.some((msg) => this.getBranchLane(msg.branchId) !== 0);

      if (!hasrowBranches) {
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
              modelIntendedUse: undefined,
            };
          }

          const pairs = this.buildMessagePairs(msgs, isStreaming, responseText);

          // Try to extract model name and intended use from first message
          const modelId = msgs[0]?.modelId ?? undefined;
          let modelName = modelId;
          let modelIntendedUse: string | undefined;

          // Look up model details if available
          if (modelId && availableModels.length > 0) {
            const modelDetails = availableModels.find(
              (m) => m.id === modelId || m.accessName === modelId,
            );
            if (modelDetails) {
              modelName = modelDetails.title || modelDetails.accessName;
              modelIntendedUse = modelDetails.intendedUse;
            }
          }

          return {
            id: `lane-${row}-${index}`,
            branchId: laneKey,
            messagePairs: pairs,
            modelName,
            modelIntendedUse,
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
  private buildMessagePairs(
    msgs: Message[],
    isStreaming: boolean,
    responseText: string,
  ): MessagePair[] {
    const pairs: MessagePair[] = [];
    let i = 0;
    while (i < msgs.length) {
      // eslint-disable-next-line security/detect-object-injection
      const msg = msgs[i];
      if (msg.role === 'user') {
        // Collect all consecutive assistant messages following this user message
        const responses: Message[] = [];
        let j = i + 1;

        // eslint-disable-next-line security/detect-object-injection
        while (j < msgs.length && (msgs[j].role === 'assistant' || msgs[j].role === 'system')) {
          // eslint-disable-next-line security/detect-object-injection
          const assistantMsg = msgs[j];
          const provider = (assistantMsg.metadata?.provider as string) ?? '';
          const modelId = assistantMsg.modelId ?? msg.modelId ?? '';

          // Format the response content based on provider and model ID
          let formattedContent = formatResponseContent(assistantMsg.content, provider, modelId);

          // Inject image tags for attachments
          if (assistantMsg.attachments && assistantMsg.attachments.length > 0) {
            formattedContent = this.injectImageTags(formattedContent, assistantMsg.attachments);
          }

          const formattedResponse = {
            ...assistantMsg,
            content: formattedContent,
          };

          responses.push(formattedResponse);
          j++;
        }

        // Check if this is the last message and we're streaming
        const islastMessage = i === msgs.length - 1;
        const isstreamingNow = islastMessage && isStreaming && responses.length === 0;

        pairs.push({
          request: msg,
          responses: responses,
          isStreamingResponse: isstreamingNow,
          streamingContent: isstreamingNow ? responseText : '',
        });

        // Skip past the user message and all collected responses
        i = j;
      } else {
        // Orphan assistant/system message (no user request before it)
        // Skip it for now - we only display request-response pairs
        console.warn('[ThreadService] Skipping orphan assistant/system message at index:', i);
        i += 1;
      }
    }
    return pairs;
  }

  /**
   * Inject markdown image tags for attachments into content
   */
  private injectImageTags(
    content: string,
    attachments: Array<{ mimeType: string; data?: string; filename: string }>,
  ): string {
    let result = content;

    // Add images at the end of the content
    for (const attachment of attachments) {
      // Only process image attachments
      if (!attachment.mimeType.startsWith('image/')) {
        continue;
      }

      // If we have base64 data, inject inline image
      if (attachment.data) {
        const imageTag = `\n\n![${attachment.filename}](data:${attachment.mimeType};base64,${attachment.data})`;
        result += imageTag;
      } else {
        console.warn('[ThreadService] Attachment missing data:', attachment.filename);
      }
    }

    return result;
  }
}

// Export types for use in components
export interface MessagePair {
  request: Message;
  responses: Message[]; // Changed from single response to array of responses
  isStreamingResponse: boolean;
  streamingContent: string;
}

export interface Lane {
  id: string;
  branchId: string;
  messagePairs: MessagePair[];
  modelName?: string;
  modelIntendedUse?: string;
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
