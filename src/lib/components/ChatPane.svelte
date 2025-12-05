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
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import MoveThreadModal from './modals/MoveThreadModal.svelte';
  import { isThreadGeneratingTitle } from '$lib/stores/titleGeneration.store';
  import { storageService } from '$lib/services/storage.service';

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

  // Model configuration derived from thread metadata
  let modelName = $state('llama3:latest'); // Default fallback
  let modelUrl = $state('http://localhost:11434');
  let modelApiKey = $state<string | undefined>(undefined);
  let modelProvider = $state('ollama'); // Default provider

  // Track current provider config to detect changes
  interface ProviderConfig {
    provider: string;
    url: string;
    model: string;
    apiKey?: string;
  }
  let currentProviderConfig: ProviderConfig | null = $state(null);
  let threadLoadedIds = $state(new Set<string>()); // Track which threads we've logged

  // Watch for prop changes and update model configuration from thread metadata
  $effect(() => {
    currentThread = thread;

    // Extract model configuration from thread metadata
    if (thread?.metadata) {
      const meta = thread.metadata;
      console.log('[ChatPane] Thread metadata:', JSON.stringify(meta, null, 2));

      modelName = (meta.model as string) ?? 'llama3:latest';
      modelUrl = (meta.url as string) ?? 'http://localhost:11434';
      modelApiKey = meta.apiKey as string | undefined;
      modelProvider = (meta.provider as string) ?? 'ollama';

      // Log when thread is first loaded
      if (thread.id && !threadLoadedIds.has(thread.id)) {
        console.log(`[ChatPane] Thread loaded: provider=${modelProvider}, model=${modelName}, url=${modelUrl}`);
        threadLoadedIds.add(thread.id);
      }
    } else {
      console.log('[ChatPane] No thread metadata, using defaults');
      // Reset to defaults if no metadata
      modelName = 'llama3:latest';
      modelUrl = 'http://localhost:11434';
      modelApiKey = undefined;
      modelProvider = 'ollama';
    }

    // Clear error state when switching threads to prevent stale errors
    error = '';
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
  let showComments = $state(false);
  const dispatch = createEventDispatcher<{ threadCreated: { thread: Thread; tempId?: string } }>();

  // Scrolling state
  let messagesContainer: HTMLDivElement | null = $state(null);
  let streamingMessageEl: HTMLDivElement | null = $state(null);

  // Title editing state
  let isEditingTitle = $state(false);
  let editedTitle = $state('');
  let titleError = $state('');
  let isSavingTitle = $state(false);
  let titleInputRef: HTMLInputElement | null = $state(null);
  const TITLE_MAX_LENGTH = 200;

  // Load showComments preference from localStorage
  onMount(() => {
    try {
      const saved = storageService.getShowComments();
      showComments = saved ?? false;
    } catch {
      showComments = false;
    }
  });

  // Toggle and persist showComments preference
  // When hiding, also cancel any active comment editing
  function toggleShowComments() {
    const wasShowing = showComments;
    showComments = !showComments;

    // If hiding comments, cancel any active editing (will be handled by MessageBubble via prop)
    if (wasShowing && !showComments) {
      // The showComments prop change will trigger MessageBubble to cancel editing
    }

    try {
      storageService.setShowComments(showComments);
    } catch (error) {
      console.error('Failed to save showComments preference:', error);
    }
  }

  // Title editing functions
  function enterTitleEditMode() {
    if (!currentThread || $isThreadGeneratingTitle(currentThread.id)) return;
    editedTitle = currentThread.title || '';
    titleError = '';
    isEditingTitle = true;
    // Focus input after DOM update
    setTimeout(() => {
      titleInputRef?.focus();
      titleInputRef?.select();
    }, 0);
  }

  function cancelTitleEdit() {
    isEditingTitle = false;
    editedTitle = '';
    titleError = '';
  }

  async function saveTitleEdit() {
    if (!currentThread || isSavingTitle) return;

    const trimmedTitle = editedTitle.trim();

    // Client-side validation
    if (!trimmedTitle) {
      titleError = 'Title cannot be empty';
      return;
    }

    if (trimmedTitle.length > TITLE_MAX_LENGTH) {
      titleError = `Title cannot exceed ${TITLE_MAX_LENGTH} characters`;
      return;
    }

    // No change - just exit edit mode
    if (trimmedTitle === currentThread.title) {
      cancelTitleEdit();
      return;
    }

    isSavingTitle = true;
    titleError = '';

    try {
      const result = await window.electronAPI.thread.renameThread(currentThread.id, trimmedTitle);

      if (result.success) {
        // Thread will be updated via onThreadUpdated listener
        isEditingTitle = false;
        editedTitle = '';
        showToast('Title updated');
      } else {
        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          TITLE_EMPTY: 'Title cannot be empty',
          TITLE_TOO_SHORT: 'Title is too short',
          TITLE_TOO_LONG: `Title cannot exceed ${TITLE_MAX_LENGTH} characters`,
          TITLE_DUPLICATE: 'A thread with this title already exists',
          TITLE_INVALID_CHARACTERS: 'Title contains invalid characters',
        };
        titleError = errorMessages[result.code || ''] || result.error || 'Failed to update title';
      }
    } catch (err) {
      titleError = err instanceof Error ? err.message : 'Failed to update title';
      console.error('Error saving title:', err);
    } finally {
      isSavingTitle = false;
    }
  }

  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveTitleEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

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

  // Initialize chat service with provider configuration
  async function initializeChatService(config: ProviderConfig) {
    console.log(`[ChatPane] Initializing chat provider: ${config.provider} with model ${config.model} at ${config.url}`);

    const result = await window.electronAPI.chat.createProvider(config.provider, {
      url: config.url,
      model: config.model,
      apiKey: config.apiKey,
    });

    if (!result.success) {
      error = result.error || 'Failed to initialize chat service';
      console.error('[ChatPane] Failed to create chat provider:', result.error);
      return;
    }

    console.log('[ChatPane] Chat service initialized successfully!');
    chatServiceCreated = true;
    currentProviderConfig = config;
  }

  function showToast(message: string, ms = 2500) {
    toast = message;
    if (toastTimeout) window.clearTimeout(toastTimeout);
    // @ts-ignore - window.setTimeout returns number in browser
    toastTimeout = window.setTimeout(() => (toast = ''), ms);
  }

  function scrollToBottom(behavior: "auto" | "instant" | "smooth" = "auto") {
    if (!messagesContainer) return;
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior,
    });
  }

  // Setup token listener for streaming responses
  function setupTokenListener() {
    responseText = ''; // Clear previous response

    // Remove any existing token listeners to prevent duplicates
    window.electronAPI.chat.offToken();

    window.electronAPI.chat.onToken((token: string) => {
      // Force reactivity by creating a new string reference
      responseText = responseText + token;

      // Keep streaming text in view inside messages container
      scrollToBottom('auto');

      // Ensure streaming block stays visible in the viewport (outer scroll container / window)
      if (streamingMessageEl) {
        streamingMessageEl.scrollIntoView({ block: 'end', behavior: 'auto' });
      }
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

    // Build conversation history from existing messages (oldest -> newest)
    const historyMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

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
        messages: [...historyMessages, { role: 'user', content: userMessage }],
        streaming: true,
        model: modelName,
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
    console.log('[ChatPane] Starting edit and regenerate for message:', messageId);
    console.log('[ChatPane] Current thread:', currentThread?.id);
    console.log('[ChatPane] New content length:', newContent.length);

    if (!currentThread) {
      console.error('[ChatPane] Cannot edit: no current thread');
      showToast('Error: No active thread');
      return;
    }

    try {
      const result = await threadService.updateMessage(currentThread.id, messageId, newContent);
      if (!result.success) {
        error = result.error;
        showToast(`Error updating message: ${result.error}`);
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

      const deleteResult = await threadService.deleteMessagesAfter(currentThread.id, messageId);
      if (!deleteResult.success) {
        error = deleteResult.error;
        showToast(`Error deleting messages: ${deleteResult.error}`);
        return;
      }

      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex !== -1) {
        messages = messages.slice(0, messageIndex + 1);
      }

      // Regenerate the AI response with full conversation history
      const historyMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      console.log('[ChatPane] Starting regeneration with', historyMessages.length, 'messages');
      isStreaming = true;
      setupTokenListener();
      const request = {
        messages: historyMessages,
        streaming: true,
        model: modelName,
      };

      const chatResult = await window.electronAPI.chat.chat(request);

      if (!chatResult.success) {
        error = chatResult.error || 'Chat failed';
        console.error('[ChatPane] Chat failed:', chatResult.error);
        showToast(`Error generating response: ${chatResult.error}`);
      } else {
        console.log('[ChatPane] Regeneration complete, handling assistant response');
        await transmitter.handleAssistantResponse(responseText, currentThread, newContent);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ChatPane] Error editing message:', err);
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

  // Always keep view pinned to bottom when messages change
  $effect(() => {
    const _len = messages.length;
    if (!_len || !messagesContainer) return;
    scrollToBottom('auto');
  });

  // Watch for thread changes and reinitialize provider if config changed
  $effect(() => {
    if (!currentThread) {
      // No thread loaded, don't initialize
      return;
    }

    // Build provider config from current thread metadata
    const newConfig: ProviderConfig = {
      provider: modelProvider,
      url: modelUrl,
      model: modelName,
      apiKey: modelApiKey,
    };

    // Check if we need to reinitialize (config changed or first time)
    const needsReinit = !currentProviderConfig ||
      currentProviderConfig.provider !== newConfig.provider ||
      currentProviderConfig.url !== newConfig.url ||
      currentProviderConfig.model !== newConfig.model ||
      currentProviderConfig.apiKey !== newConfig.apiKey;

    if (needsReinit) {
      console.log('[ChatPane] Provider config changed, reinitializing...');
      chatServiceCreated = false; // Mark as not created to trigger reinit
      void initializeChatService(newConfig);
    }
  });

  // Track which threads we've already auto-sent for (to avoid duplicate sends)
  let autoSentForThreadId: string | null = null;

  // Auto-send initial message when thread is created with a prompt but no AI response yet
  $effect(() => {
    // Skip if no thread, chat service not ready, or already streaming
    if (!currentThread || !chatServiceCreated || isStreaming) return;

    // Skip if we've already auto-sent for this thread
    if (autoSentForThreadId === currentThread.id) return;

    // Check if there's exactly one user message with no assistant response
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    if (userMessages.length === 1 && assistantMessages.length === 0) {
      const initialPrompt = userMessages[0].content;

      // Mark this thread as having been auto-sent
      autoSentForThreadId = currentThread.id;

      // Trigger AI response for the initial message
      (async () => {
        try {
          isStreaming = true;
          setupTokenListener();

          const request = {
            messages: [{ role: 'user', content: initialPrompt }],
            streaming: true,
            model: modelName,
          };

          const result = await window.electronAPI.chat.chat(request);

          if (!result.success) {
            error = result.error || 'Chat failed';
            console.error('Chat failed:', result.error);
          } else {
            // Save the assistant response
            await transmitter.handleAssistantResponse(responseText, currentThread, initialPrompt);
          }
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
          console.error('Error sending initial message:', err);
        } finally {
          isStreaming = false;
        }
      })();
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
          <div class="title-section">
            {#if isEditingTitle}
              <!-- Edit Mode -->
              <div class="title-edit-container">
                <div class="title-edit-row">
                  <input
                    bind:this={titleInputRef}
                    type="text"
                    class="title-input"
                    class:has-error={!!titleError}
                    bind:value={editedTitle}
                    onkeydown={handleTitleKeydown}
                    maxlength={TITLE_MAX_LENGTH}
                    placeholder="Enter thread title"
                    aria-label="Thread title"
                    disabled={isSavingTitle}
                  />
                  <button
                    class="title-action-btn save-btn"
                    onclick={() => saveTitleEdit()}
                    disabled={isSavingTitle || !editedTitle.trim()}
                    aria-label="Save title"
                    title="Save (Enter)"
                  >
                    {#if isSavingTitle}
                      <i class="pi pi-spin pi-spinner"></i>
                    {:else}
                      <i class="pi pi-check"></i>
                    {/if}
                  </button>
                  <button
                    class="title-action-btn cancel-btn"
                    onclick={cancelTitleEdit}
                    disabled={isSavingTitle}
                    aria-label="Cancel editing"
                    title="Cancel (Escape)"
                  >
                    <i class="pi pi-times"></i>
                  </button>
                </div>
                {#if titleError}
                  <div class="title-error" role="alert">{titleError}</div>
                {/if}
                <div
                  class="char-counter"
                  class:warning={editedTitle.length > TITLE_MAX_LENGTH - 20}
                >
                  {TITLE_MAX_LENGTH - editedTitle.length} characters remaining
                </div>
              </div>
            {:else}
              <!-- Display Mode -->
              <div class="title-display">
                <h2>
                  {currentThread.title || 'New Thread'}
                  {#if $isThreadGeneratingTitle(currentThread.id)}
                    <span class="title-generating" aria-live="polite">
                      <span class="generating-dots">...</span>
                      <span class="sr-only">Generating title</span>
                    </span>
                  {/if}
                </h2>
                {#if !$isThreadGeneratingTitle(currentThread.id)}
                  <button
                    class="title-edit-btn"
                    onclick={enterTitleEditMode}
                    aria-label="Edit title"
                    title="Edit title"
                  >
                    <i class="pi pi-pencil"></i>
                  </button>
                {/if}
              </div>
            {/if}
            <div class="meta">{currentThread.description}</div>
          </div>
          <div class="header-buttons">
            <button
              class="header-action-btn"
              class:active={showComments}
              onclick={toggleShowComments}
              aria-label={showComments ? 'Hide' : 'Show'}
              title={showComments ? 'Hide' : 'Show'}
            >
              <i class="pi pi-comment"></i>
              {showComments ? 'Hide' : 'Show'}
            </button>
            <!-- Hide for now -->
            <!-- <button
            class="move-thread-btn"
            onclick={() => (showMoveModal = true)}
            aria-label="Move thread to project"
            title="Move thread to project"
          >
            <i class="pi pi-folder-open"></i>
            Move
            </button> -->
          </div>
        </div>
      {/key}
    </div>

    {#if toast}
      <div class="toast">{toast}</div>
    {/if}

    <div class="messages" bind:this={messagesContainer}>
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
            {showComments}
            on:copied={(event) => showToast(event.detail.message)}
          />
        {/each}
      {/if}

      <!-- Show streaming response in real-time -->
      {#if isStreaming && responseText}
        <div class="message assistant streaming" bind:this={streamingMessageEl}>
          <div class="message-content">
            <MarkdownRenderer content={responseText} enableCopy={true} />
          </div>
          <div class="message-meta">Streaming... ●</div>
        </div>
      {/if}
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

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
    // Reload all threads - filtering happens in UI/sidebar
    void threadService.getAll({ includeProjectOnly: true });
    showToast(`Thread moved ${projectId ? 'to project' : 'to general history'}`);
  }}
/>

<style>
  .chat-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: var(--content-padding);
    background: var(--surface-main);
  }

  .chat-header {
    padding: var(--content-padding) 0;
    border-bottom: 1px solid var(--surface-border);
    position: sticky;
    top: -31px;
    z-index: 5;
    background: var(--surface-main);
  }

  .header-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--content-padding);
    overflow: visible;
    position: relative; /* allow absolute positioning of the action button */
    padding-right: 128px; /* reserve space so title doesn't sit under the button */
  }
  /* Ensure the title/description area can shrink and ellipsis without pushing the action button */
  .header-content > div:first-child {
    flex: 1 1 auto;
    min-width: 0;
  }

  .title-section {
    min-width: 0;
  }

  .title-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chat-header h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--border-radius);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .title-edit-btn:hover {
    background: var(--surface-hover);
    border-color: var(--surface-border);
    color: var(--text-primary);
    opacity: 1;
  }

  .title-edit-btn:focus {
    outline: none;
    border-color: var(--primary-color);
    opacity: 1;
  }

  .title-edit-btn i {
    font-size: 14px;
  }

  .title-edit-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title-edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    outline: none;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .title-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.2);
  }

  .title-input.has-error {
    border-color: var(--error-color);
  }

  .title-input.has-error:focus {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
  }

  .title-input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .title-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .title-action-btn.save-btn {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .title-action-btn.save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .title-action-btn.save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .title-action-btn.cancel-btn {
    background: var(--surface-overlay);
    color: var(--text-primary);
  }

  .title-action-btn.cancel-btn:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .title-action-btn.cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .title-action-btn i {
    font-size: 14px;
  }

  .title-error {
    font-size: 12px;
    color: var(--error-color);
    padding: 2px 0;
  }

  .char-counter {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .char-counter.warning {
    color: var(--warning-color, #f59e0b);
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

  .chat-header .meta {
    margin-top: calc(var(--inline-spacing) / 2);
    font-size: 14px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    /* Pin to the right */
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }

  .header-action-btn {
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
    padding: var(--inline-spacing) var(--content-padding);
    background: var(--surface-overlay);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    min-width: max-content;
  }

  .header-action-btn:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }

  .header-action-btn.active {
    background: rgba(100, 108, 255, 0.1);
    border-color: rgba(100, 108, 255, 0.4);
    color: #646cff;
  }

  .header-action-btn i {
    font-size: 14px;
    color: var(--text-primary);
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
    right: var(--content-padding);
    top: calc(var(--content-padding) * 3);
    background: var(--surface-main);
    color: var(--text-primary);
    padding: var(--inline-spacing) calc(var(--inline-spacing) * 1.5);
    border-radius: var(--border-radius);
    box-shadow: 0 var(--inline-spacing) calc(var(--inline-spacing) * 3) 0 var(--surface-main);
  }

  .error-banner {
    background: var(--error-bg);
    color: var(--error-color);
    padding: var(--inline-spacing);
    border-radius: var(--border-radius);
    margin: var(--inline-spacing) 0;
  }

  .messages {
    flex: 1;
    overflow: auto;
    margin-top: var(--content-padding);
    padding-right: var(--inline-spacing);
  }

  .composer {
    margin-top: var(--content-padding);
  }

  .message-content {
    background: var(--surface-card);
    padding: var(--inline-spacing);
    border-radius: var(--border-radius);
  }

  .no-messages {
    color: var(--text-secondary);
  }
</style>
