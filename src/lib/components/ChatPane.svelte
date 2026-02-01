<script lang="ts">
  import { onMount, createEventDispatcher, tick } from 'svelte';
  import { get } from 'svelte/store';
  import type { Thread, DesktopChatRequest } from '../../../src-electron/preload';
  import { outboxService } from '$lib/services/outbox.service';
  import { networkService } from '$lib/services/network.service';
  import { MessageTransmitter } from '$lib/services/message-transmitter.service';
  import { MESSAGE_STATUS } from '$lib/constants/status.constant';
  import { threadService } from '$lib/services/thread.service';
  import type { Message, BranchType } from '$lib/types/thread.type';
  import MessageBubble from './MessageBubble.svelte';
  import MessageVersionHistory from './MessageVersionHistory.svelte';
  import MoveThreadModal from './modals/MoveThreadModal.svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import { isThreadGeneratingTitle } from '$lib/stores/titleGeneration.store';
  import { storageService } from '$lib/services/storage.service';
  import { FileWriteEventService, type FileWriteEvent } from '$lib/services/file-write-event.service';
  import VariationModal from './branching/VariationModal.svelte';
  import BranchLane from './branching/BranchLane.svelte';
  import BranchIndicator from './branching/BranchIndicator.svelte';
  import BranchSwitcher from './branching/BranchSwitcher.svelte';
  import { assembleContext, getBranchMessages, getVariationsForBranch, getForkPoints, getNextSequentialBranchId, getNextBranchIdInBranch, buildContextFromSelectedBranches, getRowNumber, normalizeBranchId, getMessagesToHideAfterForkPoint } from '$lib/utils/branch-utils';

  // Streaming idle timeout in milliseconds (60 seconds)
  const STREAMING_IDLE_TIMEOUT_MS = 60000;

  interface Props {
    thread?: Thread | null;
    messages?: Message[];
    composer?: import('svelte').Snippet<
      [
        {
          sendMessage: (message: string) => Promise<void>;
          isStreaming: boolean;
          disabled?: boolean;
        },
      ]
    >;
  }

  let {
    thread = null,
    messages = $bindable([]),
    composer,
  }: Props = $props();

  // Reactive thread state that updates when backend sends updates
  let currentThread = $state<Thread | null>(null);

  // Model configuration derived from thread metadata
  let modelName = $state('');
  let modelUrl = $state('');
  let modelProvider = $state('');

  // Track current provider config to detect changes
  interface ProviderConfig {
    provider: string;
    url: string;
    model: string;
  }
  let currentProviderConfig: ProviderConfig | null = $state(null);
  let threadLoadedIds = $state(new Set<string>()); // Track which threads we've logged
  let isHandlingVariation = $state(false); // Prevent auto-reinitialization during variation handling

  // Timeout for cases where streaming starts but no tokens are ever received
  let streamingNoResponseTimeout: ReturnType<typeof setTimeout> | null = null;
  // Idle timeout if tokens stop flowing for too long
  let streamingIdleTimeout: ReturnType<typeof setTimeout> | null = null;
  let streamingLastTokenAt = 0;

  // Strip internal status messages from content before sending as history to the model
  const STATUS_VALIDATING_REGEX = /\[Validating request and running security checks\.\.\.\]\n?/g;
  const STATUS_PASSED_REGEX =
    /\[Security checks passed, processing your request\.\.\.\]\n?/g;

  function stripStatusMessages(text: string): string {
    return text.replaceAll(STATUS_VALIDATING_REGEX, '').replaceAll(STATUS_PASSED_REGEX, '');
  }

  // Watch for prop changes and update model configuration from thread metadata
  // Sync currentThread from thread prop, but avoid unnecessary updates that could cause loops
  $effect(() => {
    const previousThreadId = currentThread?.id;
    const threadIdChanged = thread?.id !== previousThreadId || (!thread && currentThread);
    
    // Extract model configuration from thread metadata FIRST (before any early returns)
    if (thread?.metadata) {
      const meta = thread.metadata;

      console.log('[ChatPane] Thread metadata:', JSON.stringify(meta, null, 2));

      // Use modelAccessName (full versioned name) for the chat API
      modelName = (meta.modelAccessName as string) ?? '';
      modelUrl = (meta.url as string) ?? '';
      modelProvider = (meta.provider as string) ?? '';

      console.log('[ChatPane] Extracted values:', { modelName, modelUrl, modelProvider });

      // Track loaded threads
      if (thread.id && !threadLoadedIds.has(thread.id)) {
        threadLoadedIds.add(thread.id);
      }
    } else {
      // Reset to empty if no metadata
      modelName = '';
      modelUrl = '';
      modelProvider = '';
    }

    // Now handle currentThread sync (after model extraction)
    // If thread ID changed, always update
    if (threadIdChanged) {
      currentThread = thread;
      // Clear error state when switching threads to prevent stale errors
      error = '';
      // Clear file write events when switching threads
      fileWriteEventService.clear();
      fileWriteEventsByMessageId = {};
      // Reset branch selection when switching threads
      activeBranchIndex = null;
      selectedBranchContextMessageId = null;
      _branchSelectionTime = null;
      hiddenForkPoints = new Set();
      // Reset streaming state to prevent disabled send button
      showStreamingIndicator = false;
      isStreaming = false;
      responseText = '';
      return;
    }

    // Same thread - only update if metadata actually changed (to avoid loops)
    if (thread && currentThread && thread.id === currentThread.id) {
      const currentSelectedIds = currentThread.metadata?.selectedBranchIds;
      const propSelectedIds = thread.metadata?.selectedBranchIds;

      // Check if selectedBranchIds actually changed
      const currentIdsStr = JSON.stringify(Array.isArray(currentSelectedIds) ? currentSelectedIds.sort() : []);
      const propIdsStr = JSON.stringify(Array.isArray(propSelectedIds) ? propSelectedIds.sort() : []);

      // Only update if selectedBranchIds changed or if we need to preserve currentThread's selection
      if (currentIdsStr !== propIdsStr) {
        if (Array.isArray(currentSelectedIds) && currentSelectedIds.length > 0 && (!Array.isArray(propSelectedIds) || propSelectedIds.length === 0)) {
          // Preserve currentThread's selectedBranchIds if prop doesn't have it
          currentThread = {
            ...thread,
            metadata: {
              ...thread.metadata,
              selectedBranchIds: currentSelectedIds
            }
          };
        } else if (Array.isArray(propSelectedIds) && propSelectedIds.length > 0) {
          // Use prop's selectedBranchIds (from backend update)
          currentThread = { ...thread, metadata: { ...thread.metadata } };
        } else {
          // Both empty or both missing - just sync other metadata
          currentThread = { ...thread, metadata: { ...thread.metadata } };
        }
      }
      // If selectedBranchIds are the same, don't update currentThread to avoid triggering other effects
    } else {
      currentThread = thread;
    }
  });

  // Track which threads have had their initial prompt auto-sent
  let autoSentThreadIds = $state(new Set<string>());

  // Auto-send initial prompt for threads created with initialPrompt metadata
  // This is the ONLY place that checks for and uses the initialPrompt metadata flag
  $effect(() => {
    console.log('[ChatPane Auto-send] Effect triggered:', {
      currentThread: currentThread,
      hasThread: !!currentThread,
      threadId: currentThread?.id,
      chatServiceCreated,
      isStreaming,
      messagesLength: messages.length,
      hasInitialPrompt: !!currentThread?.metadata?.initialPrompt,
      alreadySent: currentThread ? autoSentThreadIds.has(currentThread.id) : false,
    });

    // Guards: Skip if no thread, chat service not ready, or already streaming
    if (!currentThread || !chatServiceCreated || isStreaming) {
      console.log('[ChatPane Auto-send] Skipping: basic guards failed');
      return;
    }

    // Guard: Skip if we've already auto-sent for this thread
    if (autoSentThreadIds.has(currentThread.id)) {
      console.log('[ChatPane Auto-send] Skipping: already sent for this thread');
      return;
    }

    // Guard: Only auto-send if thread has initialPrompt flag in metadata
    const hasInitialPrompt = currentThread.metadata?.initialPrompt;
    if (!hasInitialPrompt) {
      console.log('[ChatPane Auto-send] Skipping: no initialPrompt flag in metadata');
      return;
    }

    // Guard: Only auto-send if there's exactly 1 message and it's a user message
    if (messages.length !== 1) {
      console.log('[ChatPane Auto-send] Skipping: messages.length =', messages.length, '(expected 1)');
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      console.log('[ChatPane Auto-send] Skipping: last message role =', lastMessage.role, '(expected user)');
      return;
    }

    // Guard: Check if thread has any assistant responses (means it's already been processed)
    // This handles the case where deduplication removes tool-loop messages but assistant replied
    const hasAssistantResponse = messages.some((m: Message) => m.role === 'assistant');
    if (hasAssistantResponse) {
      console.log('[ChatPane Auto-send] Skipping: thread already has assistant response');
      return;
    }

    console.log('[ChatPane Auto-send] All guards passed! Auto-sending for thread:', currentThread.id);

    // Mark this thread as having been auto-sent
    autoSentThreadIds.add(currentThread.id);

    // Send the existing user message to the LLM (skip creating a new user message)
    setTimeout(() => {
      console.log('[ChatPane Auto-send] Calling sendMessage with:', lastMessage.content.substring(0, 50));
      void sendMessage(lastMessage.content, [], true); // true = skipUserMessageCreation
    }, 100);
  });

  // State management
  let chatServiceCreated = $state(false);
  let responseText = $state('');
  let isStreaming = $state(false);
  let showStreamingIndicator = $state(false); // Separate state for "Streaming... ●" text display

  // Log streaming state changes for debugging
  $effect(() => {
    // Explicitly read all three state variables to ensure tracking
    const indicator = showStreamingIndicator;
    const textLength = responseText.length;
    const branchIdx = streamingBranchIndex;
    
    console.log('[ChatPane Streaming States]', {
      showStreamingIndicator: indicator,
      responseTextLength: textLength,
      responseTextPreview: responseText ? `${responseText.substring(0, 50)}...` : '(empty)',
      streamingBranchIndex: branchIdx,
    });
  });
  let error = $state('');
  let isOnline = $state(true);
  let toast = $state('');
  let toastTimeout: number | null = null;
  let showMoveModal = $state(false);
  let showVersionsFor = $state<{ messageId: string; content: string } | undefined>(undefined);
  let showComments = $state(false);
  let toolStatusMessage = $state<string | null>(null); // For tool status balloon
  const dispatch = createEventDispatcher<{ threadCreated: { thread: Thread; tempId?: string } }>();

  // Branching state
  let showVariationModalFor = $state<Message | null>(null);
  let variationError = $state('');
  let isCreatingVariation = $state(false);
  let activeBranchIndex = $state<number | null>(null);
  // Track which fork points have their branches hidden (keyed by forkBranchId)
  let hiddenForkPoints = $state<Set<string>>(new Set());
  let showBranchControls = $state(false); // Toggle visibility of branch indicator and switcher
  let streamingBranchIndex = $state<string | null>(null); // Track which branch is currently streaming (by branchId)
  let selectedBranchContextMessageId = $state<string | null>(null); // Track the last message in the selected branch for context
  // Track streaming text per branchId for parallel variations
  let streamingTextByBranch = $state<Map<string, string>>(new Map());
  // Track the branch we're currently sending from (doesn't affect visual selection)
  let sendingBranchIndex = $state<number | null>(null);
  let sendingBranchContextMessageId = $state<string | null>(null);
  // Track when a branch was selected to exclude messages sent from main input after selection
  let _branchSelectionTime = $state<number | null>(null);

  async function setActiveBranch(branchIndex: number) {
    if (!currentThread) return;
    
    activeBranchIndex = branchIndex;
    
    // Find the branch box and get its branchId
    const branchBox = branchBoxes.find(b => b.branchIndex === branchIndex);
    if (!branchBox) {
      selectedBranchContextMessageId = null;
      _branchSelectionTime = null;
      return;
    }
    
    // Find which fork point this branch belongs to and hide branches for that fork point
    const normalizedBoxId = normalizeBranchId(branchBox.userMessage.branchId);
    const baseForkBranchId = normalizedBoxId.split('.')[0] + '.0.0';
    hiddenForkPoints = new Set(hiddenForkPoints);
    hiddenForkPoints.add(baseForkBranchId);
    
    // Update thread's currentBranchId via API
    const result = await threadService.switchBranch(currentThread.id, branchBox.userMessage.branchId);
    if (result.success) {
      // Update local thread state - ensure reactivity by creating new object
      currentThread = { ...result.thread, metadata: { ...result.thread.metadata } };
      console.log('[ChatPane] Branch selected, updated currentThread:', {
        selectedBranchIds: currentThread.metadata?.selectedBranchIds,
        currentBranchId: currentThread.currentBranchId
      });
      showToast(`Switched to branch: ${branchBox.userMessage.branchId}`);
    } else {
      showToast(`Failed to switch branch: ${result.error}`);
    }
    
    // Get all messages in this branch using branchId
    const branchMessages = getBranchMessages(messages, branchBox.userMessage.branchId);
    const lastMessage = branchMessages[branchMessages.length - 1] ?? branchBox.userMessage;
    
    if (lastMessage) {
      selectedBranchContextMessageId = lastMessage.id;
      // Store the timestamp of the last message in the branch when selected
      // Messages sent after this (from main input) should appear in main area, not branch box
      _branchSelectionTime = lastMessage.createdAt;
    } else if (branchBox.assistantMessage) {
      selectedBranchContextMessageId = branchBox.assistantMessage.id;
      _branchSelectionTime = branchBox.assistantMessage.createdAt;
    } else if (branchBox.userMessage) {
      selectedBranchContextMessageId = branchBox.userMessage.id;
      _branchSelectionTime = branchBox.userMessage.createdAt;
    } else {
      selectedBranchContextMessageId = null;
      _branchSelectionTime = null;
    }
    
    // Store the current time when branch is selected
    // Messages created after this time should not be hidden (allows new messages to be visible)
    _branchSelectionTime = Date.now();
  }

  // Handler for sending messages within a specific branch
  // This allows users to continue chatting in a branch without making it the active branch
  async function sendMessageInBranch(message: string, branchIndex: number) {
    // Find the branch box to get branch info
    const branchBox = branchBoxes.find(b => b.branchIndex === branchIndex);
    if (!branchBox) {
      console.error('[ChatPane] Branch box not found for branchIndex:', branchIndex);
      return;
    }

    // Get all messages in this branch using branchId
    const branchMessages = getBranchMessages(messages, branchBox.userMessage.branchId);
    const lastMessageInBranch = branchMessages[branchMessages.length - 1] ?? branchBox.userMessage;

    // Set sending branch context (doesn't affect visual selection)
    sendingBranchIndex = branchIndex;
    sendingBranchContextMessageId = lastMessageInBranch?.id ?? null;
    
    try {
      // Call sendMessage which will use the sending branch context
      await sendMessage(message);
    } finally {
      // Clear sending branch context after sending
      sendingBranchIndex = null;
      sendingBranchContextMessageId = null;
    }
  }

  function toggleBranches(forkBranchId: string) {
    const normalizedForkId = normalizeBranchId(forkBranchId);
    hiddenForkPoints = new Set(hiddenForkPoints);
    if (hiddenForkPoints.has(normalizedForkId) || hiddenForkPoints.has(forkBranchId)) {
      // Remove both normalized and original format if present
      hiddenForkPoints.delete(normalizedForkId);
      hiddenForkPoints.delete(forkBranchId);
    } else {
      hiddenForkPoints.add(normalizedForkId);
    }
  }
  
  function isForkPointHidden(forkBranchId: string): boolean {
    const normalizedForkId = normalizeBranchId(forkBranchId);
    return hiddenForkPoints.has(normalizedForkId) || hiddenForkPoints.has(forkBranchId);
  }
  
  function isBranchInHiddenForkPoint(branchIndex: number): boolean {
    const branchBox = branchBoxes.find(b => b.branchIndex === branchIndex);
    if (!branchBox) return false;
    const normalizedBoxId = normalizeBranchId(branchBox.userMessage.branchId);
    const baseForkBranchId = normalizedBoxId.split('.')[0] + '.0.0';
    return hiddenForkPoints.has(baseForkBranchId);
  }
  
  // Check if a branch is selected based on selectedBranchIds in metadata
  function isBranchSelected(branchIndex: number): boolean {
    const branchBox = branchBoxes.find(b => b.branchIndex === branchIndex);
    if (!branchBox) return false;
    
    const selectedBranchIds = currentThread?.metadata?.selectedBranchIds;
    if (!Array.isArray(selectedBranchIds) || selectedBranchIds.length === 0) {
      // Fallback to activeBranchIndex if no selectedBranchIds
      return activeBranchIndex === branchIndex;
    }
    
    const boxBranchId = branchBox.userMessage.branchId;
    const normalizedBoxId = normalizeBranchId(boxBranchId);
    
    // Check if this branch is in the selectedBranchIds array
    return selectedBranchIds.some(selectedId => {
      const normalizedSelectedId = normalizeBranchId(selectedId);
      return normalizedBoxId === normalizedSelectedId || 
             normalizedSelectedId.startsWith(normalizedBoxId + '.') ||
             boxBranchId === selectedId ||
             selectedId.startsWith(boxBranchId + '.');
    });
  }

  // Update selected branch context when new assistant messages are added to the selected branch
  $effect(() => {
    if (activeBranchIndex !== null) {
      // Find the latest assistant message for the selected branch
      const selectedBox = branchBoxes.find(b => b.branchIndex === activeBranchIndex);
      const latestAssistant = selectedBox 
        ? messages
            .filter(m => m.role === 'assistant' && m.branchId === selectedBox.userMessage.branchId)
            .sort((a, b) => b.createdAt - a.createdAt)[0]
        : undefined;
      
      if (latestAssistant && latestAssistant.id !== selectedBranchContextMessageId) {
        selectedBranchContextMessageId = latestAssistant.id;
      }
    }
  });

  // First fork point: any USER message that has variations (based on branchId)
  const firstForkPointId = $derived.by(() => {
    // Find the earliest user message that has variation children
    const forkPointBranchIds = getForkPoints(messages);
    
    if (forkPointBranchIds.length === 0) return null;
    
    // Find the earliest fork point message by finding the first user message with each fork branchId
    // Note: forkPointBranchIds are in format "1.0" (2 parts), but messages may have "1.0.0" (3 parts)
    // So we need to match messages that start with the fork branchId
    const forkPointMessages = forkPointBranchIds
      .map(branchId => messages.find(m => {
        const normalizedMsgId = normalizeBranchId(m.branchId);
        const normalizedForkId = normalizeBranchId(branchId);
        return normalizedMsgId === normalizedForkId && m.role === 'user';
      }))
      .filter((m): m is Message => m !== undefined);
    
    if (forkPointMessages.length === 0) return null;
    
    // Return the earliest fork point (by createdAt)
    return forkPointMessages.sort((a, b) => a.createdAt - b.createdAt)[0]?.id ?? null;
  });

  // Helper function to get all messages in a branch using branchId
  function _getAllMessagesInBranch(branchId: string): Message[] {
    return getBranchMessages(messages, branchId);
  }

  // Build branch boxes grouped by fork point for rendering at their respective positions
  const branchBoxesByForkPoint = $derived.by(() => {
    const forkPointBranchIds = getForkPoints(messages);
    if (forkPointBranchIds.length === 0) return new Map<string, Array<{
      branchIndex: number;
      userMessage: Message;
      assistantMessage: Message | null;
      allMessages: Message[];
    }>>();
    
    const boxesByFork = new Map<string, Array<{
      branchIndex: number;
      userMessage: Message;
      assistantMessage: Message | null;
      allMessages: Message[];
    }>>();
    
    let globalBranchIndex = 0;
    
    // Process each fork point
    for (const forkBranchId of forkPointBranchIds) {
      const normalizedForkId = normalizeBranchId(forkBranchId);
      const parent = messages.find((m) => {
        const normalizedMsgId = normalizeBranchId(m.branchId);
        return normalizedMsgId === normalizedForkId && m.role === 'user';
      });
      if (!parent) continue;

    // Get the base branchId for variations (e.g., "1.0.0" -> "1.0")
    // getVariationsForBranch expects 2-part format like "1.0"
    const parentBranchIdParts = parent.branchId.split('.');
    const baseBranchId = parentBranchIdParts.length >= 2 
      ? `${parentBranchIdParts[0]}.${parentBranchIdParts[1]}` 
      : parent.branchId;

    // Get all variations of this branch using base branchId
    const variationChildren = getVariationsForBranch(messages, baseBranchId);
    
    // Include the parent (original branch) and all variations
    const userBranches = [parent, ...variationChildren];

      const forkBoxes = userBranches.map((userMsg, index) => {
      // For the original branch, get all messages AFTER the fork point with the original branchId
      // For variations, get ONLY messages in that specific variation branchId (not parent hierarchy)
      let allBranchMessages: Message[];
      
      if (index === 0) {
        // Original branch - get all messages in this branch hierarchy
        // For branch "2.0", include messages with branchIds: "2.0", "2.0.1", "2.0.2", etc.
        // But exclude variation branches (e.g., "2.1.0", "2.2.0") and their continuations (e.g., "2.1.1")
        const normalizedParentId = normalizeBranchId(parent.branchId);
        const baseParts = normalizedParentId.split('.');
        const baseNum = baseParts[0]; // e.g., "2" from "2.0.0"
        const baseBranchId = `${baseNum}.0.0`; // e.g., "2.0.0"
        
        const seenIds = new Set<string>();
        allBranchMessages = messages
          .filter(m => {
            // Deduplicate by message ID
            if (seenIds.has(m.id)) {
              return false;
            }
            seenIds.add(m.id);
            
            const normalizedMsgId = normalizeBranchId(m.branchId);
            // Include messages with the exact base branchId (e.g., "2.0.0")
            if (normalizedMsgId === baseBranchId) {
              return true;
            }
            
            // Include continuation messages (e.g., "2.0.1", "2.0.2")
            // These are messages that start with "baseNum.0." and have 3+ parts
            if (normalizedMsgId.startsWith(`${baseNum}.0.`)) {
              return true;
            }
            
            return false;
          })
          .sort((a, b) => a.createdAt - b.createdAt);
      } else {
        // Variation branch - get all messages in this variation branch hierarchy
        // For variation "2.1.0", include messages with branchIds: "2.1.0", "2.1.1", "2.1.2", etc.
        // But exclude parent branch messages (e.g., "2.0") and other variations (e.g., "2.2.0")
        const normalizedVariationId = normalizeBranchId(userMsg.branchId);
        const variationParts = normalizedVariationId.split('.');
        const variationPrefix = variationParts.slice(0, 2).join('.'); // e.g., "2.1" from "2.1.0"
        const parentBranchId = `${variationParts[0]}.0.0`; // e.g., "2.0.0"
        
        const seenIds = new Set<string>();
        allBranchMessages = messages
          .filter(m => {
            // Deduplicate by message ID
            if (seenIds.has(m.id)) {
              return false;
            }
            seenIds.add(m.id);
            
            const normalizedMsgId = normalizeBranchId(m.branchId);
            // Exclude parent branch messages
            if (normalizedMsgId === parentBranchId) {
              return false;
            }
            
            // Include messages that start with the variation prefix (e.g., "2.1.0", "2.1.1", "2.1.2")
            // This includes the variation root and all continuations
            if (normalizedMsgId.startsWith(`${variationPrefix}.`)) {
              return true;
            }
            
            // Also include exact match for the variation root
            if (normalizedMsgId === normalizedVariationId) {
              return true;
            }
            
            return false;
          })
          .sort((a, b) => a.createdAt - b.createdAt);
      }
      
      // Separate user and assistant messages for display
      const assistantMessages = allBranchMessages.filter(m => m.role === 'assistant');

      return {
          branchIndex: globalBranchIndex++, // Global index across all fork points
        userMessage: userMsg,
        assistantMessage: assistantMessages[assistantMessages.length - 1] ?? null,
        allMessages: allBranchMessages,
      };
    });
      
      boxesByFork.set(normalizedForkId, forkBoxes);
    }
    
    return boxesByFork;
  });

  // Flatten branch boxes for backward compatibility with existing code
  const branchBoxes = $derived.by(() => {
    const allBoxes: Array<{
      branchIndex: number;
      userMessage: Message;
      assistantMessage: Message | null;
      allMessages: Message[];
    }> = [];
    for (const boxes of branchBoxesByForkPoint.values()) {
      allBoxes.push(...boxes);
    }
    return allBoxes;
  });

  // Create timeline with messages and branch boxes at their respective positions
  type TimelineItem = 
    | { type: 'message'; message: Message }
    | { type: 'branchBoxes'; forkBranchId: string; boxes: Array<{
        branchIndex: number;
        userMessage: Message;
        assistantMessage: Message | null;
        allMessages: Message[];
      }> };

  const timeline = $derived.by(() => {
    const items: TimelineItem[] = [];
    const forkPointBranchIds = getForkPoints(messages);
    const forkPointMessages = forkPointBranchIds
      .map(branchId => {
        const normalizedForkId = normalizeBranchId(branchId);
        return messages.find(m => {
          const normalizedMsgId = normalizeBranchId(m.branchId);
          return normalizedMsgId === normalizedForkId && m.role === 'user';
        });
      })
      .filter((m): m is Message => m !== undefined)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    // Create a map from message to normalized fork branchId for lookup
    const messageToForkId = new Map<Message, string>();
    for (let i = 0; i < forkPointMessages.length; i++) {
      const msg = forkPointMessages[i];
      const normalizedForkId = normalizeBranchId(forkPointBranchIds[i]);
      messageToForkId.set(msg, normalizedForkId);
    }
    
    // Get all non-excluded messages sorted by creation time
    // Filter out duplicate user prompts within 30 seconds
    const sortedMessages = messages
      .filter(m => !excludedMessageIds.has(m.id))
      .sort((a, b) => a.createdAt - b.createdAt);

    const allNonExcludedMessages = sortedMessages.filter((msg, index) => {
      // Keep all assistant messages
      if (msg.role !== 'user') return true;

      // Keep first message
      if (index === 0) return true;

      // Find the previous user message
      let prevUserMessage: Message | undefined;
      for (let i = index - 1; i >= 0; i--) {
        if (sortedMessages[i].role === 'user') {
          prevUserMessage = sortedMessages[i];
          break;
        }
      }

      // Keep if no previous user message found
      if (!prevUserMessage) return true;

      // Check if duplicate: same content and within 30 seconds
      const isSameContent = msg.content.trim() === prevUserMessage.content.trim();
      const timeDiff = msg.createdAt - prevUserMessage.createdAt;
      const isWithin30Seconds = timeDiff <= 30000;

      // Filter out (return false) if it's a duplicate
      if (isSameContent && isWithin30Seconds) {
        console.log('[ChatPane] Filtering duplicate user message:', {
          messageId: msg.id,
          content: msg.content.substring(0, 50),
          timeDiff,
        });
        return false;
      }

      return true;
    });
    
    let messageIndex = 0;
    let forkIndex = 0;
    
    // Interleave messages and branch boxes
    while (messageIndex < allNonExcludedMessages.length || forkIndex < forkPointMessages.length) {
      const currentMessage = allNonExcludedMessages[messageIndex];
      const currentFork = forkPointMessages[forkIndex];
      
      // If we have a fork point before the next message, add branch boxes
      if (currentFork && (!currentMessage || currentFork.createdAt <= currentMessage.createdAt)) {
        const forkBranchId = messageToForkId.get(currentFork) || normalizeBranchId(currentFork.branchId);
        const boxes = branchBoxesByForkPoint.get(forkBranchId);
        if (boxes && boxes.length > 0) {
          items.push({ type: 'branchBoxes', forkBranchId, boxes });
        }
        forkIndex++;
      } else if (currentMessage) {
        // Add message
        items.push({ type: 'message', message: currentMessage });
        messageIndex++;
      } else {
        break;
      }
    }
    
    return items;
  });

  // Get all message IDs that should be excluded from normal display (all messages in branches)
  const excludedMessageIds = $derived.by(() => {
    const excluded = new Set<string>();
    
    // Check if a branch is selected (persisted in metadata, survives refresh)
    const selectedBranchIds = currentThread?.metadata?.selectedBranchIds;
    const hasSelectedBranch = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0;
    
    // Exclude messages that come after fork points in the original branch
    // When a variation is created from a middle message, messages after should be hidden
    // If a branch is selected, only hide messages that existed before the variation was created
    // This allows new messages created after branch selection to be visible (even after refresh)
    const messagesToHideAfterFork = getMessagesToHideAfterForkPoint(messages, hasSelectedBranch);
    for (const msgId of messagesToHideAfterFork) {
      excluded.add(msgId);
    }
    
    if (branchBoxes.length === 0) return excluded;
    
    // Always exclude all messages from all branch boxes to prevent them from appearing in main area
    // Branch messages should only appear inside BranchLane components
      for (const box of branchBoxes) {
      // Exclude all messages in this branch box
        for (const msg of box.allMessages) {
          excluded.add(msg.id);
        }
      
      // Also exclude any messages with branchIds matching this branch hierarchy (safety check)
        const branchId = box.userMessage.branchId;
        for (const msg of messages) {
        // Check if message belongs to this branch (exact match or continuation)
          if (msg.branchId === branchId || msg.branchId.startsWith(branchId + '.')) {
          excluded.add(msg.id);
        }
      }
    }
    
    return excluded;
  });

  // Track if we've created variations in this session to prevent auto-selection
  let hasCreatedVariations = $state(false);
  // Track if we should allow auto-selection (only on initial load, not after variations)
  let allowAutoSelection = $state(true);
  // Track if we've already restored branch selection for this thread
  let restoredBranchSelectionForThread = $state<string | null>(null);
  
  // Initialize activeBranchIndex from thread's currentBranchId when thread/branches load
  // Restore selected branch state from metadata
  $effect(() => {
    const threadId = currentThread?.id;
    if (!threadId) return;
    
    // Only restore selection once per thread, and only if we haven't manually created variations
    if (hasCreatedVariations) return;
    if (restoredBranchSelectionForThread === threadId) return;
    
    // Wait for branchBoxes to be ready
    if (branchBoxes.length === 0) return;
    
    // Check if there are selected branches in metadata
    const selectedBranchIds = currentThread?.metadata?.selectedBranchIds;
    if (Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0) {
      // Get currentBranchId to prioritize it
      const currentBranchId = currentThread?.currentBranchId || currentThread?.metadata?.currentBranchId;
      const normalizedCurrentId = (typeof currentBranchId === 'string' && currentBranchId) 
        ? normalizeBranchId(currentBranchId) 
        : null;
      
      // Find all matching branch boxes
      type BranchBox = typeof branchBoxes[0];
      const matchingBoxes: Array<{ box: BranchBox; selectedId: string }> = [];
      
      for (const selectedBranchId of selectedBranchIds) {
        if (typeof selectedBranchId !== 'string') continue;
        const normalizedSelectedId = normalizeBranchId(selectedBranchId);
        
        // Find branch box that matches this selected branch
        const matchingBox = branchBoxes.find(box => {
          const boxBranchId = box.userMessage.branchId;
          const normalizedBoxId = normalizeBranchId(boxBranchId);
          // Check exact match (normalized)
          if (normalizedBoxId === normalizedSelectedId) {
            return true;
          }
          // Check if selected branch is a continuation of box branch
          if (normalizedSelectedId.startsWith(normalizedBoxId + '.')) {
            return true;
          }
          // Also check original formats (for backward compatibility)
          if (boxBranchId === selectedBranchId || selectedBranchId.startsWith(boxBranchId + '.')) {
            return true;
          }
          return false;
        });
        
        if (matchingBox) {
          matchingBoxes.push({ box: matchingBox, selectedId: selectedBranchId });
        }
      }
      
      // Prioritize branch that matches currentBranchId, otherwise use the last match
      if (matchingBoxes.length > 0) {
        let selectedBox = matchingBoxes[0].box;
        
        if (normalizedCurrentId) {
          // Try to find a box that matches currentBranchId
          const currentMatch = matchingBoxes.find(({ box }) => {
            const normalizedBoxId = normalizeBranchId(box.userMessage.branchId);
            return normalizedBoxId === normalizedCurrentId || normalizedCurrentId.startsWith(normalizedBoxId + '.');
          });
          if (currentMatch) {
            selectedBox = currentMatch.box;
          } else {
            // Use the last matching box (most recent selection)
            selectedBox = matchingBoxes[matchingBoxes.length - 1].box;
          }
        } else {
          // Use the last matching box (most recent selection)
          selectedBox = matchingBoxes[matchingBoxes.length - 1].box;
        }
        
        activeBranchIndex = selectedBox.branchIndex;
        // Hide branches for this fork point (normalize to x.x.x format)
        const normalizedBoxId = normalizeBranchId(selectedBox.userMessage.branchId);
        const baseForkBranchId = normalizedBoxId.split('.')[0] + '.0.0';
        hiddenForkPoints = new Set(hiddenForkPoints);
        hiddenForkPoints.add(baseForkBranchId);
        // Set branchSelectionTime so that messages after fork point are handled correctly
        // Use current time so new messages won't be hidden
        _branchSelectionTime = Date.now();
        restoredBranchSelectionForThread = threadId;
        return;
      }
    }
    
    // Fallback: use currentBranchId if no selectedBranchIds
    if (activeBranchIndex === null && !hasCreatedVariations && !allowAutoSelection) {
      // Don't auto-select if we've disabled auto-selection
      restoredBranchSelectionForThread = threadId;
      return;
    }
    
    // Legacy: auto-select single branch if no variations exist
    if (branchBoxes.length === 1 && activeBranchIndex === null && allowAutoSelection) {
    const threadBranchIdRaw = currentThread?.metadata?.currentBranchId ?? currentThread?.currentBranchId;
    const threadBranchId = typeof threadBranchIdRaw === 'string' ? threadBranchIdRaw : undefined;
      if (threadBranchId) {
      const branchParts = threadBranchId.split('.');
      const isVariationBranch = branchParts.length === 3 && branchParts[2] === '0';
        if (!isVariationBranch) {
      const matchingBox = branchBoxes.find(box => {
        const boxBranchId = box.userMessage.branchId;
            return boxBranchId === threadBranchId || threadBranchId.startsWith(boxBranchId + '.');
      });
      
      if (matchingBox) {
        activeBranchIndex = matchingBox.branchIndex;
            // Hide branches for this fork point
            const baseForkBranchId = matchingBox.userMessage.branchId.split('.')[0] + '.0';
            hiddenForkPoints = new Set(hiddenForkPoints);
            hiddenForkPoints.add(baseForkBranchId);
            restoredBranchSelectionForThread = threadId;
          }
        }
      }
    }
    
    // Mark as restored even if we didn't find a match
    restoredBranchSelectionForThread = threadId;
  });

  // Determine if the main input should be disabled
  // Disable when branches exist but none are selected (prevents creating normal messages)
  // Enable when: no branches exist, OR all fork points have at least one selected branch
  const isMainInputDisabled = $derived.by(() => {
    // Check fork points directly to debug
    const forkPoints = getForkPoints(messages);
    console.log('[ChatPane] isMainInputDisabled check:', {
      messagesCount: messages.length,
      forkPoints,
      branchBoxesCount: branchBoxes.length,
      branchBoxes: branchBoxes.map(b => b.userMessage.branchId),
      messageBranchIds: messages.map(m => ({ id: m.id, branchId: m.branchId, role: m.role }))
    });
    
    // No branches = don't disable (normal flow)
    if (branchBoxes.length === 0) {
      console.log('[ChatPane] isMainInputDisabled: false (no branches detected)');
      return false;
    }
    
    // Branches exist - check if ALL fork points have at least one selected branch
    const selectedBranchIds = currentThread?.metadata?.selectedBranchIds;
    const hasSelectedBranches = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0;
    
    if (!hasSelectedBranches) {
      console.log('[ChatPane] isMainInputDisabled: true (branches exist but none selected)');
      return true; // Disable: branches exist but none selected
    }
    
    // Check if each fork point has at least one selected branch
    // Get all fork points and their row numbers
    const forkPointRows = new Set<number>();
    for (const forkPointId of forkPoints) {
      const normalizedForkId = normalizeBranchId(forkPointId);
      const rowNum = getRowNumber(normalizedForkId);
      forkPointRows.add(rowNum);
    }
    
    // Build a map of row number -> selected branch ID
    const selectedBranchByRow = new Map<number, string>();
    for (const branchId of selectedBranchIds) {
      const normalizedId = normalizeBranchId(branchId);
      const rowNum = getRowNumber(normalizedId);
      selectedBranchByRow.set(rowNum, normalizedId);
    }
    
    // Check if every fork point row has a selected branch
    let allForkPointsHaveSelection = true;
    for (const rowNum of forkPointRows) {
      if (!selectedBranchByRow.has(rowNum)) {
        allForkPointsHaveSelection = false;
        break;
      }
    }
    
    // Debug logging
    console.log('[ChatPane] isMainInputDisabled check (branches exist):', {
      branchBoxesCount: branchBoxes.length,
      forkPoints,
      forkPointRows: Array.from(forkPointRows),
      selectedBranchIds,
      selectedBranchByRow: Object.fromEntries(selectedBranchByRow),
      allForkPointsHaveSelection,
      willDisable: !allForkPointsHaveSelection,
      currentThreadId: currentThread?.id,
    });
    
    // If any fork point doesn't have a selected branch, disable
    if (!allForkPointsHaveSelection) {
      console.log('[ChatPane] isMainInputDisabled: true (not all fork points have selected branches)');
      return true; // Disable: not all fork points have selected branches
    }
    
    // All fork points have selected branches, allow normal messages
    console.log('[ChatPane] isMainInputDisabled: false (all fork points have selected branches)', { selectedBranchIds });
    return false;
  });

  // Split messages into before and after fork point
  const _messagesBeforeFork = $derived.by(() => {
    if (!firstForkPointId) {
      // No fork point, show all non-excluded messages
      return messages.filter((m) => !excludedMessageIds.has(m.id));
    }
    const forkPointIndex = messages.findIndex((m) => m.id === firstForkPointId);
    if (forkPointIndex < 0) return messages.filter((m) => !excludedMessageIds.has(m.id));
    return messages.slice(0, forkPointIndex).filter((m) => !excludedMessageIds.has(m.id));
  });

  const _messagesAfterFork = $derived.by(() => {
    if (!firstForkPointId) return [];
    const forkPointIndex = messages.findIndex((m) => m.id === firstForkPointId);
    if (forkPointIndex < 0) return [];
    return messages.slice(forkPointIndex + 1).filter((m) => !excludedMessageIds.has(m.id));
  });


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

  const fileWriteEventService = new FileWriteEventService();
  let fileWriteEventsByMessageId = $state<Record<string, FileWriteEvent[]>>({});

  function eventsChanged(
    current: Record<string, FileWriteEvent[]>,
    next: Record<string, FileWriteEvent[]>,
  ): boolean {
    const currentKeys = Object.keys(current);
    const nextKeys = Object.keys(next);
    if (currentKeys.length !== nextKeys.length) return true;
    for (const key of currentKeys) {
      const currList = current[key] ?? [];
      const nextList = next[key] ?? [];
      if (currList.length !== nextList.length) return true;
      for (let i = 0; i < currList.length; i += 1) {
        const c = currList[i];
        const n = nextList[i];
        if (
          c.id !== n.id ||
          c.status !== n.status ||
          c.filePath !== n.filePath ||
          c.success !== n.success ||
          c.error !== n.error ||
          c.bytesWritten !== n.bytesWritten ||
          c.previousSizeBytes !== n.previousSizeBytes
        ) {
          return true;
        }
      }
    }
    return false;
  }

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
    console.log(
      `[ChatPane] Initializing chat provider: ${config.provider} with model ${config.model} at ${config.url}`,
    );

    if (!currentThread?.id) {
      console.error('[ChatPane] Cannot initialize chat service: thread ID is missing');
      error = 'Thread ID is required';
      return false;
    }

    const threadId = currentThread.id;
    const workingDirectory = currentThread.metadata?.workingDirectory as string | undefined;

    const result = await window.electronAPI.chat.createProvider(
      threadId,
      config.provider,
      {
        url: config.url,
        model: config.model,
      },
      workingDirectory
    );

    if (!result.success) {
      error = result.error || 'Failed to initialize chat service';
      console.error('[ChatPane] Failed to create chat provider:', result.error);
      return false;
    }

    chatServiceCreated = true;
    currentProviderConfig = config;
    return true;
  }

  function showToast(message: string, ms = 2500) {
    toast = message;
    if (toastTimeout) window.clearTimeout(toastTimeout);
    // @ts-ignore - window.setTimeout returns number in browser
    toastTimeout = window.setTimeout(() => (toast = ''), ms);
  }

  function scrollToBottom(behavior: 'auto' | 'instant' | 'smooth' = 'auto') {
    if (!messagesContainer) return;
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior,
    });
  }

  // Setup token listener for streaming responses
  function setupTokenListener() {
    responseText = ''; // Clear previous response
    showStreamingIndicator = true; // Show streaming indicator
    console.log('[ChatPane setupTokenListener] Cleared responseText and setting up listener');

    // Remove any existing token listeners to prevent duplicates
    window.electronAPI.chat.offToken();

    window.electronAPI.chat.onToken((data: { threadId: string; token: string }) => {
      // Only process tokens for the current thread
      if (data.threadId !== currentThread?.id) {
        return;
      }

      const token = data.token;
      console.log('[ChatPane onToken] Received token:', token.substring(0, 50), '(length:', token.length, ')');

      // First token received – clear the no-response timeout
      if (streamingNoResponseTimeout) {
        clearTimeout(streamingNoResponseTimeout);
        streamingNoResponseTimeout = null;
      }
      // Track last token time and (re)start idle timeout
      streamingLastTokenAt = Date.now();
      if (streamingIdleTimeout) clearTimeout(streamingIdleTimeout);
      streamingIdleTimeout = setTimeout(() => {
        if (isStreaming && Date.now() - streamingLastTokenAt >= STREAMING_IDLE_TIMEOUT_MS) {
          console.error('[ChatPane] Streaming idle timeout: no tokens for 60s');
          window.electronAPI.chat.offToken();
          showStreamingIndicator = false;
          isStreaming = false;
          showToast('No response from model. Please try again.', 4000);
        }
      }, STREAMING_IDLE_TIMEOUT_MS);
      // Force reactivity by creating a new string reference
      responseText = responseText + token;
      console.log('[ChatPane onToken] responseText now length:', responseText.length);

      // If streaming to a branch, also update branch-specific streaming text
      if (streamingBranchIndex !== null) {
        // Update the Map - create a new Map instance to trigger Svelte reactivity
        const updatedMap = new Map(streamingTextByBranch);
        updatedMap.set(streamingBranchIndex, responseText);
        streamingTextByBranch = updatedMap;
        // Don't scroll main area when streaming in branch box
        return;
      }

      // Keep streaming text in view inside messages container (only for main area streaming)
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
  async function sendMessage(userMessage: string, attachments: any[] = [], skipUserMessageCreation = false) {
    console.log('[ChatPane sendMessage] CALLED', {
      userMessage: userMessage.substring(0, 50),
      attachmentsLength: attachments.length,
      skipUserMessageCreation,
      currentThread: currentThread?.id,
    });

    if (!userMessage.trim() && attachments.length === 0) {
      console.log('[ChatPane sendMessage] RETURNING EARLY - empty message');
      return;
    }

    // Build conversation history based on selected branch context
    let historyMessages: Array<{ role: string; content: string }>;
    
    // Use sending branch context if sending from a branch box, otherwise use active branch
    const contextBranchIndex = sendingBranchIndex !== null ? sendingBranchIndex : activeBranchIndex;
    const contextMessageId = sendingBranchContextMessageId ?? selectedBranchContextMessageId;
    
    // Check if message is sent from main input when branches are selected
    const isMainInputWithBranchesSelected = sendingBranchIndex === null && 
      currentThread?.metadata?.selectedBranchIds && 
      Array.isArray(currentThread.metadata.selectedBranchIds) &&
      currentThread.metadata.selectedBranchIds.length > 0;
    
    // When sending from a branch box, include selected branches + the sending branch
    if (sendingBranchIndex !== null) {
      const sendingBranchBox = branchBoxes.find(b => b.branchIndex === sendingBranchIndex);
      if (sendingBranchBox) {
        const sendingBranchId = sendingBranchBox.userMessage.branchId;
        const normalizedSendingId = normalizeBranchId(sendingBranchId);
        // Get selected branches from metadata and normalize them
        const selectedBranchIds = Array.isArray(currentThread?.metadata?.selectedBranchIds) 
          ? (currentThread.metadata.selectedBranchIds as string[]).map(id => normalizeBranchId(id))
          : [];
        
        // Add the sending branch if not already selected (to ensure it's included)
        const sendingBranchBaseId = normalizedSendingId.split('.').slice(0, 2).join('.') + '.0';
        if (!selectedBranchIds.includes(normalizedSendingId) && !selectedBranchIds.includes(sendingBranchBaseId)) {
          // Check if sending branch is a variation (e.g., "4.1.0") - use the base variation ID
          const parts = normalizedSendingId.split('.');
          if (parts.length === 3 && parts[2] === '0' && parts[1] !== '0') {
            // It's a variation branch, add it
            selectedBranchIds.push(normalizedSendingId);
          } else {
            // It's a continuation, find the base variation
            const baseVariationId = parts.slice(0, 2).join('.') + '.0';
            if (!selectedBranchIds.includes(baseVariationId)) {
              selectedBranchIds.push(baseVariationId);
            }
          }
        }
        
        // Use buildContextFromSelectedBranches to include selected branches + sending branch
        // Pass the sending branch ID so sequential messages after selected branches are included
        const contextMessages = buildContextFromSelectedBranches(messages, selectedBranchIds, normalizedSendingId);
        historyMessages = contextMessages.map((m) => ({ role: m.role, content: m.content }));
      } else {
        // Fallback: use assembleContext
        if (contextMessageId) {
          const contextPath = assembleContext(messages, contextMessageId);
          historyMessages = contextPath.map((m) => ({ role: m.role, content: m.content }));
        } else {
          historyMessages = messages.map((m) => ({ role: m.role, content: m.content }));
        }
      }
    } else if (isMainInputWithBranchesSelected && currentThread?.metadata?.selectedBranchIds) {
      // When sending from main input with selected branches:
      // Use buildContextFromSelectedBranches to include all selected branches and exclude non-selected ones
      // Normalize all selected branch IDs to x.x.x format
      const selectedBranchIds = (currentThread.metadata.selectedBranchIds as string[]).map(id => normalizeBranchId(id));
      const contextMessages = buildContextFromSelectedBranches(messages, selectedBranchIds);
      historyMessages = contextMessages.map((m) => ({ role: m.role, content: m.content }));
    } else if (sendingBranchIndex === null && activeBranchIndex !== null && isBranchInHiddenForkPoint(activeBranchIndex) && firstForkPointId) {
      // Fallback: When sending from main input with a branch selected and collapsed (legacy behavior):
      // Include all messages before fork point + all messages in selected branch
      const forkPointIndex = messages.findIndex((m) => m.id === firstForkPointId);
      const messagesBeforeFork = forkPointIndex >= 0 ? messages.slice(0, forkPointIndex) : [];
      
      // Get all messages in the selected branch
      const selectedBox = branchBoxes.find(b => b.branchIndex === activeBranchIndex);
      const selectedBranchMessages = selectedBox ? selectedBox.allMessages : [];
      
      // Combine: messages before fork + selected branch messages
      historyMessages = [
        ...messagesBeforeFork.map((m) => ({ role: m.role, content: m.content })),
        ...selectedBranchMessages.map((m) => ({ role: m.role, content: m.content })),
      ];
    } else if (contextBranchIndex !== null && contextMessageId && contextBranchIndex > 0) {
      // For variation branches, we need to exclude the fork point messages
      // and follow the variation path instead
      // Example: if variation "ok3" is created from "ok2", we want:
      // root -> ... -> "ok3" -> "ok3 response" (NOT including "ok2" or its response)
      
      const selectedMsg = messages.find(m => m.id === contextMessageId);
      if (!selectedMsg) {
        // Fallback to default
        historyMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      } else {
        // Find the variation user message
        // If selectedMsg is assistant, its parent is the variation user
        // If selectedMsg is user, it is the variation user
        let variationUserMsg: Message | undefined;
        if (selectedMsg.role === 'assistant') {
          // Find the user message that precedes this assistant message
        const msgIndex = messages.findIndex(m => m.id === selectedMsg.id);
        variationUserMsg = msgIndex > 0 ? messages.slice(0, msgIndex).reverse().find(m => m.role === 'user') : undefined;
        } else {
          variationUserMsg = selectedMsg;
        }
        
        if (!variationUserMsg) {
          // Fallback to default
          historyMessages = messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
        } else {
          // Build context based on branchId hierarchy
          const variationPath = assembleContext(messages, contextMessageId);
          historyMessages = variationPath.map((m) => ({
            role: m.role,
            content: m.content,
          }));
        }
      }
    } else if (contextBranchIndex === 0) {
      // For main branch (branchIndex 0), use assembleContext normally
      if (contextMessageId) {
        const contextPath = assembleContext(messages, contextMessageId);
        historyMessages = contextPath.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      } else {
        historyMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    } else {
      // Default: use all messages (main branch)
      historyMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    error = '';

    // Determine branchId for this message BEFORE creating optimistic message
    // This ensures the optimistic message has the correct branchId from the start
    let branchId: string;
    
    if (skipUserMessageCreation) {
      // Auto-send of existing message - use the existing message's branchId
      // Find the last user message (the one we're auto-sending)
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      branchId = lastUserMessage?.branchId ?? normalizeBranchId(thread?.currentBranchId ?? '1.0.0');
    } else if (sendingBranchIndex !== null) {
      // Message sent from branch lane input - continue that branch hierarchy
      const branchBox = branchBoxes.find(b => b.branchIndex === sendingBranchIndex);
      const currentBranchId = branchBox?.userMessage.branchId ?? normalizeBranchId(thread?.currentBranchId ?? '1.0.0');
      // Get the lane id to continue in this branch hierarchy
      branchId = getNextBranchIdInBranch(currentBranchId, messages);
    } else {
      // Message sent from main input (composer) - always create a new sequential branch
      // This applies even if a branch is selected, because the user is typing in the main composer
      branchId = getNextSequentialBranchId(messages);
    }
    // Hard-cap branchId to 4 segments to avoid backend 5-part IDs
    const rawBranchId = branchId;
    branchId = normalizeBranchId(branchId);
    console.log('[ChatPane] branchId computed', { rawBranchId, normalizedBranchId: branchId });

    // Determine model for the new message
    let modelId: string | null = null;

    // Use sendingBranchIndex if we're sending from a branch box, otherwise use activeBranchIndex
    const branchIndexToUse = sendingBranchIndex !== null ? sendingBranchIndex : activeBranchIndex;

    if (branchIndexToUse !== null) {
      // Get modelId from the branch's user message
      const branchBox = branchBoxes.find((b) => b.branchIndex === branchIndexToUse);
      if (branchBox) {
        modelId = branchBox.userMessage.modelId ?? null;
      }
    }

    // Only create user message if it doesn't already exist (skip for initial prompt auto-send)
    let userMsg: Message | null = null;
    if (!skipUserMessageCreation) {
      // Create and add optimistic message with the correct branchId
      userMsg = transmitter.addOptimisticMessage(userMessage, isOnline, branchId);
      userMsg.modelId = modelId;

      // Send the user message (handles outbox and persistence)
      await transmitter.sendUserMessage(userMsg, thread, isOnline);
    }

    // If offline, queue for later and don't enter streaming state
    if (!isOnline) {
      console.log('[ChatPane sendMessage] RETURNING EARLY - offline');
      if (userMsg) {
        await transmitter.sendUserMessage(
          userMsg,
          thread,
          isOnline,
          branchId,
        );
      }
      showStreamingIndicator = false;
      isStreaming = false;
      return;
    }

    console.log('[ChatPane sendMessage] Online, checking chat service initialization');

    // Resolve model/provider/url to use for this send
    let modelToUse = modelId || modelName;
    let providerToUse = modelProvider;
    let urlToUse = modelUrl;

    if (modelId) {
      try {
        const allModels = await window.electronAPI.models.listAll();
        const modelDetails = allModels.find((m) => m.accessName === modelId);
        if (modelDetails) {
          modelToUse = modelDetails.accessName;
          providerToUse = modelDetails.provider;
          urlToUse = modelDetails.url;
        }
      } catch (err) {
        console.error('[ChatPane] Failed to get model details for sendMessage:', err);
      }
    }

    // Ensure chat service is initialized for the resolved model
    const modelIsDifferent =
      modelToUse !== modelName ||
      providerToUse !== modelProvider ||
      urlToUse !== modelUrl;

    const configMatches =
      currentProviderConfig &&
      currentProviderConfig.provider === providerToUse &&
      currentProviderConfig.url === urlToUse &&
      currentProviderConfig.model === modelToUse;

    if (!chatServiceCreated || (modelIsDifferent && !configMatches)) {
      console.log('[ChatPane sendMessage] Initializing chat service', {
        chatServiceCreated,
        modelIsDifferent,
        configMatches,
        provider: providerToUse,
        model: modelToUse,
      });

      const initSuccess = await initializeChatService({
        provider: providerToUse,
        url: urlToUse,
        model: modelToUse,
      });

      if (!initSuccess) {
        console.error('[ChatPane sendMessage] RETURNING EARLY - init failed');
        error = error || 'Chat service not initialized';
        return;
      }

      console.log('[ChatPane sendMessage] Chat service initialized, waiting 200ms');
      // Small delay to ensure service is ready
      await new Promise((resolve) => setTimeout(resolve, 200));
    } else {
      console.log('[ChatPane sendMessage] Chat service already initialized');
    }

    try {
      console.log('[ChatPane sendMessage] Starting. Current messages.length:', messages.length);
      isStreaming = true;

      // If sending from a branch, set up branch-specific streaming
      if (sendingBranchIndex !== null) {
        const branchBox = branchBoxes.find((b) => b.branchIndex === sendingBranchIndex);
        if (branchBox) {
          const branchKey = branchBox.userMessage.branchId;
          streamingBranchIndex = branchKey;
          streamingTextByBranch.set(branchKey, '');
        }
      }

      // Resolve model/provider/url to use for this send
      let modelToUse = modelName;
      let providerToUse = modelProvider;
      let urlToUse = modelUrl;

      // If this branch has a specific modelId (model variation), prefer it
      if (modelId) {
        try {
          const allModels = await window.electronAPI.models.listAll();
          const modelDetails = allModels.find((m) => m.accessName === modelId);
          if (modelDetails) {
            modelToUse = modelDetails.accessName;
            providerToUse = modelDetails.provider;
            urlToUse = modelDetails.url;
          }
        } catch (err) {
          console.error('[ChatPane] Failed to get model details for sendMessage:', err);
          // Fall back to thread-level model if lookup fails
        }
      }

      // Ensure chat service is initialized for the resolved model
      const modelIsDifferent =
        modelToUse !== modelName ||
        providerToUse !== modelProvider ||
        urlToUse !== modelUrl;

      const configMatches =
        currentProviderConfig &&
        currentProviderConfig.provider === providerToUse &&
        currentProviderConfig.url === urlToUse &&
        currentProviderConfig.model === modelToUse;

      if (!chatServiceCreated || (modelIsDifferent && !configMatches)) {
        const initSuccess = await initializeChatService({
          provider: providerToUse,
          url: urlToUse,
          model: modelToUse,
        });

        if (!initSuccess) {
          error = error || 'Chat service not initialized';
          console.error('[ChatPane] Chat service not initialized for sendMessage');
          isStreaming = false;
          return;
        }
      }

      setupTokenListener();

      // Start a 10s watchdog: if streaming is still true and we've received no tokens,
      // stop streaming and surface an error to the user.
      if (streamingNoResponseTimeout) {
        clearTimeout(streamingNoResponseTimeout);
      }
      streamingNoResponseTimeout = setTimeout(() => {
        if (isStreaming && responseText.length === 0) {
          console.error('[ChatPane] Streaming timeout: no response from model after 10s');
          window.electronAPI.chat.offToken();
          isStreaming = false;
          showStreamingIndicator = false;
          showToast('No response from model. Please try again.', 4000);
        }
      }, 10_000);

      // Initialize idle timer bookkeeping
      streamingLastTokenAt = Date.now();
      if (streamingIdleTimeout) clearTimeout(streamingIdleTimeout);
      streamingIdleTimeout = setTimeout(() => {
        if (isStreaming && Date.now() - streamingLastTokenAt >= STREAMING_IDLE_TIMEOUT_MS) {
          console.error('[ChatPane] Streaming idle timeout: no tokens for 60s');
          window.electronAPI.chat.offToken();
          showStreamingIndicator = false;
          isStreaming = false;
          showToast('No response from model. Please try again.', 4000);
        }
      }, STREAMING_IDLE_TIMEOUT_MS);

      // Strip internal status banners from history so they are not re-sent to the model
      historyMessages = historyMessages.map((h) => ({
        role: h.role,
        content: stripStatusMessages(h.content),
      }));

      console.log('historyMessages', historyMessages);

      // Build messages array - only add new user message if not skipping creation
      const requestMessages = skipUserMessageCreation
        ? historyMessages  // Use existing messages (for auto-send of initial prompt)
        : [...historyMessages, { role: 'user', content: userMessage }];  // Add new user message

      const request: DesktopChatRequest = {
        messages: requestMessages,
        streaming: true,
        model: modelToUse,
        ...(currentThread?.id && { thread_id: currentThread.id }),  
        branch_id: branchId,  
      };
      console.log('[ChatPane sendMessage] Built request:', {
        thread_id: request.thread_id,
        branch_id: branchId,
        model: modelToUse,
        provider: providerToUse,
        messagesCount: requestMessages.length,
      });

      // Send user message (message will be created locally when chat is called)
      // Only send if we actually created an optimistic user message
      if (userMsg) {
        console.log('[ChatPane sendMessage] Sending user message to transmitter');
        await transmitter.sendUserMessage(userMsg, thread, isOnline, branchId);
      }

      console.log('[ChatPane sendMessage] *** CALLING window.electronAPI.chat.chat() ***');
      // Use chat for all requests - tools are invisible to user
      if (!currentThread?.id) {
        error = 'Thread ID is required';
        console.error('[ChatPane] Cannot send message: thread ID is missing');
        showStreamingIndicator = false;
        isStreaming = false;
        return;
      }
      const result = await window.electronAPI.chat.chat(currentThread.id, request) as { success: boolean; error?: string };
      console.log('[ChatPane sendMessage] *** Chat call returned ***', result);

      if (!result.success) {
        error = result.error || 'Chat failed';
        console.error('Chat failed:', result.error);
        showStreamingIndicator = false;
        isStreaming = false;
        return;
      }

      console.log('[ChatPane] Chat completed. responseText length:', responseText.length);
      console.log('[ChatPane] responseText content:', responseText.substring(0, 200));

      // After streaming completes, handle assistant response
      // IMPORTANT: For normal sends (with optimistic userMsg), try to map to the backend message
      // For auto-init / cases without optimistic user message, just pass undefined userMessageObj
      if (currentThread && userMsg) {
        const persistedUserMessages = await threadService.getMessages(currentThread.id);
        const actualUserMessage = persistedUserMessages.find(m => 
          m.clientMessageId === userMsg.clientMessageId || 
          (m.content === userMessage && m.role === 'user' && Math.abs(m.createdAt - userMsg.createdAt) < 5000)
        );
        
        // Use the backend-assigned user message
        console.log('[ChatPane] Using user message ID:', actualUserMessage?.id || userMsg.id, '(optimistic:', userMsg.id, ')');

        // Replace the optimistic message with the actual one from backend
        if (actualUserMessage && actualUserMessage.id !== userMsg.id) {
          messages = messages.map(m =>
            m.id === userMsg.id ? { ...actualUserMessage, status: MESSAGE_STATUS.SENT } : m
          );
        }

        console.log('[ChatPane] Calling handleAssistantResponse with responseText length:', responseText.length);
        console.log('[ChatPane] responseText preview:', responseText.substring(0, 100));

        await transmitter.handleAssistantResponse(
          responseText,
          currentThread,
          userMessage,
          actualUserMessage || userMsg,
        );
      } else {
        console.log('[ChatPane] Calling handleAssistantResponse (no userMsg) with responseText length:', responseText.length);
        await transmitter.handleAssistantResponse(responseText, currentThread, userMessage);
      }

      console.log('[ChatPane] After handleAssistantResponse, messages.length:', messages.length);
      console.log('[ChatPane] Last message:', messages[messages.length - 1]);

      // Clear streaming state after message is added
      // IMPORTANT: Hide streaming indicator FIRST, then clear other state
      showStreamingIndicator = false;
      isStreaming = false;
      
      // Use the branchId from the message that was just sent
      if (streamingBranchIndex !== null) {
        streamingTextByBranch.delete(streamingBranchIndex);
        streamingBranchIndex = null;
      } else {
        // Fallback: try to find branchId from activeBranchIndex or branchId
        const usedBranchId = activeBranchIndex !== null
          ? branchBoxes.find(b => b.branchIndex === activeBranchIndex)?.userMessage.branchId ?? branchId
          : branchId;
        streamingTextByBranch.delete(usedBranchId);
      }
      responseText = '';
      
      // Wait for Svelte to update the DOM
      await tick();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error sending message:', err);
    } finally {
      if (streamingNoResponseTimeout) {
        clearTimeout(streamingNoResponseTimeout);
        streamingNoResponseTimeout = null;
      }
      if (streamingIdleTimeout) {
        clearTimeout(streamingIdleTimeout);
        streamingIdleTimeout = null;
      }
      showStreamingIndicator = false;
      isStreaming = false;
    }
  }

  async function handleEditAndRegenerate(messageId: string, newContent: string) {
    if (!currentThread) {
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

      // Delete messages after the edited one from backend
      const deleteResult = await threadService.deleteMessagesAfter(currentThread.id, messageId);
      if (!deleteResult.success) {
        error = deleteResult.error;
        showToast(`Error deleting messages: ${deleteResult.error}`);
        return;
      }

      // Remove messages after the edited one from local array
      const messageIndex = messages.findIndex((m) => m.id === messageId);

      if (messageIndex !== -1) {
        messages = messages.slice(0, messageIndex + 1);
      }

      // Build conversation history for regeneration
      const historyMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      isStreaming = true;
      setupTokenListener();
      const request: DesktopChatRequest = {
        messages: historyMessages,
        streaming: true,
        model: modelName,
        ...(currentThread?.id && { thread_id: currentThread.id }),
      };

      // Use chat for all requests - tools are invisible to user
      if (!currentThread?.id) {
        error = 'Thread ID is required';
        console.error('[ChatPane] Cannot generate response: thread ID is missing');
        showToast(`Error generating response: Thread ID is required`);
        return;
      }
      const chatResult = await window.electronAPI.chat.chat(currentThread.id, request);

      if (!chatResult.success) {
        error = chatResult.error || 'Chat failed';
        console.error('[ChatPane] Chat failed:', chatResult.error);
        showToast(`Error generating response: ${chatResult.error}`);
      } else {
        // Find the edited user message to pass branch info
        const editedUserMessage = messages.find(m => m.id === messageId);
        await transmitter.handleAssistantResponse(responseText, currentThread, newContent, editedUserMessage);
        
        // Clear streaming state after message is added
        // IMPORTANT: Hide streaming indicator FIRST, then clear other state
        showStreamingIndicator = false;
        isStreaming = false;
        
        const usedBranchId = editedUserMessage?.branchId || normalizeBranchId(currentThread.currentBranchId || '1.0.0');
        streamingTextByBranch.delete(usedBranchId);
        if (streamingBranchIndex === usedBranchId) {
          streamingBranchIndex = null;
        }
        responseText = '';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ChatPane] Error editing message:', err);
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      showStreamingIndicator = false;
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

  // Branching handlers
  function handleCreateVariation(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    if (message && message.role === 'user') {
      showVariationModalFor = message;
      variationError = '';
    }
  }

  async function handleSubmitVariation(content: string, _branchType: BranchType, modelIds: string[]) {
    if (!currentThread || !showVariationModalFor) return;

    isCreatingVariation = true;
    hasCreatedVariations = true; // Mark that variations have been created
    allowAutoSelection = false; // Disable auto-selection permanently after creating variations
    variationError = '';

    try {
      console.log('[ChatPane] Creating variation from message:', showVariationModalFor.id, 'content:', content);
      
      // First, try to use the local message directly if it has been persisted (has status SENT)
      let messageForVariation: Message | undefined = showVariationModalFor;
      const localMessage = messages.find(m => m.id === showVariationModalFor!.id);
      
      // If local message exists and has been sent, use it
      if (localMessage && localMessage.status === MESSAGE_STATUS.SENT) {
        messageForVariation = localMessage;
        console.log('[ChatPane] Using local persisted message for variation:', messageForVariation.id);
      } else {
        // Refresh messages from backend to find the canonical original message
        const refreshedMessages = await threadService.getMessages(currentThread.id);
        
        // Try to match by ID first (backend-assigned), then by clientMessageId (if optimistic)
        messageForVariation = refreshedMessages.find(m => m.id === showVariationModalFor!.id);
        if (!messageForVariation && showVariationModalFor!.clientMessageId) {
          // Fallback: try to find by clientMessageId
          messageForVariation = refreshedMessages.find(m => m.clientMessageId === showVariationModalFor!.clientMessageId);
        }
        
        // If still not found, try to match by content and timing (within 5 seconds)
        if (!messageForVariation) {
          messageForVariation = refreshedMessages.find(m => 
            m.role === 'user' &&
            m.content === showVariationModalFor!.content &&
            Math.abs(m.createdAt - showVariationModalFor!.createdAt) < 5000
          );
        }
        
        if (!messageForVariation) {
          variationError = 'Original message not found in backend. The message may not have been saved yet. Please wait a moment and try again.';
          console.error('[ChatPane] Message not found after refresh. Original ID:', showVariationModalFor!.id, 'clientMessageId:', showVariationModalFor!.clientMessageId, 'refreshedMessages:', refreshedMessages.map(m => ({ id: m.id, clientMessageId: m.clientMessageId, content: m.content.substring(0, 50) })));
          return;
        }
        
        console.log('[ChatPane] Using refreshed message for variation. Backend ID:', messageForVariation.id, 'clientMessageId:', messageForVariation.clientMessageId);
      }
      
      // Ensure messageForVariation is defined before proceeding
      if (!messageForVariation) {
        variationError = 'Original message not found. Please try again.';
        console.error('[ChatPane] messageForVariation is undefined');
        return;
      }
      
      // No model explicitly selected - fall back to original message/thread model
      if (modelIds.length === 0) {
        const result = await threadService.createVariation(
          currentThread,
          messageForVariation,
          content, // Pass the variation content from the modal
        );

        if (!result.success) {
          variationError = result.error;
          console.error('[ChatPane] Failed to create variation:', result.error);
          return;
        }

        messages = [...messages, result.message];
        showVariationModalFor = null;
        
        // Reset activeBranchIndex to null so all branches are shown after creating variation
        // Don't auto-select any branch - let user see all branches
        activeBranchIndex = null;
        hiddenForkPoints = new Set(); // Show all branches for all fork points
        _branchSelectionTime = null;
        
        // Generate response - handleAssistantResponse will add the assistant message via onMessageAdd
        await generateResponseForVariation(result.message);
      } else if (modelIds.length === 1) {
        // Single explicitly selected model - create variation with that model
        const [modelId] = modelIds;
        const result = await threadService.createVariation(
          currentThread,
          messageForVariation,
          content,
          modelId,
        );

        if (!result.success) {
          variationError = result.error;
          console.error('[ChatPane] Failed to create variation with selected model:', result.error);
          return;
        }

        messages = [...messages, result.message];
        showVariationModalFor = null;

        activeBranchIndex = null;
        hiddenForkPoints = new Set();
        _branchSelectionTime = null;

        await generateResponseForVariation(result.message);
      } else {
        // Multiple models selected - create one variation per selected model
        const createdMessages: Message[] = [];
        // Fetch current messages once to use for all variations (avoids race conditions)
        const currentMessages = await threadService.getMessages(currentThread.id);
        
        for (const modelId of modelIds) {
          // Pass currentMessages including previously created variations in this batch
          const messagesForBranchId = [...currentMessages, ...createdMessages];
          const result = await threadService.createVariation(
            currentThread,
            messageForVariation,
            content, // Pass the variation content from the modal
            modelId, // Pass the specific modelId for this variation
            messagesForBranchId, // Pass current messages to avoid duplicate branch IDs
          );

          if (!result.success) {
            variationError = result.error;
            console.error('[ChatPane] Failed to create model variation:', result.error);
            // Continue with other models even if one fails
            continue;
          }

          createdMessages.push(result.message);
          messages = [...messages, result.message];
        }
        
        // Force reactivity update to ensure branch boxes are recalculated
        // The messages array update should trigger derived values, but we ensure it here
        // Trigger reactivity by reassigning the array reference
        messages = [...messages];
        
        showVariationModalFor = null;

        // Reset activeBranchIndex to null so all branches are shown after creating variation
        // Don't auto-select any branch - let user see all branches
        activeBranchIndex = null;
        hiddenForkPoints = new Set(); // Show all branches for all fork points
        _branchSelectionTime = null;

        // Generate responses for all created variations sequentially
        // This ensures each variation gets its own token stream without conflicts
        for (const message of createdMessages) {
          await generateResponseForVariation(message);
        }
        
      }
    } catch (e) {
      variationError = e instanceof Error ? e.message : 'Failed to create variation';
    } finally {
      isCreatingVariation = false;
      // Keep hasCreatedVariations and allowAutoSelection flags set permanently
      // This prevents auto-selection after variations are created
    }
  }

  async function generateResponseForVariation(userMessage: Message) {
    if (!currentThread) return;

    // Use a local variable to capture response text for this specific variation
    let variationResponseText = '';
    const branchKey = userMessage.branchId;

    // Set flag to prevent auto-reinitialization effect from overriding our variation model
    isHandlingVariation = true;

    try {
      // Track streaming state for this specific branch
      isStreaming = true;
      streamingBranchIndex = branchKey;
      // Initialize streaming text for this branch
      streamingTextByBranch.set(branchKey, '');
      
      // Set up token listener that captures to local variable and updates branch-specific streaming text
      // When running in parallel, each variation will update its own branch's streaming text
      window.electronAPI.chat.offToken();
      window.electronAPI.chat.onToken((data: { threadId: string; token: string }) => {
        // Only process tokens for the current thread
        if (data.threadId !== currentThread?.id) {
          return;
        }
        const token = data.token;
        variationResponseText = variationResponseText + token;
        // Update branch-specific streaming text
        streamingTextByBranch.set(branchKey, variationResponseText);
        // Also update shared responseText for backward compatibility
        responseText = variationResponseText;
        scrollToBottom('auto');
        if (streamingMessageEl) {
          streamingMessageEl.scrollIntoView({ block: 'end', behavior: 'auto' });
        }
      });

      // Build context for variation:
      // - Include all messages before the fork point
      // - Include selected branch messages (if any branches were selected)
      // - Include normal messages (sequential branches) that came after the fork but before this variation
      // - Exclude the original forked branch (e.g. 2.0 user+assistant) that this variation replaces
      // - Then add the variation user message
      //
      // Backend branch scheme for main path: "1.0", "2.0", "3.0", ...
      // Variation branchId will look like "2.1.0", "2.2.0", etc. (middle number increments)
      const parts = userMessage.branchId.split('.');
      const baseIndex = parseInt(parts[0], 10); // e.g. "2.1.0" -> 2
      const baseBranchId = `${baseIndex}.0`;

      // Check if there are selected branches in metadata
      const selectedBranchIds = currentThread?.metadata?.selectedBranchIds;
      let contextMessages: Message[];

      if (Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0) {
        // Use buildContextFromSelectedBranches to include selected branches and exclude non-selected ones
        // Pass the current variation branch ID so messages after this fork point are excluded
        // This function already handles permanently excluded messages correctly
        const selectedContext = buildContextFromSelectedBranches(messages, selectedBranchIds, userMessage.branchId);

        // Include the base branch history up to the fork point (getBranchMessages handles fork point exclusion)
        const baseBranchMessages = getBranchMessages(messages, baseBranchId);

        // Merge base branch and selected context, de‑duplicated and ordered
        // Filter out permanently excluded messages that might have been added by getBranchMessages
        // Permanently excluded messages are those in original branch path (X.0.0) after a fork point
        // that don't come after any selected branch
        const merged = [...baseBranchMessages, ...selectedContext];
        const seenIds = new Set<string>();
        const forkPoints = getForkPoints(messages);
        
        contextMessages = merged.filter((m) => {
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          
          // Check if this message is permanently excluded
          const msgNormalized = normalizeBranchId(m.branchId);
          const msgParts = msgNormalized.split('.');
          const msgRowNum = getRowNumber(msgNormalized);
          const isOriginalBranchPath = msgParts.length === 3 && msgParts[1] === '0' && msgParts[2] === '0';
          
          if (isOriginalBranchPath) {
            // Check if this message comes after any fork point
            for (const forkBranchId of forkPoints) {
              const forkRowNum = getRowNumber(normalizeBranchId(forkBranchId));
              
              if (msgRowNum > forkRowNum) {
                // This message comes after a fork point
                // Check if there's a selected branch for this fork point
                const hasSelectedBranchForThisFork = selectedBranchIds.some(branchId => {
                  const branchRowNum = getRowNumber(normalizeBranchId(branchId));
                  return branchRowNum === forkRowNum;
                });
                
                if (hasSelectedBranchForThisFork) {
                  // Check if this message comes after the selected branch
                  const comesAfterSelectedBranch = selectedBranchIds.some(branchId => {
                    const branchRowNum = getRowNumber(normalizeBranchId(branchId));
                    return msgRowNum > branchRowNum;
                  });
                  
                  if (!comesAfterSelectedBranch) {
                    // This message is permanently excluded (e.g., 3.0.0, 4.0.0 after fork point 2.0.0 with selected branch 2.1.0)
                    return false;
                  }
                } else {
                  // No selected branch for this fork point, exclude all messages after it
                  return false;
                }
              }
            }
          }
          
          return true;
        }).sort((a, b) => a.createdAt - b.createdAt);
      } else {
        // Fallback: Build context from in‑memory messages
        // Use getBranchMessages which handles fork point exclusion automatically
        // For variation branch, getBranchMessages excludes fork point and messages after
        contextMessages = getBranchMessages(messages, userMessage.branchId);
      }

      const historyMessages = [
        ...contextMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userMessage.content },
      ];

      // Get model details if modelId is provided (for model variations)
      let modelToUse = userMessage.modelId || modelName;
      let providerToUse = modelProvider;
      let urlToUse = modelUrl;

      console.log('[ChatPane] generateResponseForVariation - Initial values:', {
        userMessageModelId: userMessage.modelId,
        threadModelName: modelName,
        threadModelProvider: modelProvider,
        threadModelUrl: modelUrl,
      });

      // If we have a modelId (accessName), try to find the model details to get provider/url
      if (userMessage.modelId) {
        try {
          const allModels = await window.electronAPI.models.listAll();
          const modelDetails = allModels.find(m => m.accessName === userMessage.modelId);
          if (modelDetails) {
            modelToUse = modelDetails.accessName;
            providerToUse = modelDetails.provider;
            urlToUse = modelDetails.url;
            console.log('[ChatPane] generateResponseForVariation - Found model details:', {
              modelToUse,
              providerToUse,
              urlToUse,
            });
          } else {
            console.warn('[ChatPane] generateResponseForVariation - Model not found:', userMessage.modelId);
          }
        } catch (err) {
          console.error('[ChatPane] Failed to get model details:', err);
          // Fall back to using thread model
        }
      }

      // Initialize chat service for this model if needed
      // Check if model is different from current thread's model
      const modelIsDifferent = modelToUse !== modelName || 
        providerToUse !== modelProvider || 
        urlToUse !== modelUrl;
      
      // Check if current provider config matches what we need
      const configMatches = currentProviderConfig &&
        currentProviderConfig.provider === providerToUse &&
        currentProviderConfig.url === urlToUse &&
        currentProviderConfig.model === modelToUse;
      
      // Initialize if: service not created, or model is different and config doesn't match
      if (!chatServiceCreated || (modelIsDifferent && !configMatches)) {
        console.log('[ChatPane] generateResponseForVariation - Calling initializeChatService:', {
          provider: providerToUse,
          url: urlToUse,
          model: modelToUse,
          isHandlingVariation,
        });

        const initSuccess = await initializeChatService({
          provider: providerToUse,
          url: urlToUse,
          model: modelToUse,
        });

        if (!initSuccess) {
          error = error || 'Chat service not initialized';
          console.error('[ChatPane] Chat service not initialized for variation');
          return;
        }

        console.log('[ChatPane] generateResponseForVariation - Init completed, waiting 200ms');
        // Wait a bit for service to be ready
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[ChatPane] generateResponseForVariation - Ready to send request');
      }

      // Format thread_id with branch_id: "threadId,branch_id=branchId"
      // Note: threadData is not used - thread_id and branch_id are now separate properties in DesktopChatRequest

      const request: DesktopChatRequest = {
        messages: historyMessages,
        streaming: true,
        model: modelToUse,
        ...(currentThread?.id && { thread_id: currentThread.id }),
        branch_id: branchKey,
      };

      console.log('[generateResponseForVariation] Final request for variation:', {
        thread_id: request.thread_id,
        branch_id: request.branch_id,
        messages: request.messages,
      });

      // Use chat for variations (same as normal messages)
      // The backend will persist both user and assistant messages when branch_id is included
      if (!currentThread?.id) {
        error = 'Thread ID is required';
        console.error('[ChatPane] Cannot generate variation: thread ID is missing');
        return;
      }
      const result = await window.electronAPI.chat.chat(currentThread.id, request) as { success: boolean; error?: string };

      if (!result.success) {
        error = result.error || 'Chat failed';
        console.error('[ChatPane] Variation chat failed:', result.error);
        return;
      }

      // Assistant message will be created locally by handleAssistantResponse
      // after streaming completes, just like normal messages
      // Note: handleAssistantResponse calls onMessageAdd which already updates messages array
      await transmitter.handleAssistantResponse(variationResponseText, currentThread, userMessage.content, userMessage);
      
      // Clear streaming text for this branch
      streamingTextByBranch.delete(branchKey);
      
      // Check if any branches are still streaming
      const hasStreamingBranches = streamingTextByBranch.size > 0;
      if (!hasStreamingBranches) {
        // IMPORTANT: Hide streaming indicator FIRST, then clear other state
        showStreamingIndicator = false;
        isStreaming = false;
        streamingBranchIndex = null;
        responseText = '';
      } else if (streamingBranchIndex === branchKey) {
        // If this was the last tracked branch, clear it
        streamingBranchIndex = Array.from(streamingTextByBranch.keys())[0] ?? null;
      }
      
      // Ensure branches remain visible after variation response
      // Don't let auto-selection happen - keep all branches shown
      activeBranchIndex = null;
      hiddenForkPoints = new Set(); // Show all branches for all fork points
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ChatPane] Error generating variation response:', err);
      // Clear streaming text on error
      streamingTextByBranch.delete(branchKey);

      // Check if any branches are still streaming
      const hasStreamingBranches = streamingTextByBranch.size > 0;
      if (!hasStreamingBranches) {
        showStreamingIndicator = false;
        isStreaming = false;
        streamingBranchIndex = null;
        responseText = '';
      }
    } finally {
      // Clear flag to allow normal auto-reinitialization to resume
      isHandlingVariation = false;
    }
  }



  // Cleanup on unmount
  async function cleanup() {
    window.electronAPI.chat.offToken();
    if (currentThread?.id) {
      await window.electronAPI.chat.destroyProvider(currentThread.id);
    }
  }

  // Process pending messages when coming back online
  async function processPendingMessages() {
    const map = get(outboxService.pending);
    await transmitter.processPendingMessages(thread, map, {
      setupTokenListener,
      getResponseText: () => responseText,
      // Use chat for all requests - tools are invisible to user
      chat: (request) => {
        if (!currentThread?.id) {
          throw new Error('Thread ID is required');
        }
        return window.electronAPI.chat.chat(currentThread.id, request);
      },
      setStreaming: (streaming) => {
        isStreaming = streaming;
      },
      offToken: () => window.electronAPI.chat.offToken(),
    });
  }

  // Keyboard shortcuts for branching
  function handleKeyDown(event: KeyboardEvent) {
    // Cmd/Ctrl + Shift + B: Toggle branch view for active branch's fork point
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'B') {
      event.preventDefault();
      if (branchBoxes.length > 0) {
        if (activeBranchIndex !== null) {
          const branchBox = branchBoxes.find(b => b.branchIndex === activeBranchIndex);
          if (branchBox) {
            const baseForkBranchId = branchBox.userMessage.branchId.split('.')[0] + '.0';
            toggleBranches(baseForkBranchId);
          }
        } else {
          // If no branch selected, toggle the first fork point
          const forkPointBranchIds = getForkPoints(messages);
          if (forkPointBranchIds.length > 0) {
            toggleBranches(forkPointBranchIds[0]);
          }
        }
      }
      return;
    }

    // Cmd/Ctrl + Shift + V: Create variation from last user message
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'V') {
      event.preventDefault();
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMessage) {
        showVariationModalFor = lastUserMessage;
      }
      return;
    }

    // Cmd/Ctrl + Shift + 1-9: Switch to branch by number
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && /^[1-9]$/.test(event.key)) {
      event.preventDefault();
      const branchIndex = parseInt(event.key) - 1;
      if (branchIndex < branchBoxes.length) {
        void setActiveBranch(branchBoxes[branchIndex].branchIndex);
      }
      return;
    }
  }

  // Lifecycle hooks
  onMount(() => {
    outboxService.init();

    // Register keyboard shortcuts
    window.addEventListener('keydown', handleKeyDown);

    // Set up callback for file write event updates
    fileWriteEventService.setUpdateCallback(() => {
      const allEvents = fileWriteEventService.getAllEvents();
      if (eventsChanged(fileWriteEventsByMessageId, allEvents)) {
        fileWriteEventsByMessageId = { ...allEvents };
      }
    });

    // Listen for thread updates from backend
    let unsubThreadUpdated: (() => void) | undefined;
    let unsubToolUse: (() => void) | undefined;

    try {
      if (window.electronAPI?.chat?.onToolUse) {
        unsubToolUse = window.electronAPI.chat.onToolUse(
          (data: {
            toolName: string;
            input: unknown;
            stage: 'start' | 'complete';
            toolCallId: string;
            result?: unknown;
          }) => {
            const updatedEvents = fileWriteEventService.handleToolUse(data, messages);
            if (eventsChanged(fileWriteEventsByMessageId, updatedEvents)) {
              fileWriteEventsByMessageId = updatedEvents;
            }
          },
        );
      }

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

    // Listen for tool status events (for UI feedback during long operations)
    let unsubToolStatus: (() => void) | undefined;
    try {
      if (window.electronAPI?.chat?.onToolStatus) {
        unsubToolStatus = window.electronAPI.chat.onToolStatus((status) => {
          if (status.state === 'in_progress') {
            toolStatusMessage = status.message || `${status.toolName}...`;
          } else {
            toolStatusMessage = null;
          }
        });
      }
    } catch {
      // ignore if API not available
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (unsubThreadUpdated) unsubThreadUpdated();
      if (unsubToolUse) unsubToolUse();
      if (unsubToolStatus) unsubToolStatus();
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

    // Don't auto-reinitialize during variation handling to avoid overriding the variation's model
    if (isHandlingVariation) {
      console.log('[ChatPane] Auto-reinit effect skipped - handling variation');
      return;
    }

    // Build provider config from current thread metadata
    const newConfig: ProviderConfig = {
      provider: modelProvider,
      url: modelUrl,
      model: modelName,
    };

    // Check if we need to reinitialize (config changed or first time)
    const needsReinit =
      !currentProviderConfig ||
      currentProviderConfig.provider !== newConfig.provider ||
      currentProviderConfig.url !== newConfig.url ||
      currentProviderConfig.model !== newConfig.model;

    if (needsReinit) {
      console.log('[ChatPane] Auto-reinit effect triggered:', {
        currentConfig: currentProviderConfig,
        newConfig,
        isHandlingVariation,
      });
      chatServiceCreated = false; // Mark as not created to trigger reinit
      void initializeChatService(newConfig);
    }
  });

  // Track which threads we've already auto-sent for (to avoid duplicate sends)
</script>

{#if !currentThread}
  <div class="chat-pane empty">Select a thread to open chat</div>
{:else}
  <div class="chat-pane">
    <div class="chat-header">
      {#key thread?.id}
        <div class="header-content">
          <div class="title-section">
            {#if currentThread?.currentBranchId}
              <button
                class="branch-toggle"
                onclick={() => showBranchControls = !showBranchControls}
                title={showBranchControls ? 'Hide branch controls' : 'Show branch controls'}
              >
                <i class="pi pi-chevron-right" class:expanded={showBranchControls}></i>
              </button>
              {#if showBranchControls}
                <BranchIndicator
                  currentBranchId={currentThread.currentBranchId}
                  isMainBranch={normalizeBranchId(currentThread.currentBranchId || '') === '1.0.0'}
                />
                <BranchSwitcher
                  messages={messages}
                  currentBranchId={currentThread.currentBranchId}
                  onSwitch={async (branchId) => {
                    if (!currentThread) return;
                    const result = await threadService.switchBranch(currentThread.id, branchId);
                    if (result.success) {
                      currentThread = result.thread;
                      showToast(`Switched to branch: ${branchId}`);
                      // Update URL with branchId
                      if (typeof window !== 'undefined' && window.location) {
                        const params = new URLSearchParams(window.location.search);
                        params.set('branchId', branchId);
                        const newUrl = `${window.location.pathname}?${params.toString()}`;
                        window.history.pushState(null, '', newUrl);
                      }
                    } else {
                      showToast(`Failed to switch branch: ${result.error}`);
                    }
                  }}
                />
              {/if}
            {/if}
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
        <!-- Render timeline with messages and branch boxes at their respective positions -->
        {#each timeline as item (item.type === 'message' ? item.message.id : item.forkBranchId)}
          {#if item.type === 'message'}
          <div class="message-wrapper">
            <MessageBubble
                message={item.message}
              onRetry={retryMessage}
              onEdit={handleEdit}
              onShowVersions={handleShowVersions}
              onCreateVariation={handleCreateVariation}
              threadId={currentThread?.id}
              {isStreaming}
              {showComments}
            />
          </div>
          {:else if item.type === 'branchBoxes'}
            <!-- Show branch boxes for this fork point -->
            {#if item.boxes.length > 0}
              {@const isHidden = isForkPointHidden(item.forkBranchId)}
              {@const hasSelectedBranch = item.boxes.some(b => isBranchSelected(b.branchIndex))}
              {@const selectedBoxes = item.boxes.filter(b => isBranchSelected(b.branchIndex))}
              {#if hasSelectedBranch && isHidden}
            <!-- Show only selected branches with toggle -->
            <div class="branch-container-selected">
                  {#each selectedBoxes as box (box.branchIndex)}
                <BranchLane
                  userMessage={box.userMessage}
                  assistantMessage={box.assistantMessage}
                  branchIndex={box.branchIndex}
                  isSelected={true}
                  isActiveBranch={activeBranchIndex === box.branchIndex}
                  onSelect={() => {}}
                  hideHeader={false}
                  streamingText={streamingTextByBranch.get(box.userMessage.branchId) ?? null}
                  onSendMessage={sendMessageInBranch}
                  isStreaming={isStreaming && streamingBranchIndex === box.userMessage.branchId}
                  allMessages={box.allMessages}
                />
              {/each}
                  <button class="branch-toggle-btn" onclick={() => toggleBranches(item.forkBranchId)} title="Show all branches">
                <i class="pi pi-sitemap"></i>
                <span>Show branches</span>
              </button>
            </div>
          {:else}
                {#if hasSelectedBranch}
                  <button class="branch-toggle-btn" onclick={() => toggleBranches(item.forkBranchId)} title="Hide branches">
                <i class="pi pi-eye-slash"></i>
                <span>Hide branches</span>
              </button>
            {/if}
                <!-- Show all branches for this fork point -->
                <div class="branch-boxes-wrapper">
                  <div class="branch-boxes-vertical">
                    {#each item.boxes as box (box.branchIndex)}
                  <BranchLane
                    userMessage={box.userMessage}
                    assistantMessage={box.assistantMessage}
                    branchIndex={box.branchIndex}
                    isSelected={isBranchSelected(box.branchIndex)}
                    isActiveBranch={activeBranchIndex === box.branchIndex && isBranchInHiddenForkPoint(box.branchIndex)}
                    onSelect={() => setActiveBranch(box.branchIndex)}
                    hideHeader={false}
                    streamingText={streamingTextByBranch.get(box.userMessage.branchId) ?? null}
                    onSendMessage={sendMessageInBranch}
                    isStreaming={isStreaming && streamingBranchIndex === box.userMessage.branchId}
                    allMessages={box.allMessages}
                  />
                    {/each}
                  </div>
                </div>
          {/if}
        {/if}
          {/if}
        {/each}

        <!-- Show streaming response if active (not in a branch) -->
        {#if showStreamingIndicator && responseText && streamingBranchIndex === null}
          <div class="message-wrapper" bind:this={streamingMessageEl}>
            <div class="message assistant streaming">
              <div class="message-content">
                <MarkdownRenderer content={responseText} enableCopy={false} />
              </div>
              <div class="message-meta">Streaming... ●</div>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Tool status balloon (shown during long tool operations) -->
      {#if toolStatusMessage}
        <div class="tool-status-balloon">
          <span class="tool-status-spinner">⟳</span>
          <span class="tool-status-text">{toolStatusMessage}</span>
        </div>
      {/if}

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    <div class="composer">
      <!-- Composer is rendered in the page and wired separately -->
      {#if composer}
        {@render composer({ sendMessage, isStreaming, disabled: isMainInputDisabled })}
      {/if}
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


<!-- Variation Modal -->
{#if showVariationModalFor}
  <VariationModal
    originalMessage={showVariationModalFor}
    {messages}
    onSubmit={handleSubmitVariation}
    onCancel={() => (showVariationModalFor = null)}
    isSubmitting={isCreatingVariation}
    error={variationError}
  />
{/if}
</div>
{/if}
<style>
  .chat-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: var(--content-padding);
    background: var(--surface-main);
  }

  .chat-header {
    padding: var(--content-padding) 0;
    border-bottom: 1px solid var(--surface-border);
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--surface-main);
    flex-shrink: 0;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .branch-toggle {
    background: transparent;
    border: none;
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    border-radius: 4px;
  }

  .branch-toggle:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .branch-toggle .pi-chevron-right {
    font-size: 0.75rem;
    transition: transform 0.2s ease;
  }

  .branch-toggle .pi-chevron-right.expanded {
    transform: rotate(90deg);
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

  .branch-boxes-wrapper {
    width: 100%;
    margin-top: 1rem;
    margin-bottom: 1rem;
    /* No overflow constraints - let parent handle vertical */
    overflow-x: auto;
    min-height: fit-content;
  }

  .branch-boxes-vertical {
    display: flex;
    flex-direction: row;
    gap: 24px;
    align-items: stretch;
    padding-bottom: 8px;
    min-width: fit-content;
    /* No height constraint - let content determine height */
    /* Vertical overflow visible so content can overflow to main screen */
    /* align-items: stretch makes all boxes the same height */
  }
  
  /* When inside wrapper, handle horizontal scrolling */
  .branch-boxes-wrapper > .branch-boxes-vertical {
    overflow-x: auto;
    overflow-y: visible;
    scroll-behavior: smooth;
    /* Constrain width to parent, but allow content to overflow and scroll */
    width: 100%;
    /* Ensure flex container allows children to grow and fill space */
    display: flex;
    flex-direction: row;
    gap: 24px;
    /* Use scroll-padding to ensure last item is fully visible when scrolling */
    scroll-padding-right: 24px;
    /* Ensure the container can actually scroll - allow it to be wider than parent */
    min-width: min-content;
    /* Force scrollbar to appear when content overflows */
    overflow-x: auto !important;
  }
  

  /* Make branch boxes fill available width when there's space */
  .branch-boxes-vertical {
    justify-content: flex-start;
  }

  /* Base styles for branch boxes */
  .branch-boxes-vertical > :global(*) {
    flex: 1 1 auto;
    min-width: 450px;
    max-width: 600px;
    /* Boxes can grow between 450px and 600px when there's space, but won't shrink below 450px */
  }
  
  /* When inside wrapper, boxes should fill space when few, scroll when many */
  .branch-boxes-wrapper > .branch-boxes-vertical > :global(*) {
    /* Always maintain minimum width of 450px */
    min-width: 450px;
    max-width: none;
    /* Use flex: 1 1 0% so boxes grow and shrink equally to share space */
    /* This makes 2 boxes = 50% each, 3 boxes = 33.33% each when container is wide enough */
    /* But boxes won't shrink below min-width, so scroll will appear when needed */
    flex: 1 1 0%;
  }
  
  /* When there are 4+ boxes, prevent shrinking to ensure scroll appears */
  /* All boxes maintain 450px min-width and trigger horizontal scroll */
  .branch-boxes-wrapper > .branch-boxes-vertical:has(:nth-child(4)) > :global(*) {
    flex-shrink: 0;
    min-width: 450px;
  }
  
  /* Fallback for browsers without :has() support: when 4th child exists, prevent shrinking */
  .branch-boxes-wrapper > .branch-boxes-vertical > :global(*:nth-child(n+4)) {
    flex-shrink: 0;
    min-width: 450px;
  }
  
  /* Also apply to all children when 4th exists (fallback) */
  .branch-boxes-wrapper > .branch-boxes-vertical > :global(*:nth-child(4)) ~ :global(*) {
    flex-shrink: 0;
    min-width: 450px;
  }
  
  

  .branch-boxes-wrapper > .branch-boxes-vertical::-webkit-scrollbar {
    height: 8px;
  }

  .branch-boxes-wrapper > .branch-boxes-vertical::-webkit-scrollbar-track {
    background: transparent;
  }

  .branch-boxes-wrapper > .branch-boxes-vertical::-webkit-scrollbar-thumb {
    background: var(--surface-border);
    border-radius: 4px;
  }

  .branch-boxes-wrapper > .branch-boxes-vertical::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }

  .branch-container-selected {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  /* When branches are hidden and only one selected branch is shown, make it full width */
  /* Target the BranchLane component when it's the only branch (there may be a button after it) */
  .branch-container-selected > :global(.branch-lane:first-child:last-child),
  .branch-container-selected:has(:global(.branch-lane:first-child)):not(:has(:global(.branch-lane:nth-child(2)))) > :global(.branch-lane) {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    flex: 1 1 100% !important;
  }
  
  /* Fallback: when there's exactly one BranchLane child (even if button exists) */
  .branch-container-selected:has(:global(.branch-lane:only-of-type)) > :global(.branch-lane) {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    flex: 1 1 100% !important;
  }

  .branch-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--surface-overlay);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .branch-toggle-btn:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }

  .branch-toggle-btn i {
    font-size: 1rem;
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    margin-top: var(--content-padding);
    padding-right: var(--inline-spacing);
  }
  
  /* Allow branch boxes wrapper to overflow horizontally, but no vertical scroll */
  .messages > .branch-boxes-wrapper {
    margin-left: calc(-1 * var(--inline-spacing));
    margin-right: calc(-1 * var(--inline-spacing));
    padding-left: var(--inline-spacing);
    padding-right: var(--inline-spacing);
    /* Ensure no height constraint - let content determine height */
    /* Vertical overflow passes through to parent .messages container */
    /* Horizontal scrolling handled by inner .branch-boxes-vertical container */
    /* Ensure wrapper doesn't constrain width */
    width: calc(100% + 2 * var(--inline-spacing));
    max-width: none;
    /* Position relative so scroll container can work properly */
    position: relative;
  }
  
  /* Ensure the scroll container inside wrapper can actually scroll */
  .messages > .branch-boxes-wrapper > .branch-boxes-vertical {
    /* Make sure the scroll container respects its width constraint */
    max-width: 100%;
    /* Ensure scrollbar appears when content overflows */
    overflow-x: auto !important;
  }

  .composer {
    margin-top: var(--content-padding);
    flex-shrink: 0;
    position: sticky;
    bottom: 0;
    background: var(--surface-main);
    padding-top: var(--content-padding);
  }

  .no-messages {
    color: var(--text-secondary);
  }

  /* Tool status balloon - shows during long tool operations */
  .tool-status-balloon {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    margin-top: 0.5rem;
    background: var(--surface-overlay, #2a2a2a);
    border: 1px solid var(--surface-border, #444);
    border-radius: var(--border-radius, 6px);
    color: var(--text-secondary, #aaa);
    font-size: 0.85rem;
    animation: fadeIn 0.2s ease-out;
  }

  .tool-status-spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
    font-size: 1rem;
  }

  .tool-status-text {
    font-style: italic;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }


</style>


