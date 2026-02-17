<script lang="ts">
  /**
   * ThreadChatView — Interactive chat view for user interaction with models 
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatBranch from './ChatBranch.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import { threadService } from '$lib/services/thread.service';
  import type { Thread, ModelDetails } from '../../../../../src-electron/preload';
  import type { Message } from '$lib/types/thread.type';
  import type { ChatLayout } from '$lib/types/app.type';
  import type { Attachment } from '$shared/types/attachment.types';
  import { copyToInput } from '$lib/services/clipboard.service';

  // Streaming timeouts (match ChatPane)
  const STREAMING_IDLE_TIMEOUT_MS = 60000;
  const STREAMING_INITIAL_RESPONSE_TIMEOUT_MS = 120000;

  interface Props {
    thread: Thread | null;
    messages: Message[];
    availableModels: ModelDetails[];
    chatLayout: ChatLayout;
    agentId?: string | null;
  }

  let {
    thread = null,
    messages = $bindable([]),
    availableModels = [],
    chatLayout,
    agentId = null,
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
  let composerText = $state(''); // Text for composer (bindable for guard errors)

  // Model info resolved from thread metadata or user selection
  let modelId = $state('');
  let modelName = $state('');
  let modelAccessName = $state('');
  let applicationSlug = $state('');

  // Model selector (shown when no thread — new-thread flow)
  let selectedModelKey = $state('');

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

    console.log('[ThreadChatView] extractModelInfo - thread metadata:', {
      modelId,
      modelAccessName: thread.metadata.modelAccessName,
      availableModelsCount: availableModels.length
    });

    const detail = availableModels.find((m) => m.accessName === modelId || m.id === modelId);
    if (detail) {
      modelName = detail.accessName;
      modelAccessName = detail.accessName;
      applicationSlug = detail.applicationSlug;
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
    appSlug: string,
    modelIds: string[],
    text: string,
    _attachments?: Attachment[],
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
      await sendMessageSingle(modelIds[0], branchId, text);
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
        modelName: branch.modelId,
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('[ThreadChatView] Catch block 1 (multi-model):', errorMessage);
        return { success: false, branchId: branch.branchId };
      }
    });

    // Wait for all chats to complete
    const _results = await Promise.all(chatPromises);

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
  async function sendMessageSingle(modelId: string, branchId: string, promptText: string) {

          // Add user message for single model flow
      if (thread) {
        const clientMessageId = crypto.randomUUID();
        console.log('[ThreadChatView] sendMessage - creating message with modelId:', modelId); 
        const userMsg: Message = {
          id: clientMessageId,
          clientMessageId,
          role: 'user',
          content: promptText,
          createdAt: Date.now(),
          branchId,
          modelId: modelId,
        };
        messages = [...messages, userMsg];
        await tick();
        scrollToBottom();

        // Persist user message
        await threadService.appendMessage(thread.id, {
          role: 'user',
          content: promptText,
          clientMessageId,
          branchId,
          modelName: modelId,
        });
      }

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
      console.log('[ThreadChatView] Chat result:', chatResult);

      if (!chatResult.success) {
        const errorMessage = chatResult.error || 'Chat failed';
        console.log('[ThreadChatView] Error check (result validation):', errorMessage);
        handleGuardError(errorMessage, branchId);
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
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.log('[ThreadChatView] Catch block 2 (main error handler):', errorMessage);
      handleGuardError(errorMessage, branchId);
      isStreaming = false;
    } finally {
      clearTimeouts();
    }
  }

  // ── Helpers ──
  function handleGuardError(errorMessage: string, branchId: string) {
    // Check if this is a guard/PII error
    const isGuardError = errorMessage.includes('personally identifiable') ||
                         errorMessage.includes('PII') ||
                         errorMessage.includes('inappropriate') ||
                         errorMessage.includes('not allowed') ||
                         errorMessage.includes('guard') ||
                         errorMessage.includes('blocked') ||
                         errorMessage.includes('ResponseError') ||
                         errorMessage.includes('detected:') ||
                         errorMessage.includes('Physical address') ||
                         errorMessage.includes('Social Security Number') ||
                         errorMessage.includes('credit card') ||
                         errorMessage.includes('Potential');

    if (isGuardError) {
      error = `🛡️ Message blocked by security guard: ${errorMessage}`;

      // Find the request message that triggered the guard
      const requestMessage = messages.find(
        m => m.branchId === branchId && m.role === 'user'
      );

      if (requestMessage) {
        // Save the original prompt text
        const originalPrompt = requestMessage.content;

        // Replace the request message content with redacted text
        requestMessage.content = '--> Redacted <--';
        messages = [...messages]; // Trigger reactivity

        // Put the original text back in the composer for editing
        composerText = originalPrompt;

        console.log('[ThreadChatView] Redacted blocked message and restored to composer');
      }

      // Add a system message to the thread
      const guardMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `**⚠️ Message Blocked**\n\n${errorMessage}\n\n*Your message was not sent to the model. It has been restored to the input field for editing.*`,
        createdAt: Date.now(),
        branchId,
      };
      messages = [...messages, guardMessage];

      console.log('[ThreadChatView] Guard blocked message:', errorMessage);
    } else {
      error = errorMessage;
    }
  }

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

  /* OLD CODE - COMMENTED OUT FOR TESTING
  // ── Build message pairs for rendering ──
  interface MessagePair {
    request: Message;
    response: Message | null;
    isStreamingResponse: boolean;
    streamingContent: string;
  }

  interface Lane {
    id: string;
    branchId: string;
    messagePairs: MessagePair[];
    modelName?: string;
  }

  interface MessageDisplay {
    type: 'message';
    pair: MessagePair;
  }

  interface BranchDisplay {
    type: 'branch';
    id: string;
    position: number;
    lanes: Lane[];
  }

  type DisplayItem = MessageDisplay | BranchDisplay;

  /**
   * Build display items from messages - handles both regular messages and branches
   *
  let displayItems = $derived.by(() => {
    if (messages.length === 0) return [];

    // Filter out hidden messages (e.g., guard-blocked messages)
    const visibleMessages = messages.filter(m => !m.isHidden);

    if (visibleMessages.length === 0) return [];

    // Sort messages by branchId first
    const sortedMessages = [...visibleMessages].sort((a, b) => {
      const [aRow, aLane, aIter] = a.branchId.split('.').map(Number);
      const [bRow, bLane, bIter] = b.branchId.split('.').map(Number);

      // Sort by row, then lane, then iteration
      if (aRow !== bRow) return aRow - bRow;
      if (aLane !== bLane) return aLane - bLane;
      return aIter - bIter;
    });

    console.log('[ThreadChatView] Sorted messages:', sortedMessages.map(m => ({
      branchId: m.branchId,
      role: m.role,
      content: m.content.substring(0, 30)
    })));

    // Group messages by row (first number in branchId)
    const rowMap = new Map<number, Message[]>();

    for (const msg of sortedMessages) {
      const row = getBranchRow(msg.branchId);

      if (!rowMap.has(row)) {
        rowMap.set(row, []);
      }

      rowMap.get(row)!.push(msg);
    }

    // Build display items
    const items: DisplayItem[] = [];
    const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

    for (const row of sortedRows) {
      const rowMessages = rowMap.get(row)!;

      console.log(`[ThreadChatView] Processing row ${row}, messages:`, rowMessages.map(m => ({
        branchId: m.branchId,
        lane: getBranchLane(m.branchId),
        role: m.role
      })));

      // Check if this row has branches (any message with lane != 0)
      const hasBranches = rowMessages.some((msg) => getBranchLane(msg.branchId) !== 0);

      console.log(`[ThreadChatView] Row ${row} hasBranches:`, hasBranches);

      if (!hasBranches) {
        // Single lane (main branch only) - display as regular message pairs
        const pairs = buildMessagePairs(rowMessages);

        for (const pair of pairs) {
          items.push({
            type: 'message',
            pair,
          });
        }
      } else {
        // Multiple lanes - display as branch
        // Group messages by lane key (first two parts: "1.0", "1.1", etc.)
        const laneMap = new Map<string, Message[]>();

        for (const msg of rowMessages) {
          const laneKey = getLaneKey(msg.branchId);

          if (!laneMap.has(laneKey)) {
            laneMap.set(laneKey, []);
          }

          laneMap.get(laneKey)!.push(msg);
        }

        console.log(`[ThreadChatView] Row ${row} lane keys:`, Array.from(laneMap.keys()));

        // Build lanes sorted by lane number
        const laneKeys = Array.from(laneMap.keys()).sort((a, b) => {
          const laneA = getBranchLane(a);
          const laneB = getBranchLane(b);
          return laneA - laneB;
        });

        const lanes: Lane[] = laneKeys.map((laneKey, index) => {
          const msgs = laneMap.get(laneKey)!;
          const pairs = buildMessagePairs(msgs);

          // Try to extract model name from first message
          const modelName = msgs[0]?.modelId || undefined;

          console.log(`[ThreadChatView] Lane ${laneKey}:`, {
            messageCount: msgs.length,
            pairCount: pairs.length,
            modelName
          });

          return {
            id: `lane-${row}-${index}`,
            branchId: laneKey,
            messagePairs: pairs,
            modelName,
          };
        });

        console.log(`[ThreadChatView] Creating branch for row ${row} with ${lanes.length} lanes`);

        items.push({
          type: 'branch',
          id: `branch-${row}`,
          position: row,
          lanes,
        });
      }
    }

    return items;
  });
  END OLD CODE */
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
          responses={item.pair.responses}
          isStreaming={item.pair.isStreamingResponse}
          streamingContent={item.pair.streamingContent}
          onCopyRequest={() => copyToInput(item.pair.request.content)}
        />
      {:else if item.type === 'branch'}
        {console.log('[ThreadChatView] Rendering ChatBranch:', { branchId: item.id, laneCount: item.lanes.length, lanes: item.lanes })}
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
      initialText={composerText}
      {applicationSlug}
      {agentId}
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
