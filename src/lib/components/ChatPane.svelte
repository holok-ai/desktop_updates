<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import type { Thread } from '../../../src-electron/preload';
  import { outboxService } from '$lib/services/outbox.service';
  import { networkService } from '$lib/services/network.service';
  import { MessageTransmitter } from '$lib/services/message-transmitter.service';
  import { threadService } from '$lib/services/thread.service';
  import type { Message } from '$lib/types/thread.type';
  import MessageBubble from './MessageBubble.svelte';
  import MessageVersionHistory from './MessageVersionHistory.svelte';

  interface Props {
    thread?: Thread | null;
    messages?: Message[];
    composer?: import('svelte').Snippet<
      [{ 
        sendMessage: (message: string) => Promise<void>; 
        isStreaming: boolean;
      }]
    >;
  }

  let { thread = null, messages = [], composer }: Props = $props();

  // State management
  let chatServiceCreated = $state(false);
  let responseText = $state('');
  let isStreaming = $state(false);
  let error = $state('');
  let isOnline = $state(true);
  let showVersionsFor = $state<{ messageId: string; content: string } | undefined>(undefined);
  const dispatch = createEventDispatcher<{ threadCreated: { thread: Thread; tempId?: string } }>();

  // Initialize message transmitter
  const transmitter = new MessageTransmitter({
    onMessageUpdate: (update) => {
      messages = messages.map((message) =>
        message.id === update.messageId 
          ? { ...message, status: update.status, error: update.error, retryCount: update.retryCount ?? message.retryCount } 
          : message
      );
    },
    onMessagesReplace: (newMessages) => {
      messages = newMessages;
    },
    onMessageAdd: (message) => {
      messages = [...messages, message];
    },
    onThreadCreated: (newThread, tempId) => {
      dispatch('threadCreated', { thread: newThread, tempId });
    }
  });

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

  // Retry sending a failed message
  async function retryMessage(messageId: string) {
    const message = messages.find((message) => message.id === messageId);
    if (!message || !thread) return;

    await transmitter.retryMessage(message, thread.id);
  }

  // Send message and handle streaming response
  async function sendMessage(userMessage: string) {
    if (!chatServiceCreated) {
      error = 'Chat service not initialized';
      return;
    }

    if (!userMessage.trim()) return;

    error = '';

    // Create and add optimistic message
    const userMsg = transmitter.addOptimisticMessage(userMessage, isOnline);

    // Send the user message (handles outbox and persistence)
    await transmitter.sendUserMessage(userMsg, thread, isOnline);

    // If offline, queue for later and don't enter streaming state
    if (!isOnline) {
      isStreaming = false;
      return;
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
        // After streaming completes, handle assistant response
        await transmitter.handleAssistantResponse(responseText, thread, userMessage);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error sending message:', err);
    } finally {
      isStreaming = false;
    }
  }

  async function handleEditAndRegenerate(messageId: string, newContent: string) {
    if (!thread) return;

    try {
      const result = await threadService.updateMessage(thread.id, messageId, newContent);
      if (!result.success) {
        error = result.error;
        return;
      }

      // Use the message returned from backend which has isEdited flag set
      const updatedMessage = result.message;
      messages = messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: updatedMessage.content,
              isEdited: updatedMessage.isEdited ?? true,
              editedAt: updatedMessage.editedAt ?? Date.now(),
              versions: updatedMessage.versions
            }
          : message
      );

      const deleteResult = await threadService.deleteMessagesAfter(thread.id, messageId);
      if (!deleteResult.success) {
        error = deleteResult.error;
        return;
      }

      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex !== -1) {
        messages = messages.slice(0, messageIndex + 1);
      }

      // Regenerate the AI response
      isStreaming = true;
      setupTokenListener();
      const request = {
        messages: [{ role: 'user', content: newContent }],
        streaming: true,
        model: 'llama3:latest',
      };

      const chatResult = await window.electronAPI.chat.chat(request);

      if (!chatResult.success) {
        error = chatResult.error || 'Chat failed';
        console.error('Chat failed:', chatResult.error);
      } else {
        await transmitter.handleAssistantResponse(responseText, thread, newContent);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error editing message:', err);
    } finally {
      isStreaming = false;
    }
  }

  function handleEdit(messageId: string, newContent: string) {
    handleEditAndRegenerate(messageId, newContent);
  }

  function handleShowVersions(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      showVersionsFor = { messageId, content: message.content };
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
    await transmitter.processPendingMessages(thread, map, {
      setupTokenListener,
      getResponseText: () => responseText,
      chat: (request) => window.electronAPI.chat.chat(request),
      setStreaming: (streaming) => { isStreaming = streaming; },
      offToken: () => window.electronAPI.chat.offToken()
    });
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
          <MessageBubble
            message={m}
            onRetry={retryMessage}
            onEdit={handleEdit}
            onShowVersions={handleShowVersions}
            {isStreaming}
          />
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

  <!-- Version History Modal -->
  {#if showVersionsFor && thread}
    <MessageVersionHistory
      threadId={thread.id}
      messageId={showVersionsFor.messageId}
      currentContent={showVersionsFor.content}
      onClose={() => showVersionsFor = undefined}
    />
  {/if}
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
