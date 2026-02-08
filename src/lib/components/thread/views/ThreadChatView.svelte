<script lang="ts">
  /**
   * ThreadChatView — main chat view with message list, streaming, and IPC.
   *
   * Follows the existing ChatPane streaming pattern:
   *   createProvider() → setupTokenListener (onToken) → chat() → accumulate → addAssistantResponse()
   *
   * When no threadId is provided, shows a model selector and creates a new
   * thread on first prompt via `thread.addUserPrompt(null, ...)`.
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import { replace } from 'svelte-spa-router';
  import ChatMessage from '../ChatMessage.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import { threadService } from '$lib/services/thread.service';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Thread, ModelDetails } from '../../../../../src-electron/preload';
  import type { Message } from '$lib/types/thread.type';
  import type { ChatLayout } from '$lib/types/app.type';

  // Streaming timeouts (match ChatPane)
  const STREAMING_IDLE_TIMEOUT_MS = 60000;
  const STREAMING_INITIAL_RESPONSE_TIMEOUT_MS = 120000;

  interface Props {
    threadId: string | null;
    chatLayout: ChatLayout;
    /** Called when a new thread is created so the parent can update its state */
    onThreadCreated?: (newThread: Thread) => void;
  }

  let { threadId = $bindable(null), chatLayout, onThreadCreated }: Props = $props();

  // ── State ──
  let thread = $state<Thread | null>(null);
  let messages = $state<Message[]>([]);
  let isStreaming = $state(false);
  let responseText = $state('');
  let error = $state('');
  let chatServiceCreated = $state(false);
  let messagesEl: HTMLDivElement | undefined = $state();

  // Model info resolved from thread metadata or user selection
  let modelName = $state('');
  let modelProvider = $state('');
  let modelUrl = $state('');

  // Model selector (shown when no threadId — new-thread flow)
  let availableModels = $state<ModelDetails[]>([]);
  let selectedModelKey = $state('');
  let loadingModels = $state(false);

  // Timeout handles
  let streamingNoResponseTimeout: ReturnType<typeof setTimeout> | null = null;
  let streamingIdleTimeout: ReturnType<typeof setTimeout> | null = null;
  let streamingLastTokenAt = 0;

  // ── Derived ──
  let hasModel = $derived(Boolean(modelName && modelProvider));
  let isNewThread = $derived(!threadId && !thread);

  // ── Lifecycle ──
  onMount(async () => {
    if (threadId) {
      await loadThread();
    } else {
      // No thread yet — load models so user can pick one before sending
      await loadAvailableModels();
    }
  });

  onDestroy(() => {
    clearTimeouts();
    window.electronAPI.chat.offToken();
  });

  // Reload when threadId changes (e.g. from parent binding / querystring)
  $effect(() => {
    if (threadId) {
      loadThread();
    }
  });

  // ── Model loading (for new-thread flow) ──
  async function loadAvailableModels() {
    loadingModels = true;
    try {
      const models = await window.electronAPI.models.listAll();
      availableModels = models;
      // Auto-select first model
      if (models.length > 0) {
        const first = models[0];
        selectedModelKey = first.provider + '::' + first.id;
        applySelectedModel();
      }
    } catch (e) {
      console.warn('[ThreadChatView] Could not load models:', e);
    } finally {
      loadingModels = false;
    }
  }

  /** Parse selectedModelKey and set modelName / modelProvider / modelUrl */
  function applySelectedModel() {
    if (!selectedModelKey) return;
    const parts = selectedModelKey.split('::');
    const provider = parts[0];
    const id = parts.slice(1).join('::'); // handle ids with :: (unlikely)
    const found = availableModels.find((m) => m.provider === provider && m.id === id);
    if (found) {
      modelName = found.accessName;
      modelProvider = found.provider;
      modelUrl = found.url;
    }
  }

  function handleModelChange() {
    applySelectedModel();
  }

  // ── Thread loading ──
  async function loadThread() {
    if (!threadId) return;

    try {
      const t = await threadService.getThread(threadId);
      if (!t) {
        error = 'Thread not found';
        return;
      }
      thread = t;

      // Extract model info from metadata
      if (t.metadata) {
        modelName = (t.metadata.modelId as string) || '';
        modelProvider = (t.metadata.modelProvider as string) || '';
        modelUrl = (t.metadata.modelUrl as string) || '';

        // If we have modelId but no URL, resolve from models list
        if (modelName && !modelUrl) {
          try {
            const allModels: ModelDetails[] = await window.electronAPI.models.listAll();
            const detail = allModels.find((m) => m.accessName === modelName || m.id === modelName);
            if (detail) {
              modelName = detail.accessName;
              modelProvider = detail.provider;
              modelUrl = detail.url;
            }
          } catch (e) {
            console.warn('[ThreadChatView] Could not resolve model details:', e);
          }
        }
      }

      // Load messages
      const msgs = await threadService.getMessages(threadId);
      messages = msgs;

      // Scroll to bottom after loading
      await tick();
      scrollToBottom();
    } catch (e) {
      console.error('[ThreadChatView] Failed to load thread:', e);
      error = e instanceof Error ? e.message : 'Failed to load thread';
    }
  }

  // ── Thread creation ──
  /** Create a new thread with the first user prompt via addUserPrompt(null, ...) */
  async function createThreadWithPrompt(userMessage: string): Promise<boolean> {
    if (!hasModel) {
      error = 'Please select a model before sending a prompt.';
      return false;
    }

    try {
      console.log('[ThreadChatView] Creating new thread with addUserPrompt(null, ...)');
      const result = await window.electronAPI.thread.addUserPrompt(null, userMessage, {
        title: userMessage.substring(0, 60) + (userMessage.length > 60 ? '...' : ''),
        description: '',
        model: modelName,
        metadata: {
          modelTitle: modelName,
          modelProvider: modelProvider,
          modelId: modelName,
          modelUrl: modelUrl,
        },
      });

      thread = result.thread;
      threadId = result.thread.id;

      // Add the persisted user message to local list
      const userMsg: Message = {
        id: result.message.id,
        role: 'user',
        content: result.message.content,
        createdAt: result.message.createdAt,
        branchId: thread.currentBranchId || '1.0',
        modelId: modelName,
      };
      messages = [userMsg];

      // Notify parent (ThreadPage) so it can update the header title & threadId
      onThreadCreated?.(result.thread);

      // Update URL to include threadId (use replace so back goes to previous page, not bare /thread)
      replace(`${ROUTE.THREAD}?threadId=${result.thread.id}`);

      console.log('[ThreadChatView] Thread created:', result.thread.id);
      return true;
    } catch (e) {
      console.error('[ThreadChatView] Failed to create thread:', e);
      error = e instanceof Error ? e.message : 'Failed to create thread';
      return false;
    }
  }

  // ── Chat service initialisation ──
  async function initializeChatService(): Promise<boolean> {
    if (!thread?.id || !modelProvider || !modelName) {
      error = 'Cannot initialise chat: missing thread or model info';
      return false;
    }

    const result = await window.electronAPI.chat.createProvider(
      thread.id,
      modelProvider,
      { url: modelUrl, model: modelName },
      (thread.metadata?.workingDirectory as string) || undefined,
    );

    if (!result.success) {
      error = result.error || 'Failed to create chat provider';
      return false;
    }

    chatServiceCreated = true;
    return true;
  }

  // ── Token listener (streaming) ──
  function setupTokenListener() {
    responseText = '';
    window.electronAPI.chat.offToken();

    window.electronAPI.chat.onToken((data: { threadId: string; token: string }) => {
      if (data.threadId !== thread?.id) return;

      // First token: clear no-response timeout
      if (streamingNoResponseTimeout) {
        clearTimeout(streamingNoResponseTimeout);
        streamingNoResponseTimeout = null;
      }

      // Track last token time and restart idle timeout
      streamingLastTokenAt = Date.now();
      if (streamingIdleTimeout) clearTimeout(streamingIdleTimeout);
      streamingIdleTimeout = setTimeout(() => {
        if (isStreaming && Date.now() - streamingLastTokenAt >= STREAMING_IDLE_TIMEOUT_MS) {
          console.error('[ThreadChatView] Idle timeout – no tokens for 60 s');
          finishStreamingWithError('No response from model. Please try again.');
        }
      }, STREAMING_IDLE_TIMEOUT_MS);

      // Accumulate (force new string ref for Svelte reactivity)
      responseText = responseText + data.token;

      // Keep streaming message in view
      scrollToBottom();
    });
  }

  // ── Send message ──
  async function sendMessage(userMessage: string) {
    if (!userMessage.trim() || isStreaming) return;

    error = '';

    // ─── New-thread flow: create thread first ───
    if (!thread) {
      const created = await createThreadWithPrompt(userMessage);
      if (!created) return;
      // thread, messages, and threadId are now set by createThreadWithPrompt
      await tick();
      scrollToBottom();
    } else {
      // ─── Existing thread: optimistic user message ───
      const clientMessageId = crypto.randomUUID();
      const userMsg: Message = {
        id: clientMessageId,
        clientMessageId,
        role: 'user',
        content: userMessage,
        createdAt: Date.now(),
        branchId: thread.currentBranchId || '1.0',
      };
      messages = [...messages, userMsg];
      await tick();
      scrollToBottom();

      // Persist user message
      await threadService.appendMessage(thread.id, {
        role: 'user',
        content: userMessage,
        clientMessageId,
        branchId: userMsg.branchId,
      });
    }

    // Ensure chat provider is ready
    if (!chatServiceCreated) {
      const ok = await initializeChatService();
      if (!ok) return;
      // Small delay to let provider settle
      await new Promise((r) => setTimeout(r, 200));
    }

    // Set up streaming
    isStreaming = true;
    setupTokenListener();

    // Watchdog: no response at all
    streamingNoResponseTimeout = setTimeout(() => {
      if (isStreaming && responseText.length === 0) {
        finishStreamingWithError('No response from model after 2 minutes.');
      }
    }, STREAMING_INITIAL_RESPONSE_TIMEOUT_MS);

    // Idle timer bookkeeping
    streamingLastTokenAt = Date.now();
    if (streamingIdleTimeout) clearTimeout(streamingIdleTimeout);
    streamingIdleTimeout = setTimeout(() => {
      if (isStreaming && Date.now() - streamingLastTokenAt >= STREAMING_IDLE_TIMEOUT_MS) {
        finishStreamingWithError('No response from model. Please try again.');
      }
    }, STREAMING_IDLE_TIMEOUT_MS);

    // Build history for the model
    const historyMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const branchId = thread!.currentBranchId || '1.0';
    const request = {
      messages: historyMessages,
      streaming: true,
      model: modelName,
      thread_id: thread!.id,
      branch_id: branchId,
    };

    try {
      const result = (await window.electronAPI.chat.chat(thread!.id, request as any)) as {
        success: boolean;
        error?: string;
      };

      if (!result.success) {
        error = result.error || 'Chat failed';
        isStreaming = false;
        return;
      }

      // Streaming complete — persist assistant response
      if (thread && responseText) {
        await window.electronAPI.thread.addAssistantResponse(thread.id, responseText, modelName);

        // Append assistant message to local list
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseText,
          createdAt: Date.now(),
          branchId,
          modelId: modelName,
        };
        messages = [...messages, assistantMsg];
      }

      // Clean up streaming state
      responseText = '';
      isStreaming = false;
      window.electronAPI.chat.offToken();

      await tick();
      scrollToBottom();
    } catch (e) {
      console.error('[ThreadChatView] Error during chat:', e);
      error = e instanceof Error ? e.message : 'Unknown error';
      isStreaming = false;
    } finally {
      clearTimeouts();
    }
  }

  // ── Helpers ──
  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'auto' });
  }

  function clearTimeouts() {
    if (streamingNoResponseTimeout) {
      clearTimeout(streamingNoResponseTimeout);
      streamingNoResponseTimeout = null;
    }
    if (streamingIdleTimeout) {
      clearTimeout(streamingIdleTimeout);
      streamingIdleTimeout = null;
    }
  }

  function finishStreamingWithError(msg: string) {
    window.electronAPI.chat.offToken();
    isStreaming = false;
    error = msg;
    clearTimeouts();
  }

  // ── Build message pairs for rendering ──
  interface MessagePair {
    request: Message;
    response: Message | null;
    isStreamingResponse: boolean;
    streamingContent: string;
  }

  let messagePairs = $derived.by(() => {
    const pairs: MessagePair[] = [];
    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];
      if (msg.role === 'user') {
        const next = i + 1 < messages.length ? messages[i + 1] : null;
        if (next && next.role === 'assistant') {
          pairs.push({
            request: msg,
            response: next,
            isStreamingResponse: false,
            streamingContent: '',
          });
          i += 2;
        } else {
          // User message without response yet — might be streaming
          const isLast = i === messages.length - 1;
          pairs.push({
            request: msg,
            response: null,
            isStreamingResponse: isLast && isStreaming,
            streamingContent: isLast && isStreaming ? responseText : '',
          });
          i += 1;
        }
      } else {
        // Orphan assistant message (shouldn't happen normally)
        i += 1;
      }
    }
    return pairs;
  });
