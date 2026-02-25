<script lang="ts">
  /**
   * ThreadChatView — Interactive chat view for user interaction with models
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatBranch from './ChatBranch.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import {
    threadFacade as threadService,
    type BackgroundStream,
  } from '$lib/services/thread-facade';
  import type { Thread, ModelDetails } from '../../../../../src-electron/preload';
  import type { Message } from '$lib/types/thread.type';
  import type { ChatLayout } from '$lib/types/app.type';
  import type { Attachment } from '$shared/types/attachment.types';
  import { copyToInput } from '$lib/services/clipboard.service';
  import { toastStore } from '$lib/services/toast.service';
  import { ThreadObserver } from '$lib/observer/thread-observer';

  // Debug flag - set to true to show debug activity box
  const SHOW_DEBUG_ACTIVITY = false;

  // Streaming timeouts (match ChatPane)
  const STREAMING_IDLE_TIMEOUT_MS = 60000;
  const STREAMING_INITIAL_RESPONSE_TIMEOUT_MS = 120000;

  interface Props {
    thread: Thread | null;
    messages: Message[];
    availableModels: ModelDetails[];
    chatLayout: ChatLayout;
    agentId?: string | null;
    onThreadCreated?: (thread: Thread) => void;
  }

  let {
    thread = null,
    messages = $bindable([]),
    availableModels = [],
    chatLayout,
    agentId = null,
    onThreadCreated: _onThreadCreated,
  }: Props = $props();

  // ── State ──
  let isStreaming = $state(false);
  let responseText = $state('');
  let error = $state('');
  let agentUnavailableInfo = $state(false);
  let messagesEl: HTMLDivElement | undefined = $state();
  let fontSize = $state(14); // Font size from settings
  let composerText = $state(''); // Text for composer (bindable for guard errors)
  let debugActivity = $state(''); // Debug activity log
  let lastHandledErrorBranch = $state(''); // Prevent duplicate error handling
  let expandedBranchRows = $state<Set<number>>(new Set()); // Branch rows force-expanded for viewing

  // ── Multi-stream support ──
  // Background streams live in threadService (singleton) so they survive component
  // destruction (e.g., when ThreadPage sets loading=true). Each thread can have an
  // independent background stream. When the user navigates away, the stream keeps
  // running. When the component is re-created, it re-attaches from the service.

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
      const branchId = lastItem.pair.request.branchId;
      // If from a branch lane (lane != 0), normalize to row.0.0 so calculateNextBranchId
      // increments to the next row rather than staying in the same branch row
      if (parseInt(branchId.split('.')[1] ?? '0') !== 0) {
        const row = branchId.split('.')[0];
        return `${row}.0.0`;
      }
      return branchId;
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

    // Warn if the thread's agent is no longer accessible
    if (thread) {
      const agentToCheck = agentId ?? (thread.metadata?.agentId as string | undefined);
      const available = await threadService.isAgentAvailable(agentToCheck);
      if (!available) {
        toastStore.show('You no longer have access to this assistant to submit prompts.', {
          variant: 'success',
        });
      }
    }
  });

  onDestroy(() => {
    console.log('[ThreadChatView] onDestroy — component being torn down.', {
      threadId: thread?.id,
      isStreaming,
      hasBgStream: thread?.id ? threadService.hasBackgroundStream(thread.id) : false,
    });
    clearTimeouts();
    // Background streams live in threadService — do NOT clean them up here.
    // They must survive component destruction so tokens keep accumulating
    // while the component is unmounted (e.g., during ThreadPage loading state).
  });

  // ── Detect thread switch during streaming ──
  // When the thread prop changes (same-route navigation), the component stays mounted.
  // Each thread's backend stream continues running independently via backgroundStreams.
  // We only detach/re-attach the UI-facing state (isStreaming, responseText).
  let previousThreadId: string | null = null;
  $effect(() => {
    const currentThreadId = thread?.id ?? null;
    console.log('[ThreadChatView] $effect fired.', {
      currentThreadId,
      previousThreadId,
      isStreaming,
      hasBgStream: currentThreadId ? threadService.hasBackgroundStream(currentThreadId) : false,
    });

    if (previousThreadId !== null && currentThreadId !== previousThreadId) {
      // Thread switch while component is mounted
      if (isStreaming) {
        console.log('[ThreadChatView] Thread switched during streaming. Detaching UI.', {
          from: previousThreadId,
          to: currentThreadId,
        });
        // Only reset UI-facing state. The background stream keeps running in threadService.
        isStreaming = false;
        responseText = '';
        clearTimeouts();
      }
    }

    // Check if the current thread has an active background stream in the service.
    // This handles both thread-switch navigation AND fresh component creation
    // (e.g., after ThreadPage loading=true destroys and re-creates us).
    if (currentThreadId && !isStreaming) {
      const bgStream = threadService.getBackgroundStream(currentThreadId);
      // Only re-attach if the streaming session is still active. A background
      // stream without a session means the chat request failed (e.g. 400 guard
      // error) and no tokens will ever arrive — re-attaching would show the
      // loading bubble forever.
      if (bgStream && threadService.hasStreamingSession(currentThreadId)) {
        console.log('[ThreadChatView] Re-attaching to active background stream.', {
          threadId: currentThreadId,
          accumulatedLength: bgStream.accumulatedText.length,
          isFirstMount: previousThreadId === null,
        });
        isStreaming = true;
        responseText = bgStream.accumulatedText;

        // The getMessages() merge interceptor may have injected a synthetic
        // assistant message (id: "streaming-{branchId}") into the messages array.
        // Strip it so buildDisplayItems falls back to the live responseText,
        // which is continuously updated by the token callback.
        const syntheticId = `streaming-${bgStream.branchId}`;
        const hadSynthetic = messages.some((m) => m.id === syntheticId);
        if (hadSynthetic) {
          messages = messages.filter((m) => m.id !== syntheticId);
          console.log('[ThreadChatView] Stripped synthetic assistant message:', syntheticId);
        }

        // Re-subscribe with a fresh callback that closes over THIS component's
        // reactive variables. The old callback (from the destroyed component instance
        // or a previous mount) still accumulates into bgStream.accumulatedText, but
        // it cannot update THIS component's responseText because it captured the old
        // component's scope. Replace it with one that can.
        bgStream.unsubscribe?.();
        bgStream.unsubscribe = threadService.subscribeToStream(
          currentThreadId,
          bgStream.branchId,
          createTokenCallback(currentThreadId, bgStream),
        );
        console.log(
          '[ThreadChatView] Re-subscribed with fresh callback for thread:',
          currentThreadId,
        );
      }
    }

    previousThreadId = currentThreadId;
  });

  function extractModelInfo() {
    if (!thread?.metadata) return;

    modelId = (thread.metadata.modelId as string) || '';

    const detail = availableModels.find((m) => m.accessName === modelId || m.id === modelId);
    if (detail) {
      modelName = detail.accessName;
      modelAccessName = detail.accessName;
      applicationSlug = detail.applicationSlug;

      console.log('[ThreadChatView] extractModelInfo - found model:', {
        modelId,
        modelAccessName,
        applicationSlug,
        availableModelsCount: availableModels.length,
      });
    } else {
      console.log('[ThreadChatView] extractModelInfo - model NOT found in availableModels');
    }
  }

  // ── Chat service initialisation ──
  async function getChatService(
    requestedModelId: string,
    branchId: string,
  ): Promise<{ success: boolean; created: boolean }> {
    if (!thread?.id) {
      error = 'Cannot initialise chat: missing thread info';
      return { success: false, created: false };
    }

    // Look up model details
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

    // Create the provider for this branch
    const result = await window.electronAPI.chat.createServiceForThread(
      thread.id,
      branchId,
      modelDetail.accessName,
      (thread.metadata?.workingDirectory as string) || undefined,
    );

    if (!result.success) {
      error = result.errorText || 'Failed to create chat provider';
      return { success: false, created: false };
    }

    // Small delay to let provider settle
    await new Promise((r) => setTimeout(r, 300));

    return { success: true, created: true };
  }

  // ── Helper: Add to debug log ──
  function addDebugLog(message: string) {
    if (!SHOW_DEBUG_ACTIVITY) return;
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    debugActivity = `[${timestamp}] ${message}\n${debugActivity}`;
    // Keep only last 50 lines
    const lines = debugActivity.split('\n');
    if (lines.length > 50) {
      debugActivity = lines.slice(0, 50).join('\n');
    }
  }

  // ── Token listener (streaming) ──
  // Sets up a per-thread token subscription that writes into the backgroundStreams map.
  // The callback updates both the background accumulator AND the UI-facing responseText
  // (only when the user is viewing this thread).

  /**
   * Build a token callback that closes over the CURRENT component's reactive state.
   * This must be called from the current component instance so that `thread`,
   * `isStreaming`, `responseText`, etc. refer to live reactive variables.
   */
  function createTokenCallback(forThreadId: string, bgStream: BackgroundStream) {
    return (token: string) => {
      addDebugLog(
        `[ThreadChatView] Received token for ${forThreadId} (length: ${token.length}): "${token.substring(0, 20)}..."`,
      );

      // First token: clear no-response timeout (only if this is the active thread)
      const isActiveThread = thread?.id === forThreadId;
      if (isActiveThread && streamingNoResponseTimeout) {
        clearTimeout(streamingNoResponseTimeout);
        streamingNoResponseTimeout = null;
        addDebugLog('[ThreadChatView] First token received - cleared no-response timeout');
      }

      // Track last token time and restart idle timeout (only for active thread)
      if (isActiveThread) {
        streamingLastTokenAt = Date.now();
        if (streamingIdleTimeout) clearTimeout(streamingIdleTimeout);
        streamingIdleTimeout = setTimeout(() => {
          if (isStreaming && Date.now() - streamingLastTokenAt >= STREAMING_IDLE_TIMEOUT_MS) {
            finishStreamingWithError('No response from model. Please try again.');
          }
        }, STREAMING_IDLE_TIMEOUT_MS);
      }

      // Always accumulate into the background stream (survives thread switching)
      bgStream.accumulatedText = bgStream.accumulatedText + token;

      // Sync to the ThreadService streaming session so getMessages() can merge
      threadService.updateStreamingContent(forThreadId, bgStream.accumulatedText);

      // Only update UI-facing state if the user is viewing this thread
      if (isActiveThread) {
        responseText = bgStream.accumulatedText;
        addDebugLog(`[ThreadChatView] Accumulated responseText (length: ${responseText.length})`);
        scrollToBottom();
      } else {
        // Background accumulation — log periodically (every 500 chars) to avoid spam
        if (bgStream.accumulatedText.length % 500 < token.length) {
          console.log('[ThreadChatView] Background token accumulation.', {
            threadId: forThreadId,
            accumulatedLength: bgStream.accumulatedText.length,
            viewingThread: thread?.id,
          });
        }
      }
    };
  }

  function setupTokenListener(forThreadId: string, branchId: string) {
    responseText = '';
    addDebugLog(
      `[ThreadChatView] setupTokenListener for thread: ${forThreadId}, branchId: ${branchId}`,
    );

    // Create (or replace) background stream entry in the service
    const existingStream = threadService.getBackgroundStream(forThreadId);
    existingStream?.unsubscribe?.();

    const bgStream: BackgroundStream = {
      threadId: forThreadId,
      branchId,
      accumulatedText: '',
      unsubscribe: null,
    };
    threadService.setBackgroundStream(forThreadId, bgStream);

    // Subscribe to stream for this thread + branch
    bgStream.unsubscribe = threadService.subscribeToStream(
      forThreadId,
      branchId,
      createTokenCallback(forThreadId, bgStream),
    );

    addDebugLog(`[ThreadChatView] Stream subscription established for thread: ${forThreadId}`);
  }

  // ── Send message ──
  async function sendMessage(
    _appSlug: string,
    modelIds: string[],
    text: string,
    _attachments?: Attachment[],
  ) {
    // Validation
    if (!text.trim() || isStreaming) return;
    const threadId: string = thread?.id || '';

    // Check agent availability (all threads require an agent)
    const agentToCheck = agentId ?? (thread?.metadata?.agentId as string | undefined);
    const available = await threadService.isAgentAvailable(agentToCheck);
    if (!available) {
      agentUnavailableInfo = true;
      return;
    }

    error = '';

    // Calculate next branchId for user (prompt) and assistant (response) messages
    const branchId = threadService.calculateNextBranchId(messages, lastMessageBranchId || '0.0.0');

    // Delegate to appropriate handler
    const multipleModels = modelIds.length > 1;
    if (multipleModels) {
      await sendMessageBranch(threadId, modelIds, branchId, text);
    } else {
      await sendMessageSingle(threadId, branchId, modelIds[0], text);
    }
  }

  // ── Send message to multiple models (branches) ──
  async function sendMessageBranch(
    threadId: string,
    modelIds: string[],
    branchId: string,
    text: string,
  ) {
    if (!thread) return;

    // Capture the threadId at start so we persist to the correct thread
    const capturedThreadId = threadId;

    addDebugLog(`[sendMessageBranch] Starting with ${modelIds.length} models`);

    // Extract base row from branchId (e.g., "5.0.0" -> 5)
    const baseRow = parseInt(branchId.split('.')[0]) || 0;

    // Create lane branchIds for each model (start from lane 1, skip lane 0 which is main)
    const modelBranches: Array<{ modelId: string; branchId: string; responseText: string }> =
      modelIds.map((modelId, index) => ({
        modelId,
        branchId: `${baseRow}.${index + 1}.0`, // Lane 1, 2, 3, etc.
        responseText: '',
      }));

    addDebugLog(
      `[sendMessageBranch] Created branches: ${modelBranches.map((b) => b.branchId).join(', ')}`,
    );

    // Register a background stream entry so the $effect knows this thread is streaming
    const bgStream: BackgroundStream = {
      threadId: capturedThreadId,
      branchId: modelBranches[0]?.branchId ?? branchId,
      accumulatedText: '',
      unsubscribe: null,
    };
    threadService.setBackgroundStream(capturedThreadId, bgStream);

    // Note: streaming session for branch mode is registered after user messages are created
    // (see below) because we need the first user message for the session.

    // Create user messages and placeholder assistant messages for each lane
    const userMessages: Message[] = [];
    const assistantMessages: Message[] = [];

    for (const branch of modelBranches) {
      // Create user message
      const userClientMessageId = crypto.randomUUID();
      const userMsg: Message = {
        id: userClientMessageId,
        threadId: capturedThreadId,
        clientMessageId: userClientMessageId,
        role: 'user',
        content: text,
        createdAt: Date.now(),
        branchId: branch.branchId,
        modelId: branch.modelId,
        guardExecution: 'none',
        guardMessageId: null,
        guardError: '',
      };
      userMessages.push(userMsg);

      // Create placeholder assistant message
      const assistantClientMessageId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantClientMessageId,
        threadId: capturedThreadId,
        clientMessageId: assistantClientMessageId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        branchId: branch.branchId,
        modelId: branch.modelId,
        guardExecution: 'none',
        guardMessageId: null,
        guardError: '',
      };
      assistantMessages.push(assistantMsg);

      // Persist user message
      await threadService.appendMessage(capturedThreadId, {
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

    addDebugLog(
      `[sendMessageBranch] Added ${userMessages.length} user and ${assistantMessages.length} assistant messages`,
    );

    // Register streaming session with ThreadService (use first user message)
    if (userMessages.length > 0) {
      threadService.registerStreamingSession(
        capturedThreadId,
        modelBranches[0].branchId,
        userMessages[0],
        modelBranches[0].modelId,
      );
    }

    // Set up streaming for all branches
    isStreaming = true;

    // Set up token listeners for each branch
    const unsubscribers = modelBranches.map((branch) => {
      addDebugLog(`[sendMessageBranch] Setting up subscription for ${branch.branchId}`);
      return threadService.subscribeToStream(capturedThreadId, branch.branchId, (token: string) => {
        addDebugLog(
          `[sendMessageBranch] Token received for ${branch.branchId} (${token.length} chars)`,
        );
        // Find this branch and append token
        const branchData = modelBranches.find((b) => b.branchId === branch.branchId);
        if (branchData) {
          branchData.responseText += token;

          // Only update UI messages if the user is viewing this thread
          if (thread?.id === capturedThreadId) {
            const assistantMsgIndex = messages.findIndex(
              (m) => m.role === 'assistant' && m.branchId === branch.branchId,
            );
            if (assistantMsgIndex !== -1) {
              const updatedMessages = [...messages];
              updatedMessages[assistantMsgIndex] = {
                ...updatedMessages[assistantMsgIndex],
                content: branchData.responseText,
              };
              messages = updatedMessages;
            }
            scrollToBottom();
          }
        }
      });
    });

    // Store a combined unsubscribe function
    bgStream.unsubscribe = () => unsubscribers.forEach((unsub) => unsub());

    // Build history for the models
    const historyMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    addDebugLog(`[sendMessageBranch] Sending to ${modelBranches.length} models in parallel`);

    // Send to all models in parallel
    const chatPromises = modelBranches.map(async (branch) => {
      addDebugLog(`[sendMessageBranch] Starting chat for ${branch.branchId}`);
      // Get model details
      const modelDetails = availableModels.find((m) => m.accessName === branch.modelId);
      if (!modelDetails) {
        return { success: false, branchId: branch.branchId };
      }

      // Initialize chat service for this branch
      addDebugLog(`[sendMessageBranch] Initializing service for ${branch.branchId}`);
      const serviceResult = await getChatService(branch.modelId, branch.branchId);
      if (!serviceResult.success) {
        addDebugLog(`[sendMessageBranch] Service init FAILED for ${branch.branchId}`);
        return { success: false, branchId: branch.branchId };
      }
      addDebugLog(`[sendMessageBranch] Service initialized for ${branch.branchId}`);

      const request = {
        messages: historyMessages,
        streaming: true,
        model: modelDetails.accessName,
      };

      try {
        addDebugLog(`[sendMessageBranch] Sending message for ${branch.branchId}`);
        const result = await threadService.sendChatMessage(
          capturedThreadId,
          branch.branchId,
          request,
        );
        addDebugLog(
          `[sendMessageBranch] Chat result for ${branch.branchId}: ${result.success ? 'SUCCESS' : 'FAILED'}`,
        );
        return { ...result, branchId: branch.branchId, modelDetails };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addDebugLog(`[sendMessageBranch] ERROR for ${branch.branchId}: ${errorMessage}`);
        return { success: false, branchId: branch.branchId };
      }
    });

    // Wait for all chats to complete
    const _results = await Promise.all(chatPromises);

    const isViewingThisThread = thread?.id === capturedThreadId;

    addDebugLog(`[sendMessageBranch] All chats complete. Cleaning up.`);

    // Clean up streaming and streaming session
    bgStream.unsubscribe?.();
    threadService.deleteBackgroundStream(capturedThreadId);
    threadService.clearStreamingSession(capturedThreadId);
    if (isViewingThisThread) {
      isStreaming = false;
    }

    // Persist assistant responses using the captured threadId (not current thread)
    for (const branch of modelBranches) {
      if (branch.responseText) {
        const modelDetails = availableModels.find((m) => m.accessName === branch.modelId);

        addDebugLog(
          `[sendMessageBranch] Persisting response for ${branch.branchId} (${branch.responseText.length} chars)`,
        );
        // Persist the assistant response to the correct thread
        await window.electronAPI.thread.addAssistantResponse(
          capturedThreadId,
          branch.responseText,
          modelDetails?.accessName || branch.modelId,
        );
      } else if (!branch.responseText) {
        addDebugLog(`[sendMessageBranch] WARNING: No response text for ${branch.branchId}`);
      }
    }

    // Notify the thread observer to evaluate background tasks
    if (thread) {
      ThreadObserver.getInstance().observe(thread, messages);
    }

    addDebugLog(`[sendMessageBranch] Complete`);

    await tick();
    scrollToBottom();
  }

  // ── Send message to single model ──
  async function sendMessageSingle(
    threadId: string,
    branchId: string,
    modelId: string,
    promptText: string,
  ) {
    // add new prompt as "local" message - let thread-repository replace it once it shows up in llm_requests
    const [success, newMessage]: [boolean, Message] = await threadService.appendPrompt(
      threadId,
      branchId,
      promptText,
      modelId,
      messages,
    );
    if (!success || !newMessage) return;

    messages = [...messages, newMessage];
    await tick();
    scrollToBottom();

    // Register the streaming session with ThreadService so getMessages()
    // can merge streaming data with API results when the user switches back.
    threadService.registerStreamingSession(threadId, branchId, newMessage, modelId);

    // Set up streaming for this specific branch BEFORE sending.
    // setupTokenListener creates a BackgroundStream entry in the map.
    isStreaming = true;
    setupTokenListener(threadId, branchId);

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

    // Capture values for the entire async lifetime of this send operation
    const capturedThreadId = threadId;
    const capturedBranchId = branchId;
    const capturedModelName = modelName;

    try {
      const chatResult = await threadService.submitPromptToChat(
        capturedThreadId,
        capturedBranchId,
        modelId,
        messages,
      );

      // Check if the user is still viewing this thread
      const isViewingThisThread = thread?.id === capturedThreadId;

      if (!chatResult.success) {
        const errorMessage = chatResult.errorText ?? 'Chat failed';
        console.log('[ThreadChatView] Error check (result validation):', errorMessage);
        // Clear the streaming session — the chat request failed so no tokens
        // will arrive. Without this, returning to the thread later would find
        // the orphaned session and show an infinite loading state.
        threadService.clearStreamingSession(capturedThreadId);
        if (isViewingThisThread) {
          handleGuardError(errorMessage, capturedBranchId);
          isStreaming = false;
        }
        return;
      }

      // Streaming complete — persist assistant response using the background accumulator.
      // This survives thread switching because it's stored in threadService.
      const bgStream = threadService.getBackgroundStream(capturedThreadId);
      const finalText = bgStream?.accumulatedText ?? '';
      if (finalText) {
        console.log('[ThreadChatView] Streaming complete. Final responseText:', {
          length: finalText.length,
          content: finalText,
          persistToThread: capturedThreadId,
        });
        addDebugLog(
          `[ThreadChatView] Streaming complete - persisting response (${finalText.length} chars) to thread ${capturedThreadId}`,
        );
        await window.electronAPI.thread.addAssistantResponse(
          capturedThreadId,
          finalText,
          capturedModelName,
        );

        // Only update local messages if the user is still viewing the same thread
        if (isViewingThisThread) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            threadId: capturedThreadId,
            role: 'assistant',
            content: finalText,
            createdAt: Date.now(),
            branchId: capturedBranchId,
            modelId: modelId,
            guardExecution: 'none',
            guardMessageId: null,
            guardError: '',
          };
          messages = [...messages, assistantMsg];
          await tick();
        }

        // Notify the thread observer to evaluate background tasks
        if (thread) {
          ThreadObserver.getInstance().observe(thread, messages);
        }
      }

      // Clean up this thread's background stream and streaming session — fully complete
      console.log('[ThreadChatView] Stream complete — cleaning up.', {
        capturedThreadId,
        isViewingThisThread,
        finalTextLength: finalText.length,
      });
      bgStream?.unsubscribe?.();
      threadService.deleteBackgroundStream(capturedThreadId);
      threadService.clearStreamingSession(capturedThreadId);
      if (isViewingThisThread) {
        responseText = '';
        isStreaming = false;
      }

      await tick();
      scrollToBottom();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.log('[ThreadChatView] Catch block 2 (main error handler):', errorMessage);
      const isViewingThisThread = thread?.id === capturedThreadId;
      // Clean up this thread's background stream and streaming session
      const bgStream = threadService.getBackgroundStream(capturedThreadId);
      bgStream?.unsubscribe?.();
      threadService.deleteBackgroundStream(capturedThreadId);
      threadService.clearStreamingSession(capturedThreadId);
      // Only update UI state if we're still on the same thread
      if (isViewingThisThread) {
        handleGuardError(errorMessage, capturedBranchId);
        isStreaming = false;
      }
    } finally {
      clearTimeouts();
    }
  }

  // ── Helpers ──
  function handleGuardError(errorMessage: string, branchId: string) {
    // Prevent duplicate handling for the same branch
    console.log('[ThreadChatView] handleGuardError called', {
      branchId,
      lastHandledErrorBranch,
      willSkip: lastHandledErrorBranch === branchId,
    });

    if (lastHandledErrorBranch === branchId) {
      console.log('[ThreadChatView] ✓ Skipping duplicate error handling for branch:', branchId);
      return;
    }

    // Check if this is a guard/PII error
    const isGuardError =
      errorMessage.includes('personally identifiable') ||
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
      lastHandledErrorBranch = branchId; // Mark this branch as handled
      // Extract the "message" field from JSON body (e.g. "400 {"error":{"message":"..."}}"),
      // falling back to the raw string if parsing fails or the field is absent.
      try {
        const jsonStart = errorMessage.indexOf('{');
        const parsed = jsonStart !== -1 ? JSON.parse(errorMessage.slice(jsonStart)) : null;
        error = parsed?.error?.message ?? errorMessage;
      } catch {
        error = errorMessage;
      }

      // Find the request message that triggered the guard and mark it as failed
      const requestMessage = messages.find((m) => m.branchId === branchId && m.role === 'user');

      if (requestMessage) {
        requestMessage.guardExecution = 'fail';
        requestMessage.guardError = error;
        messages = [...messages]; // Trigger reactivity
        console.log('[ThreadChatView] Marked message as guard-blocked');
      }

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
    // Clean up the current thread's background stream and streaming session
    const currentId = thread?.id;
    if (currentId) {
      const bgStream = threadService.getBackgroundStream(currentId);
      bgStream?.unsubscribe?.();
      threadService.deleteBackgroundStream(currentId);
      threadService.clearStreamingSession(currentId);
    }
    isStreaming = false;
    error = msg;
    clearTimeouts();
  }

  // ── Lane selection ──
  async function handleSelectLane(branchItemId: string, laneIndex: number): Promise<void> {
    if (!thread?.id) return;

    const branchItem = displayItems.find(
      (item) => item.type === 'branch' && item.id === branchItemId,
    );
    if (!branchItem || branchItem.type !== 'branch') return;

    const lane = branchItem.lanes[laneIndex];
    if (!lane) return;

    await threadService.selectBranchLane(thread.id, lane.branchId, messages);

    // Update in-memory messages so displayItems re-derives immediately with new isSelectedBranch values
    const [rowStr] = lane.branchId.split('.');
    const row = parseInt(rowStr);
    const selectedLaneNum = parseInt(lane.branchId.split('.')[1]);
    messages = messages.map((m) => {
      const parts = m.branchId.split('.');
      if (parseInt(parts[0]) !== row || m.role !== 'user') {
        return m;
      }
      const msgLane = parseInt(parts[1]);
      return {
        ...m,
        desktopOptions: {
          ...(m.desktopOptions ?? {}),
          isSelectedBranch: msgLane === selectedLaneNum,
        },
      };
    });

    // If this row was force-expanded for viewing, collapse it now
    if (expandedBranchRows.has(row)) {
      const next = new Set(expandedBranchRows);
      next.delete(row);
      expandedBranchRows = next;
    }
  }

  // ── Branch view expand/dismiss ──
  function handleBranchIconClick(branchId: string): void {
    const row = parseInt(branchId.split('.')[0]);
    if (!isNaN(row)) {
      const next = new Set(expandedBranchRows);
      next.add(row);
      expandedBranchRows = next;
    }
  }

  function handleDismissBranch(branchPosition: number): void {
    const next = new Set(expandedBranchRows);
    next.delete(branchPosition);
    expandedBranchRows = next;
  }

  // ── Build display items using thread service ──
  let displayItems = $derived.by(() => {
    return threadService.buildDisplayItems(
      messages,
      isStreaming,
      responseText,
      availableModels,
      expandedBranchRows,
    );
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

  {#if agentUnavailableInfo}
    <div class="info-banner" role="status">
      <i class="pi pi-info-circle"></i>
      <span>This assistant is no longer available or you do not have permission to use it.</span>
      <button
        class="info-close"
        onclick={() => (agentUnavailableInfo = false)}
        aria-label="Dismiss"
      >
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
              <select id="model-select" class="model-dropdown" bind:value={selectedModelKey}>
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
          userName={item.pair.request.userId || 'You'}
          {chatLayout}
          {fontSize}
          responses={item.pair.responses}
          isStreaming={item.pair.isStreamingResponse}
          streamingContent={item.pair.streamingContent}
          onCopyRequest={(content) => copyToInput(content)}
          showBranchIcon={item.isFromBranch === true}
          onBranchClick={item.isFromBranch
            ? () => handleBranchIconClick(item.pair.request.branchId)
            : undefined}
          guardStatus={item.pair.request.guardExecution}
          guardError={item.pair.request.guardError}
        />
      {:else if item.type === 'branch'}
        {console.log('[ThreadChatView] Rendering ChatBranch:', {
          branchId: item.id,
          laneCount: item.lanes.length,
          lanes: item.lanes,
        })}
        <ChatBranch
          branchId={item.id}
          lanes={item.lanes}
          {chatLayout}
          {fontSize}
          onCopyRequest={(content) => copyToInput(content)}
          onSelectLane={(laneIndex) => handleSelectLane(item.id, laneIndex)}
          isViewMode={item.isviewMode ?? false}
          onDismiss={item.isviewMode ? () => handleDismissBranch(item.position) : undefined}
        />
      {/if}
    {/each}

    <!-- Loading indicator while waiting for first streaming token -->
    {#if isStreaming && responseText === ''}
      <div class="waiting-indicator">
        <div class="waiting-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    {/if}
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

    <!-- Debug Activity Box -->
    {#if SHOW_DEBUG_ACTIVITY}
      <div class="debug-area">
        <div class="debug-header">
          <span class="debug-title">🔍 Debug Activity</span>
          <button
            class="debug-clear"
            onclick={() => (debugActivity = '')}
            aria-label="Clear debug log"
          >
            Clear
          </button>
        </div>
        <textarea
          class="debug-log"
          readonly
          value={debugActivity}
          placeholder="Debug activity will appear here..."
        ></textarea>
      </div>
    {/if}
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

  .info-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: color-mix(in srgb, var(--info-color) 10%, var(--surface-main));
    border-bottom: 1px solid color-mix(in srgb, var(--info-color) 30%, transparent);
    color: var(--info-color);
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .info-banner span {
    flex: 1;
  }

  .info-close {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0;
    display: flex;
    align-items: center;
  }

  .info-close:hover {
    opacity: 1;
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
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .debug-area {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    padding: 0.75rem;
  }

  .debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .debug-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .debug-clear {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: var(--surface-hover, #f0f0f0);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .debug-clear:hover {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .debug-log {
    width: 100%;
    height: 150px;
    padding: 0.5rem;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    background: #1e1e1e;
    color: #d4d4d4;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 4px;
    resize: vertical;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .debug-log::placeholder {
    color: #6a6a6a;
  }

  /* Waiting indicator for first streaming token */
  .waiting-indicator {
    display: flex;
    align-items: center;
    padding: 1rem;
    margin: 0.5rem 0;
  }

  .waiting-dots {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .waiting-dots .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--primary-color, #646cff);
    opacity: 0.6;
    animation: pulse-dot 1.4s ease-in-out infinite;
  }

  .waiting-dots .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .waiting-dots .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .waiting-dots .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse-dot {
    0%,
    60%,
    100% {
      opacity: 0.6;
      transform: scale(1);
    }
    30% {
      opacity: 1;
      transform: scale(1.2);
    }
  }
</style>
