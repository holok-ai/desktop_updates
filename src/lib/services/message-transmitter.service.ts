import { wrapElectronCall } from '$lib/utils/apiWrapper';
import { MESSAGE_STATUS } from '$lib/constants/status.constant';
import type { MessageStatus } from '$lib/types/status.type';
import type { Message } from '$lib/types/thread.type';
import { outboxService } from './outbox.service';
import { threadService } from './thread.service';
import type { Thread } from '../../../src-electron/preload';

export interface MessageUpdate {
  messageId: string;
  status: MessageStatus;
  error?: string;
  retryCount?: number;
}

export interface MessageTransmitterCallbacks {
  onMessageUpdate: (update: MessageUpdate) => void;
  onMessagesReplace: (messages: Message[]) => void;
  onMessageAdd: (message: Message) => void;
  onThreadCreated?: (thread: Thread, tempId?: string) => void;
}

export class MessageTransmitter {
  private callbacks: MessageTransmitterCallbacks;

  constructor(callbacks: MessageTransmitterCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Extract message metadata from thread metadata
   */
  private extractMessageMetadata(thread: Thread | null): Record<string, unknown> {
    if (thread?.metadata === undefined) {
      console.warn('[MessageTransmitter] No thread metadata available, using defaults');
      return { provider: 'unknown', model: 'unknown' };
    }

    const provider = thread.metadata.provider as string | undefined;
    const model = thread.metadata.modelAccessName as string | undefined;

    if (provider === undefined || provider === '' || model === undefined || model === '') {
      console.warn('[MessageTransmitter] Missing provider or model in thread metadata:', thread.metadata);
      return { provider: provider ?? 'unknown', model: model ?? 'unknown' };
    }

    return { provider, model };
  }

  /**
   * Update message status
   */
  updateMessageStatus(messageId: string, status: MessageStatus, errorMsg?: string): void {
    this.callbacks.onMessageUpdate({ messageId, status, error: errorMsg });
  }

  /**
   * Retry sending a failed message
   */
  async retryMessage(message: Message, threadId: string): Promise<void> {
    this.updateMessageStatus(message.id, MESSAGE_STATUS.SENDING);
    await this.persistMessage(message, threadId);
  }

  /**
   * Persist message with retry logic and timeout
   */
  async persistMessage(message: Message, threadId: string): Promise<boolean> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), outboxService.getTimeout()),
    );

    try {
      // Fetch thread to get correct metadata
      const thread = await threadService.getThread(threadId);
      const threadMetadata = this.extractMessageMetadata(thread);
      // Merge thread metadata with message metadata
      const metadata = { ...threadMetadata, ...message.metadata };

      const persistPromise = threadService.appendMessage(threadId, {
        role: message.role,
        content: message.content,
        metadata,
        clientMessageId: message.clientMessageId,
        branchId: message.branchId,
      });

      const persisted = await Promise.race([persistPromise, timeoutPromise]);

      if (persisted.success) {
        this.updateMessageStatus(message.id, MESSAGE_STATUS.SENT);
        await outboxService.removePendingMessage(message.id);
        return true;
      } else {
        throw new Error(persisted.error);
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to send';
      this.updateMessageStatus(message.id, MESSAGE_STATUS.FAILED, errorMsg);
      await outboxService.updateMessageStatus(message.id, MESSAGE_STATUS.FAILED, errorMsg);

      // Schedule retry if possible
      if (outboxService.canRetry(message.id)) {
        const retryCount = (message.retryCount ?? 0) + 1;
        this.callbacks.onMessageUpdate({
          messageId: message.id,
          status: MESSAGE_STATUS.FAILED,
          error: errorMsg,
          retryCount,
        });

        outboxService.scheduleRetry(message.id, async () => {
          await this.retryMessage(message, threadId);
        });
      }
      return false;
    }
  }

  /**
   * Add optimistic user message
   */
  addOptimisticMessage(content: string, isOnline: boolean, currentBranchId: string = '1.0'): Message {
    const clientMessageId = crypto.randomUUID();
    const initialStatus: MessageStatus = isOnline
      ? MESSAGE_STATUS.SENDING
      : MESSAGE_STATUS.PENDING_OFFLINE;

    const userMsg: Message = {
      id: clientMessageId,
      role: 'user',
      content,
      createdAt: Date.now(),
      status: initialStatus,
      clientMessageId,
      retryCount: 0,
      branchId: currentBranchId,
      modelId: null,
    };

    this.callbacks.onMessageAdd(userMsg);
    return userMsg;
  }

  /**
   * Send user message and handle persistence
   */
  async sendUserMessage(
    userMsg: Message,
    thread: Thread | null,
    isOnline: boolean,
    branchId?: string,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const isPermanent =
      thread !== null && (typeof thread.id !== 'string' || !thread.id.startsWith('temp_'));

    // Update message with branchId if provided
    if (typeof branchId === 'string' && branchId.length > 0) {
      userMsg.branchId = branchId;
    }

    // Add to outbox for resilience
    if (thread !== null && isPermanent) {
      await outboxService.addPendingMessage(userMsg, thread.id);
    }

    // Messages are now created locally when chat function is called
    // No need to persist separately - the chat handler creates the message
    // If offline, message will be created when chat is called after coming online
  }

  /**
   * Handle assistant response after streaming completes
   */
  async handleAssistantResponse(
    responseText: string,
    thread: Thread | null,
    userMessage: string,
    userMessageObj?: Message,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const isPermanent =
      thread !== null && (typeof thread.id !== 'string' || !thread.id.startsWith('temp_'));

    if (thread !== null && isPermanent) {
      // For existing threads, messages are created locally in chat-handler.
      // Here we reflect the assistant response in the UI and update user message status.

      // Determine branchId for assistant message
      const branchId = userMessageObj?.branchId ?? thread.currentBranchId;

      // Create assistant message locally for the UI
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        createdAt: Date.now(),
        status: MESSAGE_STATUS.SENT,
        branchId,
        modelId: userMessageObj?.modelId ?? null,
      };

      this.callbacks.onMessageAdd(assistantMsg);

      // Update user message status to SENT after assistant response is received
      if (userMessageObj?.id !== null && userMessageObj?.id !== undefined && userMessageObj.id !== '') {
        this.updateMessageStatus(userMessageObj.id, MESSAGE_STATUS.SENT);
      }
    } else {
      // No thread yet: persist both prompt + response atomically
      const metadata = this.extractMessageMetadata(thread);
      const modelName = typeof metadata.model === 'string' && metadata.model !== '' ? metadata.model : 'unknown';

      const saved = await window.electronAPI.thread.savePromptAndResponses(
        null,
        userMessage,
        [{ text: responseText, model: modelName }],
        { title: thread?.title ?? '', description: thread?.description ?? '' },
      );

      // Replace local messages with canonical saved ones
      const newMessages: Message[] = [
        {
          id: saved.promptMessage.id,
          role: saved.promptMessage.role as 'user' | 'assistant',
          content: saved.promptMessage.content,
          createdAt: saved.promptMessage.createdAt,
          status: MESSAGE_STATUS.SENT,
          branchId: '1.0',
          modelId: null,
        },
        ...saved.responseMessages.map(
          (m): Message => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
            status: MESSAGE_STATUS.SENT,
            branchId: '1.0',
            modelId: null,
          }),
        ),
      ];

      this.callbacks.onMessagesReplace(newMessages);

      if (this.callbacks.onThreadCreated !== undefined) {
        this.callbacks.onThreadCreated(saved.thread, thread?.id);
      }
    }
  }

  /**
   * Process pending messages when coming back online
   */
  async processPendingMessages(
    thread: Thread | null,
    pendingMap: Map<string, { message: Message; threadId: string }>,
    chatHandler: {
      setupTokenListener: () => void;
      getResponseText: () => string;
      chat: (request: {
        messages: Array<{ role: string; content: string }>;
        streaming: boolean;
        model: string;
      }) => Promise<{ success: boolean; error?: string }>;
      setStreaming: (streaming: boolean) => void;
      offToken: () => void;
    },
  ): Promise<void> {
    if (thread === null) {
      return;
    }

    for (const [messageId, pendingMsg] of pendingMap) {
      if (pendingMsg.threadId === thread.id) {
        this.updateMessageStatus(messageId, MESSAGE_STATUS.SENDING);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const wasSuccessful = await this.persistMessage(pendingMsg.message, pendingMsg.threadId);

        if (wasSuccessful) {
          // After persisting the user message, trigger assistant response
          try {
            chatHandler.setStreaming(true);
            chatHandler.setupTokenListener();

            const metadata = this.extractMessageMetadata(thread);
            const modelName = typeof metadata.model === 'string' && metadata.model !== '' ? metadata.model : 'unknown';

            const request = {
              messages: [{ role: 'user', content: pendingMsg.message.content }],
              streaming: true,
              model: modelName,
            };

            const result = await wrapElectronCall(
              () => chatHandler.chat(request),
              'Error sending chat message.',
            );

            if (result.success) {
              const responseText = chatHandler.getResponseText();
              const assistantPersist = await threadService.appendMessage(thread.id, {
                role: 'assistant',
                content: responseText,
                metadata,
                clientMessageId: crypto.randomUUID(),
              });

              const assistantMsg: Message = {
                id: assistantPersist.success ? assistantPersist.message.id : crypto.randomUUID(),
                role: 'assistant',
                content: responseText,
                createdAt: assistantPersist.success
                  ? assistantPersist.message.createdAt
                  : Date.now(),
                status: assistantPersist.success ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.FAILED,
                branchId: '1.0',
                modelId: null,
              };

              this.callbacks.onMessageAdd(assistantMsg);
            }
          } catch {
            // Logging handled in wrapElectronCall for consistent reporting
          } finally {
            chatHandler.setStreaming(false);
            chatHandler.offToken();
          }
        }
      }
    }
  }
}
