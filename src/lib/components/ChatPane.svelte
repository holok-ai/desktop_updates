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
  import MoveThreadModal from './modals/MoveThreadModal.svelte';
  import { isThreadGeneratingTitle } from '$lib/stores/titleGeneration.store';
  interface Props {
    thread?: Thread | null;
    messages?: Message[];
    composer?: import('svelte').Snippet<
      [
        {
          sendMessage: (message: string) => Promise<void>;
          isStreaming: boolean;
        },
      ]
    >;
  }

  let { thread = null, messages = [], composer }: Props = $props();

  // Reactive thread state that updates when backend sends updates
  let currentThread = $state(thread);

  // Watch for prop changes
  $effect(() => {
    currentThread = thread;
  });

  // State management
  let chatServiceCreated = $state(false);
  let responseText = $state('');
  let isStreaming = $state(false);
  let error = $state('');
  let isOnline = $state(true);
  let toast = $state('');
  let toastTimeout: number | null = null;
  let showMoveModal = $state(false);
  let showVersionsFor = $state<{ messageId: string; content: string } | undefined>(undefined);
  const dispatch = createEventDispatcher<{ threadCreated: { thread: Thread; tempId?: string } }>();

  // Initialize message transmitter
  const transmitter = new MessageTransmitter({
    onMessageUpdate: (update) => {
      messages = messages.map((message) =>
        message.id === update.messageId
          ? {
              ...message,
              status: update.status,
              error: update.error,
              retryCount: update.retryCount ?? message.retryCount,
            }
          : message,
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
    },
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

  function showToast(message: string, ms = 2500) {
    toast = message;
    if (toastTimeout) window.clearTimeout(toastTimeout);
    // @ts-ignore - window.setTimeout returns number in browser
    toastTimeout = window.setTimeout(() => (toast = ''), ms);
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
  async function sendMessage(userMessage: string, attachments: any[] = []) {
    if (!chatServiceCreated) {
      error = 'Chat service not initialized';
      return;
    }

    if (!userMessage.trim() && attachments.length === 0) return;

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
        await transmitter.handleAssistantResponse(responseText, currentThread, userMessage);
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
              versions: updatedMessage.versions,
            }
          : message,
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
      setStreaming: (streaming) => {
        isStreaming = streaming;
      },
      offToken: () => window.electronAPI.chat.offToken(),
    });
  }

  // Lifecycle hooks
  onMount(() => {
    outboxService.init();
    initializeChatService();

    // Listen for thread updates from backend
    let unsubThreadUpdated: (() => void) | undefined;
    try {
      if (window.electronAPI?.thread?.onThreadUpdated) {
        unsubThreadUpdated = window.electronAPI.thread.onThreadUpdated((updatedThread) => {
          // Only update if it's our current thread
          if (currentThread && updatedThread.id === currentThread.id) {
            currentThread = updatedThread;
          }
        });
      }
    } catch {
      // ignore if API not available
    }

    // Listen for message error events from main process
    try {
      window.electronAPI.thread.onMessageError((evt: any) => {
        // TODO: Handle message errors with new transmitter pattern if needed
        console.error('Message error:', evt);
      });
    } catch {
      // ignore if API not available
    }
    return () => {
      if (unsubThreadUpdated) unsubThreadUpdated();
      cleanup();
    };
  });

  // Watch for thread changes to reinitialize if needed
  $effect(() => {
    if (currentThread && !chatServiceCreated) {
      initializeChatService();
    }
  });
</script>

{#if !currentThread}
  <div class="chat-pane empty">Select a thread to open chat</div>
{:else}
  <div class="chat-pane">
    <div class="chat-header">
      {#key thread?.id}
        <div class="header-content">
          <div>
            <h2>
              {currentThread.title || 'New Thread'}
              {#if $isThreadGeneratingTitle(currentThread.id)}
                <span class="title-generating" aria-live="polite">
                  <span class="generating-dots">...</span>
                  <span class="sr-only">Generating title</span>
                </span>
              {/if}
            </h2>
            <div class="meta">{currentThread.description}</div>
          </div>
          <button
            class="move-thread-btn"
            onclick={() => (showMoveModal = true)}
            aria-label="Move thread to project"
            title="Move thread to project"
          >
            <i class="pi pi-folder-open"></i>
            Move
          </button>
        </div>
      {/key}
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    {#if toast}
      <div class="toast">{toast}</div>
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
            threadId={currentThread?.id}
            {isStreaming}
            on:copied={(event) => showToast(event.detail.message)}
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
      onClose={() => (showVersionsFor = undefined)}
    />
  {/if}
{/if}

<MoveThreadModal
  bind:show={showMoveModal}
  bind:thread
  on:moved={(e) => {
    const { projectId } = e.detail;
    void threadService.getAll();
    showToast(`Thread moved ${projectId ? 'to project' : 'to general history'}`);
  }}
/>

<style>
  .chat-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    background: var(--surface-main);
  }

  .chat-header {
    padding: 1rem 0;
    border-bottom: 1px solid var(--surface-border, rgba(15, 23, 42, 0.12));
    position: sticky;
    top: 0;
    z-index: 5;
  }

  .header-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    overflow: visible;
    position: relative; /* allow absolute positioning of the action button */
    padding-right: 128px; /* reserve space so title doesn't sit under the button */
  }
  /* Ensure the title/description area can shrink and ellipsis without pushing the action button */
  .header-content > div:first-child {
    flex: 1 1 auto;
    min-width: 0;
  }

  .chat-header h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #f8fafc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-header .meta {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary, rgba(148, 163, 184, 0.9));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .move-thread-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--surface-overlay, rgba(148, 163, 184, 0.12));
    color: var(--text-primary, #f8fafc);
    border: 1px solid var(--surface-border, rgba(148, 163, 184, 0.35));
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    /* Pin to the right; independent of grid reflow during sidebar collapse/expand */
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    min-width: max-content;
  }

  .move-thread-btn:hover {
    background: var(--surface-hover, rgba(148, 163, 184, 0.2));
    border-color: var(--primary-color, #2563eb);
  }

  .move-thread-btn i {
    font-size: 0.875rem;
    color: var(--text-primary, #f8fafc);
    display: inline-block;
    width: 1em;
    height: 1em;
    line-height: 1em;
    font-style: normal;
    font-family: 'PrimeIcons', primeicons, sans-serif;
  }

  .title-generating {
    display: inline-flex;
    align-items: center;
    font-size: 0.875rem;
    color: var(--text-tertiary, #9ca3af);
    font-weight: normal;
  }

  .generating-dots {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .toast {
    position: absolute;
    right: 1rem;
    top: 3.5rem;
    background: #111827;
    color: #fff;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
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
