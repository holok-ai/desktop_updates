<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import type { Thread } from '../../../src-electron/preload';
  import { threadService } from '$lib/services/thread.service';
  import { outboxService } from '$lib/services/outbox.service';
  import { networkService } from '$lib/services/network.service';
  import type { Message } from '$lib/types/thread.type';
  import type { MessageStatus } from '$lib/types/status.type';
  import MessageBubble from './MessageBubble.svelte';
  import { MESSAGE_STATUS } from '$lib/constants/status.constant';

  interface Props {
    thread?: Thread | null;
    messages?: Message[];
    composer?: import('svelte').Snippet<
      [{ sendMessage: (message: string) => Promise<void>; isStreaming: boolean }]
    >;
  }

  let { thread = null, messages = [], composer }: Props = $props();

  // State management
  let chatServiceCreated = $state(false);
  let responseText = $state('');
  let isStreaming = $state(false);
  let error = $state('');
  let isOnline = $state(true);
  const dispatch = createEventDispatcher<{ threadCreated: { thread: Thread; tempId?: string } }>();

  // Subscribe to network status and process queue only on offline->online transition
  let wasOnline = networkService.getCurrentStatus();
  networkService.isOnline.subscribe((online) => {
    isOnline = online;
    if (online && !wasOnline && thread) {
      // Schedule outside of reactive tracking
      void processPendingMessages();
    }
    wasOnline = online;
  });

  // Initialize chat service on mount
  async function initializeChatService() {
    const result = await window.electronAPI.chat.createProvider('ollama', {
      url: 'http://localhost:11434',
      apiKey: 'ollama',
      model: 'llama3:latest',
    });

    if (!result.success) {
      error = result.error || 'Failed to initialize chat service';
      console.error('Failed to create chat provider:', result.error);
      return;
    }

    console.log('Chat service initialized!');
    chatServiceCreated = true;
  }

  // Setup token listener for streaming responses
  function setupTokenListener() {
    responseText = ''; // Clear previous response

    // Prevent duplicate subscriptions across multiple sends
    window.electronAPI.chat.offToken();
    window.electronAPI.chat.onToken((token: string) => {
      console.log(token);
      // Force reactivity by creating a new string reference
      responseText = responseText + token;
    });
  }

  // Update message status in the UI
  function updateMessageStatus(messageId: string, status: MessageStatus, errorMsg?: string) {
    messages = messages.map((message) =>
      message.id === messageId ? { ...message, status, error: errorMsg } : message
    );
  }

  // Retry sending a failed message
  async function retryMessage(messageId: string) {
    const message = messages.find((message) => message.id === messageId);
    if (!message || !thread) return;

    updateMessageStatus(messageId, MESSAGE_STATUS.SENDING);
    await persistMessage(message, thread.id);
  }

  // Persist message with retry logic and timeout
  async function persistMessage(message: Message, threadId: string): Promise<boolean> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), outboxService.getTimeout())
    );

    try {
      const persistPromise = threadService.appendMessage(threadId, {
        role: message.role,
        content: message.content,
        metadata: { provider: 'ollama', model: 'llama3:latest' },
        clientMessageId: message.clientMessageId,
      });

      const persisted = await Promise.race([persistPromise, timeoutPromise]);

      if (persisted.success) {
        updateMessageStatus(message.id, MESSAGE_STATUS.SENT);
        await outboxService.removePendingMessage(message.id);
        return true;
      } else {
        throw new Error(persisted.error);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to send';
      updateMessageStatus(message.id, MESSAGE_STATUS.FAILED, errorMsg);
      await outboxService.updateMessageStatus(message.id, MESSAGE_STATUS.FAILED, errorMsg);

      // Schedule retry if possible
      if (outboxService.canRetry(message.id)) {
        const retryCount = (message.retryCount || 0) + 1;
        messages = messages.map((m) =>
          m.id === message.id ? { ...m, retryCount } : m
        );

        outboxService.scheduleRetry(message.id, async () => {
          await retryMessage(message.id);
        });
      }
      return false;
    }
  }

  // Send message and handle streaming response
  async function sendMessage(userMessage: string) {
    if (!chatServiceCreated) {
      error = 'Chat service not initialized';
      return;
    }

    if (!userMessage.trim()) return;

    error = '';

    // Generate client message ID for idempotency
    const clientMessageId = crypto.randomUUID();
    const isTemp = !!thread && typeof thread.id === 'string' && thread.id.startsWith('temp_');

    // Determine initial status based on network connectivity
    const initialStatus: MessageStatus = isOnline ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.PENDING_OFFLINE;

    // Create optimistic message - render immediately
    const userMsg: Message = {
      id: clientMessageId,
      role: 'user',
      content: userMessage,
      createdAt: Date.now(),
      status: initialStatus,
      clientMessageId,
      retryCount: 0,
    };

    // Render immediately (< 100ms requirement)
    messages = [...messages, userMsg];

    // Add to outbox for resilience
    if (thread && !isTemp) {
      await outboxService.addPendingMessage(userMsg, thread.id);
    }

    // If offline, queue for later and don't enter streaming state
    if (!isOnline) {
      isStreaming = false;
      return;
    }

    // Persist to memory storage if thread exists
    if (thread && !isTemp) {
      await persistMessage(userMsg, thread.id);
    }

    try {
      isStreaming = true;
      setupTokenListener();
      const request = {
        messages: [{ role: 'user', content: userMessage }],
        streaming: true,
        model: 'llama3:latest',
      };

      const result = await window.electronAPI.chat.chat(request);

      if (!result.success) {
        error = result.error || 'Chat failed';
        console.error('Chat failed:', result.error);
      } else {
        // After streaming completes
        if (thread && !isTemp) {
          // Append assistant response to existing thread
          const assistantPersist = await threadService.appendMessage(thread.id, {
            role: 'assistant',
            content: responseText,
            metadata: { provider: 'ollama', model: 'llama3:latest' },
            clientMessageId: crypto.randomUUID(),
          });

          if (assistantPersist.success) {
            const assistantMsg: Message = {
              id: assistantPersist.message.id,
              role: 'assistant',
              content: responseText,
              createdAt: assistantPersist.message.createdAt,
              status: MESSAGE_STATUS.SENT,
            };
            messages = [...messages, assistantMsg];
          } else {
            const assistantMsg: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: responseText,
              createdAt: Date.now(),
              status: MESSAGE_STATUS.FAILED,
            };
            messages = [...messages, assistantMsg];
          }
        } else {
          // No thread yet: persist both prompt + response atomically and create thread now
          const saved = await window.electronAPI.thread.savePromptAndResponses(
            null,
            userMessage,
            [{ text: responseText, model: 'llama3:latest' }],
            { title: thread?.title ?? '', description: thread?.description ?? '' },
          );
          // Replace local messages with canonical saved ones
          messages = [
            {
              id: saved.promptMessage.id,
              role: saved.promptMessage.role as any,
              content: saved.promptMessage.content,
              createdAt: saved.promptMessage.createdAt,
              status: MESSAGE_STATUS.SENT,
            },
            ...saved.responseMessages.map((m) => ({
              id: m.id,
              role: m.role as any,
              content: m.content,
              createdAt: m.createdAt,
              status: MESSAGE_STATUS.SENT,
            })),
          ];
          // Notify parent to adopt the new thread
          dispatch('threadCreated', { thread: saved.thread, tempId: thread?.id });
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error sending message:', err);
    } finally {
      isStreaming = false;
    }
  }

  // Cleanup on unmount
  async function cleanup() {
    window.electronAPI.chat.offToken();
    await window.electronAPI.chat.close();
  }

  // Process pending messages when coming back online
  async function processPendingMessages() {
    const map = get(outboxService.pending);
    for (const [messageId, pendingMsg] of map) {
      if (pendingMsg.threadId === thread?.id) {
        updateMessageStatus(messageId, MESSAGE_STATUS.SENDING);
        const persisted = await persistMessage(pendingMsg.message, pendingMsg.threadId);
        if (persisted) {
          // After persisting the user message, trigger assistant response
          try {
            isStreaming = true;
            setupTokenListener();
            const request = {
              messages: [{ role: 'user', content: pendingMsg.message.content }],
              streaming: true,
              model: 'llama3:latest',
            };
            const result = await window.electronAPI.chat.chat(request);
            if (result.success && thread) {
              const assistantPersist = await threadService.appendMessage(thread.id, {
                role: 'assistant',
                content: responseText,
                metadata: { provider: 'ollama', model: 'llama3:latest' },
                clientMessageId: crypto.randomUUID(),
              });
              if (assistantPersist.success) {
                const assistantMsg: Message = {
                  id: assistantPersist.message.id,
                  role: 'assistant',
                  content: responseText,
                  createdAt: assistantPersist.message.createdAt,
                  status: MESSAGE_STATUS.SENT,
                };
                messages = [...messages, assistantMsg];
              } else {
                const assistantMsg: Message = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: responseText,
                  createdAt: Date.now(),
                  status: MESSAGE_STATUS.FAILED,
                };
                messages = [...messages, assistantMsg];
              }
            }
          } catch (error) {
            console.error('Error processing pending message:', error);
          } finally {
            isStreaming = false;
            window.electronAPI.chat.offToken();
          }
        }
      }
    }
  }

  // Lifecycle hooks
  onMount(() => {
    outboxService.init();
    initializeChatService();

    return () => {
      cleanup();
    };
  });

  // Watch for thread changes to reinitialize if needed
  $effect(() => {
    if (thread && !chatServiceCreated) {
      initializeChatService();
    }
  });