</script>

<div class="thread-chat-view">
  {#if error}
    <div class="error-banner" role="alert">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{error}</span>
      <button class="error-close" onclick={() => (error = '')} aria-label="Dismiss">
        <i class="pi pi-times"></i>
      </button>
    </div>
  {/if}

  <!-- Message list -->
  <div class="messages-area" bind:this={messagesEl}>
    {#if messagePairs.length === 0 && !isStreaming}
      <div class="empty-state">
        <i class="pi pi-comments"></i>
        <p>
          {#if isNewThread}
            Select a model and send your first prompt.
          {:else}
            No messages yet. Send a prompt to get started.
          {/if}
        </p>

        <!-- Model selector for new threads -->
        {#if isNewThread}
          <div class="model-selector">
            {#if loadingModels}
              <span class="loading-models">Loading models...</span>
            {:else if availableModels.length === 0}
              <span class="no-models">No models available. Check your connections in Settings.</span>
            {:else}
              <label class="model-label" for="model-select">
                <i class="pi pi-microchip-ai"></i>
                Model
              </label>
              <select
                id="model-select"
                class="model-dropdown"
                bind:value={selectedModelKey}
                onchange={handleModelChange}
              >
                {#each availableModels as m}
                  <option value="{m.provider}::{m.id}">
                    {m.title} ({m.provider})
                  </option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#each messagePairs as pair (pair.request.id)}
      <ChatMessage
        requestContent={pair.request.content}
        requestCreatedAt={pair.request.createdAt}
        modelId={pair.request.modelId}
        {chatLayout}
        responseContent={pair.response?.content || pair.streamingContent}
        isStreaming={pair.isStreamingResponse}
      />
    {/each}
  </div>

  <!-- Composer at the bottom -->
  <div class="composer-area">
    <Composer
      {sendMessage}
      {isStreaming}
      threadId={thread?.id ?? null}
      disabled={isNewThread && !hasModel}
    />
  </div>
</div>

<style>
  .thread-chat-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background: var(--error-bg, #fef2f2);
    color: var(--error-color, #dc2626);
    border-bottom: 1px solid var(--error-color, #dc2626);
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .error-banner i {
    flex-shrink: 0;
  }

  .error-banner span {
    flex: 1;
  }

  .error-close {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    border-radius: 4px;
  }

  .error-close:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-secondary, #666);
    gap: 0.75rem;
    padding: 2rem;
  }

  .empty-state i.pi-comments {
    font-size: 2.5rem;
    opacity: 0.4;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9rem;
  }

  /* Model selector */
  .model-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .model-label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary, #666);
  }

  .model-label i {
    font-size: 0.875rem;
  }

  .model-dropdown {
    padding: 0.375rem 0.625rem;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    background: var(--surface-card, #fff);
    color: var(--text-primary, #111);
    font-size: 0.8125rem;
    min-width: 200px;
    cursor: pointer;
  }

  .model-dropdown:focus {
    outline: 2px solid var(--primary-color, #646cff);
    outline-offset: 1px;
  }

  .loading-models,
  .no-models {
    font-size: 0.8125rem;
    font-style: italic;
  }

  .no-models {
    color: var(--error-color, #dc2626);
  }

  .composer-area {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
  }
</style>
