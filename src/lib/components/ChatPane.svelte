<script lang="ts">
  import { onMount, createEventDispatcher, tick } from 'svelte';
  import type { Thread } from '../../../src-electron/preload';
  import { messageStateMachine } from '$lib/services/message-state-machine';
  import { threadService } from '$lib/services/thread.service';
  import MoveThreadModal from './modals/MoveThreadModal.svelte';

  import type { Message } from '$lib/types/thread.type';
  import { isThreadGeneratingTitle } from '$lib/stores/titleGeneration.store';
  import AttachmentPreview from './AttachmentPreview.svelte';
  import FileErrorBanner from './FileErrorBanner.svelte';

  interface Props {
    thread?: Thread | null;
    messages?: Message[];
    composer?: import('svelte').Snippet<
      [{ sendMessage: (message: string) => Promise<void>; isStreaming: boolean }]
    >;
  }

  function retryMessage(clientMessageId: string) {
    if (!currentThread) return;
    try {
      messageStateMachine.handleEvent({
        type: 'RETRY_TRIGGER',
        clientMessageId,
        threadId: currentThread.id,
      });
    } catch (e) {
      console.error('Failed to trigger retry', e);
    }
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
  let stateUnsubs: Map<string, () => void> = new Map();
  let ipcUnsubOnMessageError: (() => void) | null = null;
  let statusMetadataByClientId: Map<string, Record<string, unknown>> = new Map();
  const dispatch = createEventDispatcher<{
    threadCreated: { thread: Thread; tempId?: string };
    openNewThreadPrefill: { prompt: string };
  }>();

  // UI state for per-message actions
  let openMenuForId = $state<string | null>(null);
  let toast = $state('');
  let toastTimeout: number | null = null;
  // Cache for inline preview URLs (small images)
  let inlinePreviewUrls = $state<Map<string, string>>(new Map());
  // File error state
  let fileError = $state<{ message: string; type: 'error' | 'warning' } | null>(null);
  // Inline edit state
  let editingMessageId = $state<string | null>(null);
  let editingText = $state('');
  // Calculated inline styles for menus (position fixed to avoid scroll clipping)
  let menuStyles = $state<Record<string, string>>({} as Record<string, string>);
  // Move thread modal state
  let showMoveModal = $state(false);

  function showToast(message: string, ms = 2500) {
    toast = message;
    if (toastTimeout) window.clearTimeout(toastTimeout);
    // @ts-ignore - window.setTimeout returns number in browser
    toastTimeout = window.setTimeout(() => (toast = ''), ms);
  }

  async function handleCopy(content: string) {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback: attempt to use execCommand (older) or log
        const ta = document.createElement('textarea');
        ta.value = content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Prompt copied to clipboard');
      openMenuForId = null;
    } catch (e) {
      console.error('Copy failed', e);
      showToast('Failed to copy prompt');
      openMenuForId = null;
    }
  }

  function handleEdit(messageId: string) {
    const msg = messages.find((mm) => mm.id === messageId);
    editingMessageId = messageId;
    editingText = msg ? msg.content : '';
    openMenuForId = null;
  }

  function cancelEdit() {
    editingMessageId = null;
    editingText = '';
    showToast('Edit cancelled');
  }

  async function runEditedPrompt() {
    if (!editingText || !editingText.trim()) {
      showToast('Cannot run empty prompt');
      return;
    }
    const toSend = editingText;
    // Clear edit state before sending to avoid double UI states
    editingMessageId = null;
    editingText = '';
    await sendMessage(toSend);
  }

  async function handleRunAgain(content: string) {
    openMenuForId = null;
    // Reuse sendMessage flow to append and generate a new response
    await sendMessage(content);
  }

  function handleRunInAnotherModel(content: string) {
    openMenuForId = null;
    // Notify parent to open prefilled new-thread view
    dispatch('openNewThreadPrefill', { prompt: content });
    // Also emit a global DOM event as a fallback for listeners attached outside Svelte
    try {
      window.dispatchEvent(
        new CustomEvent('openNewThreadPrefill', { detail: { prompt: content } }),
      );
    } catch {
      // ignore
    }
  }

  // Accessibility helpers for action menus
  async function toggleMenuFor(id: string) {
    const willOpen = openMenuForId !== id;
    openMenuForId = willOpen ? id : null;
    if (willOpen) {
      await tick();
      const btn = document.querySelector<HTMLButtonElement>(`[data-action-btn="${id}"]`);
      const first = document
        .getElementById(`action-menu-${id}`)
        ?.querySelector<HTMLButtonElement>('.action-item');
      const menuEl = document.getElementById(`action-menu-${id}`) as HTMLElement | null;
      if (btn && menuEl) {
        const rect = btn.getBoundingClientRect();
        const top = Math.round(rect.bottom - 50);
        menuStyles = {
          ...(menuStyles ?? {}),
          [id]: `position: fixed; right: 60px; top: ${top}px;`,
        } as Record<string, string>;
      } else if (btn) {
        // fallback if menu element not measured yet
        const rect = btn.getBoundingClientRect();
        const menuWidth = 180;
        const center = rect.left + rect.width / 2;
        let left = Math.round(center - menuWidth / 2);
        const margin = 8;
        if (left + menuWidth > window.innerWidth - margin)
          left = Math.round(window.innerWidth - margin - menuWidth);
        if (left < margin) left = margin;
        const top = Math.round(rect.bottom + 12);
        menuStyles = {
          ...(menuStyles ?? {}),
          [id]: `position: fixed; left: ${left}px; top: ${top}px;`,
        } as Record<string, string>;
      }
      first?.focus();
    } else {
      // closed
      if (menuStyles && menuStyles[id]) {
        const copy = { ...(menuStyles ?? {}) } as Record<string, string>;
        delete copy[id];
        menuStyles = copy;
      }
    }
  }

  function onMenuKeydown(e: KeyboardEvent, id: string) {
    const menu = document.getElementById(`action-menu-${id}`);
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('.action-item'));
    const current = document.activeElement as HTMLButtonElement | null;
    const idx = current ? items.indexOf(current) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[(idx + 1) % items.length];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[(idx - 1 + items.length) % items.length];
      prev?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      openMenuForId = null;
    }
  }

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
  async function sendMessage(userMessage: string, attachments: any[] = []) {
    if (!chatServiceCreated) {
      error = 'Chat service not initialized';
      return;
    }

    if (!userMessage.trim() && attachments.length === 0) return;

    error = '';
    isStreaming = true;
    setupTokenListener();

    // If thread exists, persist user message immediately (idempotent)
    // If no thread yet, defer persistence until after response (atomic save)
    const clientMessageId = crypto.randomUUID();
    const isTemp =
      !!currentThread &&
      typeof currentThread.id === 'string' &&
      currentThread.id.startsWith('temp_');
    if (currentThread && !isTemp) {
      try {
        const persisted = await threadService.appendMessage(currentThread.id, {
          role: 'user',
          content: userMessage,
          metadata: {
            provider: 'ollama',
            model: 'llama3:latest',
            attachments: attachments.length > 0 ? attachments : undefined,
          },
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
          clientMessageId: clientMessageId,
          role: 'user',
          content: userMessage,
          createdAt: persisted.message.createdAt,
          metadata:
            (persisted.message as any).metadata ||
            (attachments.length > 0 ? { attachments } : undefined),
        };
        messages = [...messages, userMsg];
        // register initial sending state for this message
        try {
          messageStateMachine.createSending(currentThread.id, clientMessageId, {
            provider: 'ollama',
            model: 'llama3:latest',
          });
        } catch (e) {
          console.error('Failed to create sending snapshot', e);
        }
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
        metadata: attachments.length > 0 ? { attachments } : undefined,
      };
      messages = [...messages, userMsg];
      // If we have a temp thread id (when thread exists as temp) register sending state
      if (currentThread && typeof currentThread.id === 'string') {
        try {
          messageStateMachine.createSending(currentThread.id, clientMessageId, {
            provider: 'ollama',
            model: 'llama3:latest',
          });
        } catch (e) {
          console.error('Failed to create sending snapshot', e);
        }
      }
    }

    // subscribe to state changes for this clientMessageId and update UI message status
    const unsubscribe = messageStateMachine.subscribe(clientMessageId, (snap) => {
      const idx = messages.findIndex(
        (m) => m.clientMessageId === clientMessageId || m.id === clientMessageId,
      );
      if (idx === -1) return;
      const m = messages[idx];
      const updated: Message = { ...m, status: snap.state, attemptCount: snap.attemptCount };
      messages = [...messages.slice(0, idx), updated, ...messages.slice(idx + 1)];
      statusMetadataByClientId.set(clientMessageId, snap.metadata ?? {});
    });

    // remember to unsubscribe on cleanup
    if (!stateUnsubs) stateUnsubs = new Map();
    stateUnsubs.set(clientMessageId, unsubscribe);

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
        if (currentThread && !isTemp) {
          // Append assistant response to existing thread
          const assistantPersist = await threadService.appendMessage(currentThread.id, {
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
            { title: currentThread?.title ?? '', description: currentThread?.description ?? '' },
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
          dispatch('threadCreated', { thread: saved.thread, tempId: currentThread?.id });
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error sending message:', err);
    } finally {
      isStreaming = false;
    }
  }

  /**
   * Get inline preview URL for small images (<500KB)
   */
  async function getInlinePreviewUrl(
    threadId: string,
    fileId: string,
    fileSize: number,
  ): Promise<string | undefined> {
    const MAX_INLINE_SIZE = 500 * 1024; // 500KB

    // Check cache first
    const cacheKey = `${threadId}:${fileId}`;
    if (inlinePreviewUrls.has(cacheKey)) {
      return inlinePreviewUrls.get(cacheKey);
    }

    // Only generate inline preview for small files
    if (fileSize > MAX_INLINE_SIZE) {
      return undefined;
    }

    try {
      const userId = 'current-user'; // TODO: Get from auth store

      const result = await window.electronAPI.file.preview({ threadId, fileId, userId });

      if (result.success && result.token && result.fileInfo?.canInlinePreview) {
        const fileData = await window.electronAPI.file.getWithToken({ token: result.token });

        if (fileData.success && fileData.buffer) {
          const uint8Array = new Uint8Array(fileData.buffer as any);
          const blob = new Blob([uint8Array], { type: result.fileInfo.mimeType });
          const url = URL.createObjectURL(blob);

          // Cache the URL
          inlinePreviewUrls.set(cacheKey, url);
          return url;
        }
      }
    } catch (error) {
      console.error('Error generating inline preview:', error);
    }

    return undefined;
  }

  /**
   * Preview attachment (opens modal)
   */
  async function previewAttachment(threadId: string, fileId: string, filename: string) {
    // TODO: Implement preview attachment
    console.log('Previewing attachment:', threadId, fileId, filename);
  }

  /**
   * Download attachment (secure token-based)
   */
  async function downloadAttachment(threadId: string, fileId: string, filename: string) {
    // TODO: Implement download attachment
    console.log('Downloading attachment:', threadId, fileId, filename);
  }

  // Cleanup on unmount
  async function cleanup() {
    window.electronAPI.chat.offToken();
    await window.electronAPI.chat.close();
    // unsubscribe any state subscriptions
    try {
      for (const unsub of Array.from(stateUnsubs.values())) unsub();
    } catch {
      // ignore
    }
    stateUnsubs.clear();
    // remove ipc listeners
    if (ipcUnsubOnMessageError) ipcUnsubOnMessageError();
  }

  // Lifecycle hooks
  onMount(() => {
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

    // Listen for message error events from main process and forward to FSM
    try {
      ipcUnsubOnMessageError = window.electronAPI.thread.onMessageError((evt: any) => {
        const clientId = evt?.client_message_id ?? evt?.clientMessageId;
        const threadId =
          evt?.thread_id ?? evt?.threadId ?? (currentThread ? currentThread.id : undefined);
        const errorObj = evt?.error ?? {};
        if (typeof clientId === 'string' && clientId.length > 0 && typeof threadId === 'string') {
          messageStateMachine.handleEvent({
            type: 'FAIL',
            clientMessageId: clientId,
            threadId,
            errorCode: (errorObj as any).code,
            errorMessage: (errorObj as any).message,
          });
        }
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
      {#key thread?.id}
        <div class="header-content">
          <div>
            <h2>{thread.title}</h2>
            <div class="meta">{thread.description}</div>
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

    {#if fileError}
      <FileErrorBanner
        error={fileError.message}
        type={fileError.type}
        onDismiss={() => (fileError = null)}
      />
    {/if}

    {#if toast}
      <div class="toast">{toast}</div>
    {/if}

    <div class="messages">
      {#if messages.length === 0}
        <div class="no-messages">No messages yet — send a prompt to start the conversation.</div>
      {:else}
        {#each messages as m (m.id)}
          <div
            class="message {m.role}"
            role="button"
            aria-label={`${m.role} message`}
            tabindex="0"
            onkeydown={(e) => {
              // Allow context-menu key on focused message to open actions
              if (e.key === 'ContextMenu' || (e.key === 'F10' && (e as KeyboardEvent).shiftKey)) {
                e.preventDefault();
                toggleMenuFor(m.id);
              }
            }}
          >
            {#if editingMessageId === m.id}
              <div class="message-edit">
                <textarea
                  class="edit-input"
                  bind:value={editingText}
                  onkeydown={(e) => {
                    if (e.key === 'Escape') cancelEdit();
                  }}
                ></textarea>
                <div class="edit-actions">
                  <button class="action-item" onclick={() => cancelEdit()}>Cancel</button>
                  <button class="action-item" onclick={() => runEditedPrompt()}>Run Prompt</button>
                </div>
              </div>
              <div class="message-meta">{new Date(m.createdAt).toLocaleString()}</div>
              <div class="message-status">
                {#if m.status === 'sending'}
                  <span class="status-spinner" title="Sending">●</span>
                {:else if m.status === 'retrying'}
                  <span class="status-spinner" title="Retrying (automatic)">⟳</span>
                  {#if m.attemptCount}
                    <span class="status-attempt">{m.attemptCount}</span>
                  {/if}
                {:else if m.status === 'sent'}
                  <span class="status-sent" title="Sent">✔</span>
                {:else if m.status === 'failed'}
                  <span
                    class="status-failed"
                    title={(statusMetadataByClientId.get(m.clientMessageId ?? m.id) as any)
                      ?.errorMessage ?? 'Failed'}>✖</span
                  >
                  <button
                    class="status-action"
                    onclick={() => retryMessage(m.clientMessageId ?? m.id)}>Retry</button
                  >
                {/if}
              </div>
            {:else}
              <div class="message-content">{m.content}</div>
              <!-- Display attachments if present -->
              {#if m.metadata?.attachments && m.metadata.attachments.length > 0}
                <div class="message-attachments">
                  {#each m.metadata.attachments as attachment}
                    {#await currentThread ? getInlinePreviewUrl(currentThread.id, attachment.id, attachment.size) : undefined}
                      <AttachmentPreview
                        {attachment}
                        mode="history"
                        onPreview={() =>
                          currentThread &&
                          previewAttachment(currentThread.id, attachment.id, attachment.filename)}
                        onDownload={() =>
                          currentThread &&
                          downloadAttachment(currentThread.id, attachment.id, attachment.filename)}
                      />
                    {:then inlineUrl}
                      <AttachmentPreview
                        {attachment}
                        mode="history"
                        inlinePreviewUrl={inlineUrl}
                        onPreview={() =>
                          currentThread &&
                          previewAttachment(currentThread.id, attachment.id, attachment.filename)}
                        onDownload={() =>
                          currentThread &&
                          downloadAttachment(currentThread.id, attachment.id, attachment.filename)}
                      />
                    {/await}
                  {/each}
                </div>
              {/if}

              <div class="message-meta">{new Date(m.createdAt).toLocaleString()}</div>
              <div class="message-status">
                {#if m.status === 'sending'}
                  <span class="status-spinner" title="Sending">●</span>
                {:else if m.status === 'retrying'}
                  <span class="status-spinner" title="Retrying (automatic)">⟳</span>
                  {#if m.attemptCount}
                    <span class="status-attempt">{m.attemptCount}</span>
                  {/if}
                {:else if m.status === 'sent'}
                  <span class="status-sent" title="Sent">✔</span>
                {:else if m.status === 'failed'}
                  <span
                    class="status-failed"
                    title={(statusMetadataByClientId.get(m.clientMessageId ?? m.id) as any)
                      ?.errorMessage ?? 'Failed'}>✖</span
                  >
                  <button
                    class="status-action"
                    onclick={() => retryMessage(m.clientMessageId ?? m.id)}>Retry</button
                  >
                {/if}
              </div>
            {/if}

            <div class="message-actions">
              <button
                class="icon-button"
                data-action-btn={m.id}
                aria-haspopup="true"
                aria-expanded={openMenuForId === m.id}
                aria-controls={`action-menu-${m.id}`}
                aria-label="Open actions for prompt"
                onclick={() => toggleMenuFor(m.id)}
                onkeydown={(e) => {
                  // Context menu key or Shift+F10
                  if (
                    e.key === 'ContextMenu' ||
                    (e.key === 'F10' && (e as KeyboardEvent).shiftKey)
                  ) {
                    e.preventDefault();
                    toggleMenuFor(m.id);
                  }
                }}
              >
                ⋯
              </button>

              {#if openMenuForId === m.id}
                <div
                  id={`action-menu-${m.id}`}
                  class="action-menu"
                  role="menu"
                  tabindex="-1"
                  onkeydown={(e) => onMenuKeydown(e as KeyboardEvent, m.id)}
                  style={menuStyles[m.id] ?? ''}
                >
                  <button
                    data-testid="copy-prompt-to-clipboard"
                    class="action-item"
                    role="menuitem"
                    tabindex="0"
                    onclick={() => handleCopy(m.content)}
                    aria-label="Copy prompt to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    data-testid="edit-prompt"
                    class="action-item"
                    role="menuitem"
                    tabindex="0"
                    onclick={() => handleEdit(m.id)}
                    aria-label="Edit prompt inline"
                  >
                    Edit
                  </button>
                  <button
                    data-testid="run-again"
                    class="action-item"
                    role="menuitem"
                    tabindex="0"
                    onclick={() => handleRunAgain(m.content)}
                    aria-label="Run this prompt again in this thread"
                  >
                    Run again
                  </button>
                  <button
                    data-testid="run-in-another-model"
                    class="action-item"
                    role="menuitem"
                    tabindex="0"
                    onclick={() => handleRunInAnotherModel(m.content)}
                    aria-label="Run this prompt in another model"
                  >
                    Run in another model
                  </button>
                </div>
              {/if}
            </div>
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
  .icon-button {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    color: inherit;
  }
  .icon-button:focus {
    outline: none;
    border-color: rgba(100, 108, 255, 0.28);
    box-shadow: 0 0 0 4px rgba(100, 108, 255, 0.08);
  }

  .message-actions {
    position: absolute;
    right: 0.5rem;
    top: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .action-menu {
    background: var(--surface-card);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    padding: 0.25rem;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    z-index: 60;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.6);
  }
  .action-item {
    background: transparent;
    border: none;
    padding: 0.5rem 0.75rem;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    font-size: 0.95rem;
  }
  .action-item:focus,
  .action-item:hover {
    background: rgba(255, 255, 255, 0.02);
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

  .message-edit {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .edit-input {
    width: 100%;
    min-height: 80px;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-family: inherit;
  }
  .edit-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
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
    position: relative;
    padding-right: 4.5rem; /* space for action button */
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

  .message-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .message-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 0.5rem;
  }

  .status-spinner {
    animation: pulse 1s linear infinite;
    color: #2563eb;
    font-weight: 700;
  }

  .status-sent {
    color: #10b981;
    font-weight: 700;
  }

  .status-failed {
    color: #ef4444;
    font-weight: 700;
  }

  .status-action {
    background: transparent;
    border: 1px solid #d1d5db;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .status-attempt {
    font-size: 0.75rem;
    color: #374151;
  }

  .message-attachments {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .composer {
    margin-top: 1rem;
  }

  .no-messages {
    color: #6b7280;
  }
</style>