</script>

{#if !thread}
  <div class="chat-pane empty">Select a thread to open chat</div>
{:else}
  <div class="chat-pane">
    <div class="chat-header">
      <h2>{thread.title}</h2>
      <div class="meta">{thread.description}</div>
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    <div class="messages">
      {#if messages.length === 0}
        <div class="no-messages">No messages yet — send a prompt to start the conversation.</div>
      {:else}
        {#each messages as m (m.id)}
          <MessageBubble message={m} onRetry={retryMessage} />
        {/each}
      {/if}

      <!-- Show streaming response in real-time -->
      {#if isStreaming && responseText}
        <div class="message assistant streaming">
          <div class="message-content">{responseText}</div>
          <div class="message-meta">Streaming... ●</div>
        </div>
      {/if}
    </div>

    <div class="composer">
      <!-- Composer is rendered in the page and wired separately -->
      {#if composer}
        {@render composer({ sendMessage, isStreaming })}
      {/if}
    </div>
  </div>
{/if}

<style>
  .chat-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    background: var(--surface-main);
  }

  .chat-header h2 {
    margin: 0;
  }

  .error-banner {
    background-color: #fee;
    color: #c00;
    padding: 0.5rem;
    border-radius: 4px;
    margin: 0.5rem 0;
  }

  .messages {
    flex: 1;
    overflow: auto;
    margin-top: 1rem;
    padding-right: 0.5rem;
  }

  .composer {
    margin-top: 1rem;
  }

  .message-content {
    background: var(--surface-card);
    padding: 0.5rem;
    border-radius: 6px;
  }

  .no-messages {
    color: #6b7280;
  }
</style>
