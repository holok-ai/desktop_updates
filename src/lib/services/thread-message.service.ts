/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type {
  Thread,
  MessageDTO,
  RequestOptionsDTO,
  ApiResponse,
} from '../../../src-electron/preload.js';
import type { Message } from '$lib/types/thread.type.js';
import { observerStore } from '$lib/observer/observer.store';

/**
 * Domain service for thread message operations.
 *
 * Owns:
 * - Sending chat messages (sendChatMessage)
 * - Appending messages (appendMessage, appendPrompt)
 * - Submitting prompts to chat (submitPromptToChat)
 * - Message updates (updateMessage, updateMessageBranch, updateMessageDesktopOptions)
 *
 * Plain singleton (no IPC listeners).
 */
export class ThreadMessageService {
  private static instance: ThreadMessageService;

  private constructor() {}

  static getInstance(): ThreadMessageService {
    if (!ThreadMessageService.instance) {
      ThreadMessageService.instance = new ThreadMessageService();
    }
    return ThreadMessageService.instance;
  }

  /**
   * Send chat message to specific thread + branch
   */
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
      guardExecution: 'none',
      guardMessageId: null,
      guardError: '',
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
      console.error('[ThreadMessageService.appendPrompt] Exception:', error);
      return [false, newPromptMessage];
    }
  }

  /**
   * Submit a prompt to the chat service for streaming response.
   *
   * @param threadId - The ID of the thread
   * @param branchId - The branch ID
   * @param modelId - model ID for chat
   * @param messages - Current messages array (used as history for the model)
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

      // Use observer-owned assembled context (fallback to raw messages during transition).
      const currentContext = observerStore.getCurrentContext(threadId) ?? messages;
      const historyMessages = currentContext.map((m) => ({
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
      console.warn('[ThreadMessageService.submitPromptToChat] sendChatMessage result:', chatResult);

      if (!chatResult.success) {
        const errorMessage = chatResult.errorText ?? 'Chat failed';
        console.error(
          '[ThreadMessageService.submitPromptToChat] Error check (result validation):',
          errorMessage,
        );
        return { success: false, data: null, errorCode: -1, errorText: errorMessage };
      }

      return { success: true, data: null, errorCode: 0, errorText: '' };
    } catch (error) {
      // Return failure with the error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ThreadMessageService.submitPromptToChat] Exception:', errorMessage);
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
}

export const threadMessageService = ThreadMessageService.getInstance();
