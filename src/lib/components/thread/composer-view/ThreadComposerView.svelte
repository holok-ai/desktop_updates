<script lang="ts">
  /**
   * ThreadComposerView — Independent composer/document editing view.
   *
   * Split layout: chat column (left) + ComposerPane (right).
   * Single-model only — no branching.
   * Handles prompt augmentation, composer tag parsing, version management,
   * and live streaming to both chat and ComposerPane.
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import ChatMessage from '../chat-view/ChatMessage.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import {
    threadFacade as threadService,
    type BackgroundStream,
  } from '$lib/services/thread-facade';
  import type { Thread, ModelDetails } from '../../../../../src-electron/preload';
  import type { Message } from '$lib/types/thread.type';
  import type { ChatLayout } from '$lib/types/app.type';
  import type { Attachment } from '$shared/types/attachment.types';
  import { toastStore } from '$lib/services/toast.service';
  import { ThreadObserver } from '$lib/observer/thread-observer';
  import ContextStatus from '../chat-view/ContextStatus.svelte';
  import { ObserverTaskType } from '../../../../../src-shared/types/observer.types';
  import type { ToolCall } from '$lib/types/tool-call.type';
  import { threadStreamService } from '$lib/services/thread-stream.service';
  import ComposerPane from './ComposerPane.svelte';
  import { artifactStore } from '$lib/stores/artifact.store';
  import { artifactFrontendService } from '$lib/services/artifact-frontend.service';
  import { sidebarCollapsed } from '$lib/stores/sidebar.store';
  import { parseComposerTag } from '$shared/utils/composer-parser';
  import type { ComposerContent } from '$shared/types/composer.types';

  // Streaming timeouts
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
  let fontSize = $state(14);
  let composerText = $state('');
  let lastHandledErrorBranch = $state('');

  // Tool calls
  let activeToolCalls = $state<ToolCall[]>([]);
  let completedToolCalls = $state(new Map<string, ToolCall[]>());

  // Captured write_file content for document mode
  let pendingWriteContent = $state<string | null>(null);

  // Live streaming content extracted from <composer> tags — fed into ComposerPane
  let streamingComposerContent = $state<string | null>(null);

  // Composer-specific: tracks the latest user-edited content from ArtifactPane textarea
  let composerDirtyContent = $state<string | null>(null);

  /** Called by ArtifactPane whenever the user types in the textarea */
  function handleComposerContentChange(content: string): void {
    composerDirtyContent = content;
  }

  /** Convert simplified tool uses from API-loaded messages into ToolCall objects */
  function toolCallsFromResponses(
    responses: Array<{ id: string; tools?: Array<{ name: string; status: string }> }>,
  ): ToolCall[] {
    return responses.flatMap((r) =>
      (r.tools ?? []).map((t, i) => ({
        id: `${r.id}-tool-${i}`,
        name: t.name,
        inputHint: t.name,
        status: (t.status as ToolCall['status']) ?? 'complete',
        startedAt: 0,
      })),
    );
  }

  // Model info resolved from thread metadata
  let modelId = $state('');
  let modelName = $state('');
  let modelAccessName = $state('');
  let applicationSlug = $state('');

  // Timeout handles
  let streamingNoResponseTimeout: ReturnType<typeof setTimeout> | null = null;
  let streamingIdleTimeout: ReturnType<typeof setTimeout> | null = null;
  let streamingLastTokenAt = 0;

  // ── Derived ──
  let isNewThread = $derived(!thread);
  let threadId = $derived(thread?.id ?? null);

  // ── Artifact (Document Mode) ──
  let artifactActive = $state(false);
  $effect(() => {
    const unsub = artifactStore.subscribe(() => {
      artifactActive = threadId ? artifactStore.isActive(threadId) : false;
    });
    return unsub;
  });

  // Load artifact data whenever the thread changes
  $effect(() => {
    if (threadId) {
      artifactStore.loadForThread(threadId);
    }
  });

  // Auto-collapse sidebar when composer view is active; restore on deactivate
  let savedSidebarState: boolean | null = null;
  $effect(() => {
    if (artifactActive) {
      const currentUnsub = sidebarCollapsed.subscribe((v) => {
        if (savedSidebarState === null) savedSidebarState = v;
      });
      currentUnsub();
      sidebarCollapsed.set(true);
    } else if (savedSidebarState !== null) {
      sidebarCollapsed.set(savedSidebarState);
      savedSidebarState = null;
    }
  });

  // Get branchId of last displayed message (simplified — no branching)
  let lastMessageBranchId = $derived.by(() => {
    if (displayItems.length === 0) return null;
    const lastItem = displayItems[displayItems.length - 1];
    if (lastItem.type === 'message') {
      return lastItem.pair.request.branchId;
    }
    return null;
  });

  // ── Lifecycle ──
  onMount(async () => {
    try {
      const settings = await window.electronAPI.settings.getAll();
      fontSize = settings.chatFontSize ?? 14;
    } catch (err) {
      window.electronAPI.log.error('[ThreadComposerView] Failed to load font size setting:', err);
    }

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
    clearTimeouts();
  });

  // ── Detect thread switch during streaming ──
  let previousThreadId: string | null = null;
  $effect(() => {
    const currentThreadId = thread?.id ?? null;

    if (previousThreadId !== null && currentThreadId !== previousThreadId) {
      if (isStreaming) {
        window.electronAPI.log.info(
          '[ThreadComposerView] Thread switched during streaming. Detaching UI.',
          { from: previousThreadId, to: currentThreadId },
        );
        isStreaming = false;
        responseText = '';
        streamingComposerContent = null;
        clearTimeouts();
      }
    }

    // Re-attach to existing background stream
    if (currentThreadId && !isStreaming) {
      const bgStream = threadService.getBackgroundStream(currentThreadId);
      if (bgStream && threadService.hasStreamingSession(currentThreadId)) {
        window.electronAPI.log.info(
          '[ThreadComposerView] Re-attaching to active background stream.',
          {
            threadId: currentThreadId,
            accumulatedLength: bgStream.accumulatedText.length,
          },
        );
        isStreaming = true;
        responseText = bgStream.accumulatedText;

        // Strip synthetic assistant message
        const syntheticId = `streaming-${bgStream.branchId}`;
        const hadSynthetic = messages.some((m) => m.id === syntheticId);
        if (hadSynthetic) {
          messages = messages.filter((m) => m.id !== syntheticId);
        }

        bgStream.unsubscribe?.();
        bgStream.unsubscribe = threadService.subscribeToStream(
          currentThreadId,
          bgStream.branchId,
          createTokenCallback(currentThreadId, bgStream),
        );
      }
    }

    previousThreadId = currentThreadId;
  });

  // Initialize observer tasks when thread + messages are first loaded
  let lastInitializedThreadId: string | null = null;
  $effect(() => {
    const currentThreadId = thread?.id ?? null;
    if (
      currentThreadId !== null &&
      messages.length > 0 &&
      currentThreadId !== lastInitializedThreadId
    ) {
      lastInitializedThreadId = currentThreadId;
      ThreadObserver.getInstance().initializeThread(thread!, messages);
    }
  });

  function extractModelInfo(): void {
    if (!thread?.metadata) return;
    modelId = (thread.metadata.modelId as string) || '';
    const detail = availableModels.find((m) => m.accessName === modelId || m.id === modelId);
    if (detail) {
      modelName = detail.accessName;
      modelAccessName = detail.accessName;
      applicationSlug = detail.applicationSlug;
    }
  }

  // ── Token listener (streaming) ──
  function createTokenCallback(forThreadId: string, bgStream: BackgroundStream) {
    return (token: string) => {
      const isActiveThread = thread?.id === forThreadId;
      if (isActiveThread && streamingNoResponseTimeout) {
        clearTimeout(streamingNoResponseTimeout);
        streamingNoResponseTimeout = null;
      }

      if (isActiveThread) {
        streamingLastTokenAt = Date.now();
        if (streamingIdleTimeout) clearTimeout(streamingIdleTimeout);
        streamingIdleTimeout = setTimeout(() => {
          if (isStreaming && Date.now() - streamingLastTokenAt >= STREAMING_IDLE_TIMEOUT_MS) {
            finishStreamingWithError('No response from model. Please try again.');
          }
        }, STREAMING_IDLE_TIMEOUT_MS);
      }

      bgStream.accumulatedText = bgStream.accumulatedText + token;
      threadService.updateStreamingContent(forThreadId, bgStream.accumulatedText);

      if (isActiveThread) {
        const raw = bgStream.accumulatedText;
        const composerOpenIdx = raw.indexOf('<composer ');

        if (composerOpenIdx !== -1) {
          const openTagEnd = raw.indexOf('>', composerOpenIdx);
          if (openTagEnd !== -1) {
            const closingTag = '</composer>';
            const closingIdx = raw.indexOf(closingTag, openTagEnd);
            // Feed inner content to ComposerPane
            const innerContent =
              closingIdx !== -1
                ? raw.substring(openTagEnd + 1, closingIdx)
                : raw.substring(openTagEnd + 1);
            streamingComposerContent = innerContent.trim();

            // Strip <composer> block from responseText shown in chat
            const stripped =
              closingIdx !== -1
                ? raw.substring(0, composerOpenIdx) + raw.substring(closingIdx + closingTag.length)
                : raw.substring(0, composerOpenIdx);
            responseText = stripped.replace(/\n{3,}/g, '\n\n').trim();
          } else {
            // Opening tag incomplete — show text before it
            responseText = raw.substring(0, composerOpenIdx).trim();
          }
        } else {
          responseText = raw;
        }

        scrollToBottom();
      }
    };
  }

  function setupTokenListener(forThreadId: string, branchId: string): void {
    responseText = '';

    const existingStream = threadService.getBackgroundStream(forThreadId);
    existingStream?.unsubscribe?.();

    const bgStream: BackgroundStream = {
      threadId: forThreadId,
      branchId,
      accumulatedText: '',
      unsubscribe: null,
    };
    threadService.setBackgroundStream(forThreadId, bgStream);

    const unsubStream = threadService.subscribeToStream(
      forThreadId,
      branchId,
      createTokenCallback(forThreadId, bgStream),
    );

    const unsubToolUse = threadStreamService.subscribeToToolUse(forThreadId, branchId, (calls) => {
      if (thread?.id === forThreadId) {
        activeToolCalls = calls;
      }
    });

    // Capture write_file content for document mode
    pendingWriteContent = null;
    const unsubWriteCapture = window.electronAPI.chat.onToolUse((data) => {
      if (data.threadId !== forThreadId || data.branchId !== branchId) return;
      if (data.toolName === 'write_file' && data.stage === 'in_progress') {
        const input = data.input as { path?: string; content?: string } | undefined;
        if (input?.content && artifactStore.isActive(forThreadId)) {
          const artifact = artifactStore.getArtifact(forThreadId);
          if (artifact && input.path?.includes(artifact.filename)) {
            pendingWriteContent = input.content;
          }
        }
      }
    });

    bgStream.unsubscribe = () => {
      unsubStream();
      unsubToolUse();
      unsubWriteCapture();
    };
  }

  // ── Send message (single model only — no branching) ──
  async function sendMessage(
    _appSlug: string,
    modelIds: string[],
    text: string,
    attachments?: Attachment[],
  ): Promise<void> {
    if (!text.trim() || isStreaming) return;
    const threadId: string = thread?.id || '';

    const agentToCheck = agentId ?? (thread?.metadata?.agentId as string | undefined);
    const available = await threadService.isAgentAvailable(agentToCheck);
    if (!available) {
      agentUnavailableInfo = true;
      return;
    }

    error = '';

    // Update thread metadata if model changed
    const primaryModelId = modelIds[0];
    if (primaryModelId && thread) {
      const selectedDetail = availableModels.find((m) => m.accessName === primaryModelId);
      const storedModelTitle = thread.metadata?.modelTitle as string | undefined;
      if (selectedDetail && selectedDetail.title !== storedModelTitle) {
        modelName = selectedDetail.accessName;
        modelAccessName = selectedDetail.accessName;
        applicationSlug = selectedDetail.applicationSlug;
        threadService.update(thread.id, {
          metadata: {
            ...thread.metadata,
            modelTitle: selectedDetail.title,
            modelId: selectedDetail.accessName,
            modelProvider: selectedDetail.provider,
          },
        });
      }
    }

    const branchId = threadService.calculateNextBranchId(messages, lastMessageBranchId || '0.0.0');

    // Single model only — always use first model
    await sendMessageSingle(threadId, branchId, modelIds[0], text, attachments);
  }

  async function sendMessageSingle(
    threadId: string,
    branchId: string,
    selectedModelId: string,
    promptText: string,
    attachments?: Attachment[],
  ): Promise<void> {
    // Prompt augmentation for composer mode
    let finalPromptText = promptText;
    const isActiveDirectCheck = artifactStore.isActive(threadId);
    window.electronAPI.log.info('[ComposerView] Augmentation gate check', {
      threadId,
      artifactActive,
      isActiveDirectCheck,
    });
    if (artifactActive || isActiveDirectCheck) {
      const augResult = await artifactFrontendService.getPromptAugmentation(threadId);
      window.electronAPI.log.info('[ComposerView] Augmentation result', {
        success: augResult.success,
        hasAugmentation: !!augResult.augmentation,
        augmentationLength: augResult.augmentation?.length ?? 0,
      });
      if (augResult.success && augResult.augmentation) {
        finalPromptText = `${augResult.augmentation}\n\n${promptText}`;
      }
    }

    const [success, newMessage]: [boolean, Message] = await threadService.appendPrompt(
      threadId,
      branchId,
      finalPromptText,
      selectedModelId,
      messages,
      attachments,
    );
    if (!success || !newMessage) return;

    // Display original prompt, not augmented version
    const displayMessage =
      finalPromptText !== promptText ? { ...newMessage, content: promptText } : newMessage;
    const chatMessages = [...messages, newMessage];
    messages = [...messages, displayMessage];
    await tick();
    scrollToBottom();

    threadService.registerStreamingSession(threadId, branchId, newMessage, selectedModelId);

    isStreaming = true;
    setupTokenListener(threadId, branchId);

    // Watchdog: no response at all
    streamingNoResponseTimeout = setTimeout(() => {
      if (isStreaming && responseText.length === 0) {
        finishStreamingWithError('No response from model after 2 minutes.');
      }
    }, STREAMING_INITIAL_RESPONSE_TIMEOUT_MS);

    streamingLastTokenAt = Date.now();
    if (streamingIdleTimeout) clearTimeout(streamingIdleTimeout);
    streamingIdleTimeout = setTimeout(() => {
      if (isStreaming && Date.now() - streamingLastTokenAt >= STREAMING_IDLE_TIMEOUT_MS) {
        finishStreamingWithError('No response from model. Please try again.');
      }
    }, STREAMING_IDLE_TIMEOUT_MS);

    const capturedThreadId = threadId;
    const capturedBranchId = branchId;
    const capturedModelName = modelName;

    try {
      // Save user canvas edits as a version before sending
      if (artifactStore.isActive(capturedThreadId) && composerDirtyContent !== null) {
        await artifactFrontendService.addUserVersion(
          capturedThreadId,
          composerDirtyContent,
          'user_edit_on_prompt',
        );
        await artifactStore.refreshArtifact(capturedThreadId);
        composerDirtyContent = null;
      }

      const chatResult = await threadService.submitPromptToChat(
        capturedThreadId,
        capturedBranchId,
        selectedModelId,
        chatMessages,
      );

      const isViewingThisThread = thread?.id === capturedThreadId;

      if (!chatResult.success) {
        const errorMessage = chatResult.errorText ?? 'Chat failed';
        window.electronAPI.log.warn(
          '[ThreadComposerView] Error check (result validation):',
          errorMessage,
        );
        threadService.clearStreamingSession(capturedThreadId);
        activeToolCalls = [];
        threadStreamService.clearToolCalls(capturedThreadId, capturedBranchId);
        if (isViewingThisThread) {
          handleGuardError(errorMessage, capturedBranchId);
          isStreaming = false;
        }
        return;
      }

      // Streaming complete — persist assistant response
      const bgStream = threadService.getBackgroundStream(capturedThreadId);
      const finalText = bgStream?.accumulatedText ?? '';
      if (finalText) {
        window.electronAPI.log.info('[ThreadComposerView] Streaming complete.', {
          length: finalText.length,
          threadId: capturedThreadId,
        });
        await window.electronAPI.thread.addAssistantResponse(
          capturedThreadId,
          finalText,
          capturedModelName,
        );

        // Parse <composer> tags from the response
        const composerResult = parseComposerTag(finalText);

        // If composer content was found, create an AI version in the artifact
        let capturedVersionId: number | undefined;
        if (artifactStore.isActive(capturedThreadId) && composerResult.composer) {
          const versionResult = await artifactFrontendService.addUserVersion(
            capturedThreadId,
            composerResult.composer.content,
            'attachment_edit',
            'ai',
            composerResult.composer.versionDescription,
            composerResult.composer.title,
          );
          if (versionResult.success && versionResult.version) {
            capturedVersionId = versionResult.version.id;
          }
          await artifactStore.refreshArtifact(capturedThreadId);
        }

        // Handle write_file capture
        if (artifactStore.isActive(capturedThreadId) && pendingWriteContent !== null) {
          await artifactFrontendService.addUserVersion(
            capturedThreadId,
            pendingWriteContent,
            'attachment_edit',
          );
          pendingWriteContent = null;
          await artifactStore.refreshArtifact(capturedThreadId);
        } else {
          pendingWriteContent = null;
        }

        // Build assistant message with stripped content and composer data
        if (isViewingThisThread) {
          const completedTools = activeToolCalls.map((tool) => ({
            name: tool.name,
            status: 'complete' as const,
          }));

          // Attach versionId to composer data for card click navigation
          const composerWithVersion: ComposerContent | undefined = composerResult.composer
            ? { ...composerResult.composer, versionId: capturedVersionId }
            : undefined;

          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            threadId: capturedThreadId,
            role: 'assistant',
            content: composerResult.composer ? composerResult.strippedContent : finalText,
            createdAt: Date.now(),
            branchId: capturedBranchId,
            modelId: selectedModelId,
            guardExecution: 'none',
            guardMessageId: null,
            guardError: '',
            toolUses: completedTools.length > 0 ? completedTools : undefined,
            composer: composerWithVersion,
          };
          messages = [...messages, assistantMsg];
          await tick();
        }

        // Notify the thread observer
        if (thread) {
          ThreadObserver.getInstance().observe(thread, messages);
        }
      }

      // Snapshot tool calls
      const toolCallSnapshot = threadStreamService.getToolCalls(capturedThreadId, capturedBranchId);
      if (toolCallSnapshot.length > 0) {
        completedToolCalls = new Map(completedToolCalls).set(capturedBranchId, toolCallSnapshot);
      }
      activeToolCalls = [];
      threadStreamService.clearToolCalls(capturedThreadId, capturedBranchId);

      // Clean up
      bgStream?.unsubscribe?.();
      threadService.deleteBackgroundStream(capturedThreadId);
      threadService.clearStreamingSession(capturedThreadId);
      if (isViewingThisThread) {
        responseText = '';
        isStreaming = false;
        streamingComposerContent = null;
      }

      await tick();
      scrollToBottom();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      window.electronAPI.log.error(
        '[ThreadComposerView] Catch block (main error handler):',
        errorMessage,
      );
      const isViewingThisThread = thread?.id === capturedThreadId;
      const bgStream = threadService.getBackgroundStream(capturedThreadId);
      activeToolCalls = [];
      threadStreamService.clearToolCalls(capturedThreadId, capturedBranchId);
      bgStream?.unsubscribe?.();
      threadService.deleteBackgroundStream(capturedThreadId);
      threadService.clearStreamingSession(capturedThreadId);
      if (isViewingThisThread) {
        handleGuardError(errorMessage, capturedBranchId);
        isStreaming = false;
        streamingComposerContent = null;
      }
    } finally {
      clearTimeouts();
    }
  }

  // ── Context compaction ──
  function handleCompactNow(): void {
    if (!thread) return;
    ThreadObserver.getInstance().forceTask(ObserverTaskType.CompressContext, thread, messages);
  }

  // ── Composer mode activation (create new thread + artifact) ──
  async function handleComposerModeActivation(): Promise<void> {
    try {
      const currentAgentId = agentId ?? (thread?.metadata?.agentId as string | undefined) ?? '';
      const currentProjectId = thread?.projectId ?? null;

      const result = await threadService.create(
        'New Composer Thread',
        currentProjectId,
        currentAgentId,
        modelAccessName || undefined,
      );
      if (!result.success || !result.data) {
        toastStore.error('Failed to create Composer thread');
        return;
      }
      const newThread = result.data;

      const initResult = await artifactFrontendService.initialize(newThread.id, 'Document', '');
      if (!initResult.success || !initResult.artifact) {
        toastStore.error('Failed to initialize Composer document');
        return;
      }

      artifactStore.activateFromArtifact(newThread.id, initResult.artifact);
      _onThreadCreated?.(newThread);
    } catch (err) {
      console.error('[ComposerView] Activation error:', err);
      toastStore.error('Composer activation failed');
    }
  }

  // ── Version card click: navigate ComposerPane to that version ──
  function handleComposerCardClick(composer: ComposerContent): void {
    if (!threadId) return;
    const version = artifactStore.getVersion(
      threadId,
      composer.versionId,
      composer.versionDescription,
    );
    if (!version) return;
    artifactStore.showVersion(threadId, version.id);
  }

  // ── Helpers ──
  function handleGuardError(errorMessage: string, branchId: string): void {
    if (lastHandledErrorBranch === branchId) return;

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
      lastHandledErrorBranch = branchId;
      try {
        const jsonStart = errorMessage.indexOf('{');
        const parsed = jsonStart !== -1 ? JSON.parse(errorMessage.slice(jsonStart)) : null;
        error = parsed?.error?.message ?? errorMessage;
      } catch {
        error = errorMessage;
      }

      const requestMessage = messages.find((m) => m.branchId === branchId && m.role === 'user');
      if (requestMessage) {
        requestMessage.guardExecution = 'fail';
        requestMessage.guardError = error;
        messages = [...messages];
      }
    } else {
      error = errorMessage;
    }
  }

  function scrollToBottom(): void {
    if (!messagesEl) return;
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'auto' });
  }

  function clearTimeouts(): void {
    if (streamingNoResponseTimeout) {
      clearTimeout(streamingNoResponseTimeout);
      streamingNoResponseTimeout = null;
    }
    if (streamingIdleTimeout) {
      clearTimeout(streamingIdleTimeout);
      streamingIdleTimeout = null;
    }
  }

  function finishStreamingWithError(msg: string): void {
    const currentId = thread?.id;
    if (currentId) {
      const bgStream = threadService.getBackgroundStream(currentId);
      bgStream?.unsubscribe?.();
      threadService.deleteBackgroundStream(currentId);
      threadService.clearStreamingSession(currentId);
    }
    activeToolCalls = [];
    isStreaming = false;
    streamingComposerContent = null;
    error = msg;
    clearTimeouts();
  }

  // ── Build display items (no branching — expanded branch rows not needed) ──
  let displayItems = $derived.by(() => {
    return threadService.buildDisplayItems(messages, isStreaming, responseText, availableModels);
  });
