<script lang="ts">
  import { onMount } from 'svelte';
  import type { Thread } from '../../../src-electron/preload';

  type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
  };

  interface Props {
    thread?: Thread | null;
    messages?: Message[];
    // eslint-disable-next-line no-unused-vars
    composer?: import('svelte').Snippet<[{ sendMessage: (message: string) => Promise<void>, isStreaming: boolean }]>;
  }

  let { thread = null, messages = [], composer }: Props = $props();

  // State management
  let chatServiceCreated = $state(false);
  let responseText = $state('');
  let isStreaming = $state(false);
  let error = $state('');

  // Initialize chat service on mount
  async function initializeChatService() {
    const result = await window.electronAPI.chat.createProvider(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'ollama',
        model: 'llama3:latest'
      }
    );

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

    // Add user message to messages array immediately
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      createdAt: Date.now()
    };
    messages = [...messages, userMsg];

    try {
      const request = {
        messages: [
          { role: 'user', content: userMessage }
        ],
        streaming: true,
        model: 'llama3:latest'
      };

      const result = await window.electronAPI.chat.chat(request);

      if (!result.success) {
        error = result.error || 'Chat failed';
        console.error('Chat failed:', result.error);
      } else {
        // After streaming completes, add assistant response to messages
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseText,
          createdAt: Date.now()
        };
        messages = [...messages, assistantMsg];
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
    background: #fafafa;
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

  .message {
    margin-bottom: 1rem;
  }

  .message.user .message-content {
    background: #e0f2fe;
    padding: .5rem;
    border-radius: 6px;
  }

  .message.assistant .message-content {
    background: #eef2ff;
    padding: .5rem;
    border-radius: 6px;
  }

  .message.streaming .message-content {
    opacity: 0.9;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.9; }
    50% { opacity: 0.6; }
  }

  .message-meta {
    font-size: .75rem;
    color: #666;
    margin-top: .25rem;
  }

  .composer {
    margin-top: 1rem;
  }

  .no-messages {
    color: #6b7280;
  }
</style>


