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
  import ChatMessage from '../ChatMessage.svelte';
  import ChatBranch from '../ChatBranch.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import { threadService } from '$lib/services/thread.service';
  import type { Thread, ModelDetails } from '../../../../../src-electron/preload';
  import type { Message } from '$lib/types/thread.type';
  import type { ChatLayout } from '$lib/types/app.type';
  import { copyToInput } from '$lib/services/clipboard.service';

  // Streaming timeouts (match ChatPane)
  const STREAMING_IDLE_TIMEOUT_MS = 60000;
  const STREAMING_INITIAL_RESPONSE_TIMEOUT_MS = 120000;

  interface Props {
    thread: Thread | null;
    messages: Message[];
    availableModels: ModelDetails[];
    chatLayout: ChatLayout;
    initialPrompt?: string | null;
    agentId?: string | null;
    /** Called when a new thread is created so the parent can update its state */
    _onThreadCreated?: (newThread: Thread) => void;
  }

  let {
    thread = null,
    messages = $bindable([]),
    availableModels = [],
    chatLayout,
    initialPrompt = null,
    agentId = null,
    onThreadCreated,
  }: Props = $props();

  // ── State ──
  let isStreaming = $state(false);
  let responseText = $state('');
  let error = $state('');
  let chatServiceCreated = $state(false);
  let chatServiceModelId = $state(''); // Track which model the service was created for
  let messagesEl: HTMLDivElement | undefined = $state();
  let fontSize = $state(14); // Font size from settings
  let unsubscribeStream: (() => void) | null = null; // Stream subscription cleanup

  // Model info resolved from thread metadata or user selection
  let modelId = $state(''); 
  let modelName = $state('');
  let _modelProvider = $state('');
  let _modelUrl = $state('');
  let modelAccessName = $state('');
  let applicationSlug = $state('');

  // Model selector (shown when no thread — new-thread flow)
  let selectedModelKey = $state('');

  function handleModelChange() {
    if (!selectedModelKey) return;
    const [provider, id] = selectedModelKey.split('::');
    const detail = availableModels.find((m) => m.provider === provider && m.id === id);
    if (detail) {
      modelName = detail.accessName;
      _modelProvider = detail.provider;
      _modelUrl = detail.url;
      modelAccessName = detail.accessName;
      applicationSlug = detail.provider;
    }
  }

  // Timeout handles
  let streamingNoResponseTimeout: ReturnType<typeof setTimeout> | null = null;
  let streamingIdleTimeout: ReturnType<typeof setTimeout> | null = null;
  let streamingLastTokenAt = 0;

  // ── Derived ──
  //  let hasModel = $derived(Boolean(modelName && modelProvider));
  let isNewThread = $derived(!thread);
  let threadId = $derived(thread?.id ?? null);

  // Get the branchId of the last displayed message
  let lastMessageBranchId = $derived.by(() => {
    if (displayItems.length === 0) return null;

    // Check last item
    const lastItem = displayItems[displayItems.length - 1];

    if (lastItem.type === 'message') {
      // Last item is a message - return its branchId
      return lastItem.pair.request.branchId;
    } else {
      // Last item is a branch - extract the row number and return row.0.0
      // so that calculateNextBranchId will increment to the next row
      const firstLane = lastItem.lanes[0];
      if (firstLane && firstLane.messagePairs.length > 0) {
        const lastPair = firstLane.messagePairs[firstLane.messagePairs.length - 1];
        const branchId = lastPair.request.branchId;
        // Extract row number (e.g., "2.1.0" -> "2")
        const row = branchId.split('.')[0];
        // Return row.0.0 so next message will be at row+1.0.0
        return `${row}.0.0`;
      }
    }

    return null;
  });

  // ── Lifecycle ──
  onMount(async () => {
    // Load font size from settings
    try {
      const settings = await window.electronAPI.settings.getAll();
      fontSize = settings.chatFontSize ?? 14;
    } catch (err) {
      console.error('[ThreadChatView] Failed to load font size setting:', err);
    }

    // Auto-select first model if no thread (new thread flow)
    if (!thread && availableModels.length > 0) {
      const first = availableModels[0];
      selectedModelKey = first.provider + '::' + first.id;
    }

    // Extract model info if thread exists
    if (thread?.metadata) {
      extractModelInfo();
    }
  });

  onDestroy(() => {
    clearTimeouts();
    unsubscribeStream?.();
  });

  function extractModelInfo() {
    if (!thread?.metadata) return;

    modelId = (thread.metadata.modelId as string) || '';
    _modelProvider = (thread.metadata.modelProvider as string) || '';
    _modelUrl = (thread.metadata.modelUrl as string) || '';

    console.log('[ThreadChatView] extractModelInfo - thread metadata:', {
      modelId,
      modelAccessName: thread.metadata.modelAccessName,
      availableModelsCount: availableModels.length
    });

    const detail = availableModels.find((m) => m.accessName === modelId || m.id === modelId);
    if (detail) {
      modelName = detail.accessName;
      _modelProvider = detail.provider;
      _modelUrl = detail.url;
      modelAccessName = detail.accessName;
      applicationSlug = detail.provider;
      console.log('[ThreadChatView] extractModelInfo - found model:', {
        modelAccessName,
        applicationSlug
      });
    } else {
      console.log('[ThreadChatView] extractModelInfo - model NOT found in availableModels');
    }
  }

  // ── Chat service initialisation ──
  async function getChatService(
    requestedModelId: string,
  ): Promise<{ success: boolean; created: boolean }> {
    if (!thread?.id) {
      error = 'Cannot initialise chat: missing thread info';
      return { success: false, created: false };
    }

    // If service already created with the same model, no need to recreate
    if (chatServiceCreated && chatServiceModelId === requestedModelId) {
      return { success: true, created: false };
    }

    // Look up model details only if model has changed
    const modelDetail = availableModels.find((m) => m.accessName === requestedModelId);
    if (!modelDetail) {
      error = `Cannot find model with accessName: ${requestedModelId}`;
      return { success: false, created: false };
    }


    // Verify we have required model info
    if (!modelDetail.provider) {
      error = 'Cannot initialise chat: missing model info';
      return { success: false, created: false };
    }

    // Create or recreate the provider
    const result = await window.electronAPI.chat.createProvider(
      thread.id,
      modelDetail.provider,
      { url: modelDetail.url, model: modelDetail.accessName },
      (thread.metadata?.workingDirectory as string) || undefined,
    );

    if (!result.success) {
      error = result.error || 'Failed to create chat provider';
      return { success: false, created: false };
    }

    chatServiceCreated = true;
    chatServiceModelId = requestedModelId;

    // Small delay to let provider settle
    await new Promise((r) => setTimeout(r, 300));

    return { success: true, created: true };
  }

  // ── Token listener (streaming) ──
  function setupTokenListener(branchId: string) {
    if (!thread?.id) return;

    responseText = '';

    // Unsubscribe from previous stream if any
    unsubscribeStream?.();

    // Subscribe to stream for this thread + branch
    unsubscribeStream = threadService.subscribeToStream(thread.id, branchId, (token: string) => {
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
          finishStreamingWithError('No response from model. Please try again.');
        }
      }, STREAMING_IDLE_TIMEOUT_MS);

      // Accumulate (force new string ref for Svelte reactivity)
      responseText = responseText + token;

      // Keep streaming message in view
      scrollToBottom();
    });
  }

  // ── Send message ──
  async function sendMessage(
    _appSlug: string,
    modelIds: string[],
    text: string,
    _attachments?: unknown[],
  ) {
    // Validation
    if (!text.trim() || isStreaming) return;

    error = '';

    // Calculate next branchId for user (prompt) and assistant (response) messages
    const branchId = await threadService.calculateNextBranchId(
      thread!.id,
      lastMessageBranchId || '0.0.0',
    );

    // Delegate to appropriate handler
    const multipleModels = modelIds.length > 1;
    if (multipleModels) {
      await sendMessageBranch(modelIds, branchId, text);
    } else {
      // Add user message for single model flow
      if (thread) {
        const clientMessageId = crypto.randomUUID();
        console.log('[ThreadChatView] sendMessage - creating message with modelId:', modelIds[0], 'from modelIds:', modelIds);
        const userMsg: Message = {
          id: clientMessageId,
          clientMessageId,
          role: 'user',
          content: text,
          createdAt: Date.now(),
          branchId,
          modelId: modelIds[0],
        };
        messages = [...messages, userMsg];
        await tick();
        scrollToBottom();

        // Persist user message
        await threadService.appendMessage(thread.id, {
          role: 'user',
          content: text,
          clientMessageId,
          branchId,
          modelId: modelIds[0],
        });
      }
      await sendMessageSingle(modelIds[0], branchId);
    }
  }

  // ── Send message to multiple models (branches) ──
  async function sendMessageBranch(modelIds: string[], branchId: string, text: string) {
    if (!thread) return;

    // Extract base row from branchId (e.g., "5.0.0" -> 5)
    const baseRow = parseInt(branchId.split('.')[0]) || 0;

    // Create lane branchIds for each model (start from lane 1, skip lane 0 which is main)
    const modelBranches: Array<{ modelId: string; branchId: string; responseText: string }> =
      modelIds.map((modelId, index) => ({
        modelId,
        branchId: `${baseRow}.${index + 1}.0`, // Lane 1, 2, 3, etc.
        responseText: '',
      }));

    // Create user messages and placeholder assistant messages for each lane
    const userMessages: Message[] = [];
    const assistantMessages: Message[] = [];

    for (const branch of modelBranches) {
      // Create user message
      const userClientMessageId = crypto.randomUUID();
      const userMsg: Message = {
        id: userClientMessageId,
        clientMessageId: userClientMessageId,
        role: 'user',
        content: text,
        createdAt: Date.now(),
        branchId: branch.branchId,
        modelId: branch.modelId,
      };
      userMessages.push(userMsg);

      // Create placeholder assistant message
      const assistantClientMessageId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantClientMessageId,
        clientMessageId: assistantClientMessageId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        branchId: branch.branchId,
        modelId: branch.modelId,
      };
      assistantMessages.push(assistantMsg);

      // Persist user message
      await threadService.appendMessage(thread.id, {
        role: 'user',
        content: text,
        clientMessageId: userClientMessageId,
        branchId: branch.branchId,
        modelId: branch.modelId,
      });
    }

    // Add all user and placeholder assistant messages at once for proper reactivity
    messages = [...messages, ...userMessages, ...assistantMessages];
    await tick();
    scrollToBottom();

    // Set up streaming for all branches
    isStreaming = true;

    // Set up token listeners for each branch
    const unsubscribers = modelBranches.map((branch) => {
      return threadService.subscribeToStream(thread!.id, branch.branchId, (token: string) => {
        // Find this branch and append token
        const branchData = modelBranches.find((b) => b.branchId === branch.branchId);
        if (branchData) {
          branchData.responseText += token;

          // Update the corresponding assistant message in the messages array
          const assistantMsgIndex = messages.findIndex(
            (m) => m.role === 'assistant' && m.branchId === branch.branchId
          );
          if (assistantMsgIndex !== -1) {
            // Create new array with updated message for Svelte reactivity
            const updatedMessages = [...messages];
            updatedMessages[assistantMsgIndex] = {
              ...updatedMessages[assistantMsgIndex],
              content: branchData.responseText,
            };
            messages = updatedMessages;
          }
        }

        // Keep streaming messages in view
        scrollToBottom();
      });
    });

    // Build history for the models
    const historyMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Send to all models in parallel
    const chatPromises = modelBranches.map(async (branch) => {
      // Get model details
      const modelDetails = availableModels.find((m) => m.accessName === branch.modelId);
      if (!modelDetails) {
        return { success: false, branchId: branch.branchId };
      }

      // Initialize chat service for this model
      const serviceResult = await getChatService(branch.modelId);
      if (!serviceResult.success) {
        return { success: false, branchId: branch.branchId };
      }

      const request = {
        messages: historyMessages,
        streaming: true,
        model: modelDetails.accessName,
      };

      try {
        const result = await threadService.sendChatMessage(thread!.id, branch.branchId, request);
        return { ...result, branchId: branch.branchId, modelDetails };
      } catch (_error) {
        return { success: false, branchId: branch.branchId };
      }
    });

    // Wait for all chats to complete
    await Promise.all(chatPromises);

    // Clean up streaming
    unsubscribers.forEach((unsub) => unsub());
    isStreaming = false;

    // Persist assistant responses for successful results
    for (const branch of modelBranches) {
      if (branch.responseText && thread) {
        const modelDetails = availableModels.find((m) => m.accessName === branch.modelId);

        // Persist the assistant response
        await window.electronAPI.thread.addAssistantResponse(
          thread.id,
          branch.responseText,
          modelDetails?.accessName || branch.modelId,
        );
      }
    }

    await tick();
    scrollToBottom();
  }

  // ── Send message to single model ──
  async function sendMessageSingle(modelId: string, branchId: string) {
    // Ensure chat provider is ready (creates or recreates if model changed)
    const result = await getChatService(modelId);
    if (!result.success) return;

    // Set up streaming for this specific branch BEFORE sending
    isStreaming = true;
    setupTokenListener(branchId);

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

    const request = {
      messages: historyMessages,
      streaming: true,
      model: modelName,
    };

    try {
      // Send chat message with the calculated branchId
      const chatResult = await threadService.sendChatMessage(thread!.id, branchId, request);

      if (!chatResult.success) {
        error = chatResult.error || 'Chat failed';
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

        // Wait for displayItems to recalculate with new message
        await tick();
      }

      // Clean up streaming state
      responseText = '';
      isStreaming = false;
      unsubscribeStream?.();
      unsubscribeStream = null;

      await tick();
      scrollToBottom();
    } catch (e) {
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
    unsubscribeStream?.();
    unsubscribeStream = null;
    isStreaming = false;
    error = msg;
    clearTimeouts();
  }

  // ── Build display items using thread service ──
  let displayItems = $derived.by(() => {
    return threadService.buildDisplayItems(messages, isStreaming, responseText);
  });

  /* Display items built from thread service */
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
  <div
    class="messages-area"
    class:layout-left-right={chatLayout === 'left-right'}
    class:layout-right-left={chatLayout === 'right-left'}
    bind:this={messagesEl}
  >
    {#if displayItems.length === 0 && !isStreaming}
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
            {#if availableModels.length === 0}
              <span class="no-models">No models available. Check your connections in Settings.</span
              >
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

    {#each displayItems as item (item.type === 'message' ? item.pair.request.id : item.id)}
      {#if item.type === 'message'}
        <ChatMessage
          requestContent={item.pair.request.content}
          requestCreatedAt={item.pair.request.createdAt}
          modelId={item.pair.request.modelId}
          branchId={item.pair.request.branchId}
          {chatLayout}
          {fontSize}
          responseContent={item.pair.response?.content || item.pair.streamingContent}
          isStreaming={item.pair.isStreamingResponse}
          onCopyRequest={() => copyToInput(item.pair.request.content)}
        />
      {:else if item.type === 'branch'}
        <ChatBranch branchId={item.id} lanes={item.lanes} {chatLayout} {fontSize} />
      {/if}
    {/each}
  </div>

  <!-- Composer at the bottom -->
  <div class="composer-area">
    <Composer
      {sendMessage}
      {isStreaming}
      {threadId}
      disabled={isNewThread}
      initialText={initialPrompt ?? ''}
      {applicationSlug}
      modelId={modelAccessName}
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

  .messages-area.layout-left-right,
  .messages-area.layout-right-left {
    padding-left: 0;
    padding-right: 0;
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

  .no-models {
    font-size: 0.8125rem;
    font-style: italic;
    color: var(--error-color, #dc2626);
  }

  .composer-area {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-main, #fafafa);
  }
</style>