</script>

<div class="thread-composer-view">
  <!-- Chat column (left side) -->
  <div class="chat-column">
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
          <i class="pi pi-file-edit"></i>
          <p>
            Ask me to generate a draft or an outline. Attach a file. Or drop a file in the Composer.
          </p>
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
            tools={item.pair.isStreamingResponse
              ? activeToolCalls
              : (completedToolCalls.get(item.pair.request.branchId) ??
                toolCallsFromResponses(item.pair.responses))}
            guardStatus={item.pair.request.guardExecution}
            guardError={item.pair.request.guardError}
            onComposerCardClick={handleComposerCardClick}
          />
        {/if}
      {/each}

      <!-- Loading indicator while waiting for first streaming token -->
      {#if isStreaming && responseText === '' && activeToolCalls.length === 0}
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
        onActivateComposerMode={handleComposerModeActivation}
        documentModeActive={artifactActive}
      />
      <div class="context-status-row">
        <ContextStatus threadId={threadId ?? null} onCompactNow={handleCompactNow} />
      </div>
    </div>
  </div>

  <!-- Artifact pane (right side) -->
  {#if threadId}
    <ComposerPane
      {threadId}
      {fontSize}
      onContentChange={handleComposerContentChange}
      streamingContent={streamingComposerContent}
    />
  {/if}
</div>

<style>
  .thread-composer-view {
    display: flex;
    flex-direction: row;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .chat-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* Widen the composer — the chat column is narrower in split layout */
  .thread-composer-view :global(.composer-box) {
    width: 95%;
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

  .empty-state i {
    font-size: 2.5rem;
    opacity: 0.4;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9rem;
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

  .context-status-row {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: calc(4px - 0.75rem);
    margin-bottom: -0.375rem;
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
