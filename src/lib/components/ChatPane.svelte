<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Thread } from '../../../src-electron/preload';
  import { threadService } from '$lib/services/thread.service';

  type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
  };

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
  const dispatch = createEventDispatcher<{ threadCreated: { thread: Thread; tempId?: string } }>();

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

    window.electronAPI.chat.onToken((token: string) => {
      console.log(token);
      // Force reactivity by creating a new string reference
      responseText = responseText + token;
    });
  }

  // Send message and handle streaming response
  async function sendMessage(userMessage: string) {
    if (!chatServiceCreated) {
      error = 'Chat service not initialized';
      return;
    }

    if (!userMessage.trim()) return;

    error = '';
    isStreaming = true;
    setupTokenListener();

    // If thread exists, persist user message immediately (idempotent)
    // If no thread yet, defer persistence until after response (atomic save)
    const clientMessageId = crypto.randomUUID();
    const isTemp = !!thread && typeof thread.id === 'string' && thread.id.startsWith('temp_');
    if (thread && !isTemp) {
      try {
        const persisted = await threadService.appendMessage(thread.id, {
          role: 'user',
          content: userMessage,
          metadata: { provider: 'ollama', model: 'llama3:latest' },
          clientMessageId: clientMessageId,
        });

        if (!persisted.success) {
          if (persisted.status === 403) {
            error = 'Forbidden: THREAD_ACCESS_DENIED';
            return;
          }
          throw new Error(persisted.error);
        }

        const userMsg: Message = {
          id: persisted.message.id,
          role: 'user',
          content: userMessage,
          createdAt: persisted.message.createdAt,
        };
        messages = [...messages, userMsg];
      } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to append message';
        return;
      }
    } else {
      // Optimistically show user message locally when no thread yet
      const userMsg: Message = {
        id: clientMessageId,
        role: 'user',
        content: userMessage,
        createdAt: Date.now(),
      };
      messages = [...messages, userMsg];
    }

    try {
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
            };
            messages = [...messages, assistantMsg];
          } else {
            const assistantMsg: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: responseText,
              createdAt: Date.now(),
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
            },
            ...saved.responseMessages.map((m) => ({
              id: m.id,
              role: m.role as any,
              content: m.content,
              createdAt: m.createdAt,
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

  // Lifecycle hooks
  onMount(() => {
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
          <div class="message {m.role}">
            <div class="message-content">{m.content}</div>
            <div class="message-meta">{new Date(m.createdAt).toLocaleString()}</div>
          </div>
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
  .icon-button { background: transparent; border: none; font-size: 20px; cursor: pointer; }

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

  .message {
    margin-bottom: 1rem;
  }

  .message.user .message-content {
    background: var(--surface-card);
    padding: 0.5rem;
    border-radius: 6px;
  }

  .message.assistant .message-content {
    background: var(--surface-card);
    padding: 0.5rem;
    border-radius: 6px;
  }

  .message.streaming .message-content {
    opacity: 0.9;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.9;
    }
    50% {
      opacity: 0.6;
    }
  }

  .message-meta {
    font-size: 0.75rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .composer {
    margin-top: 1rem;
  }

  .no-messages {
    color: #6b7280;
  }
</style>
