<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import type { Thread } from '../../../src-electron/preload';
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
  import { assembleContext, getBranchMessages, getVariationsForBranch, getForkPoints, getNextSequentialBranchId, getNextBranchIdInBranch } from '$lib/utils/branch-utils';

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

  // Watch for prop changes and update model configuration from thread metadata
  $effect(() => {
    const previousThreadId = currentThread?.id;
    currentThread = thread;

    // Extract model configuration from thread metadata
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

    // Clear error state when switching threads to prevent stale errors
    error = '';
    // Clear file write events when switching threads
    if (previousThreadId !== thread?.id) {
      fileWriteEventService.clear();
      fileWriteEventsByMessageId = {};
      // Reset branch selection when switching threads
      activeBranchIndex = null;
      selectedBranchContextMessageId = null;
      branchSelectionTime = null;
      showBranches = true;
    }
  });

  // Track which threads have had their initial prompt auto-sent
  let autoSentThreadIds = $state(new Set<string>());

  // Auto-send initial prompt for threads created with initialPrompt metadata
  // This is the ONLY place that checks for and uses the initialPrompt metadata flag
  $effect(() => {
    console.log('[ChatPane Auto-send] Effect triggered:', {
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
  let showBranches = $state(true); // Show all branches by default, hide when one is selected
  let streamingBranchIndex = $state<string | null>(null); // Track which branch is currently streaming (by branchId)
  let selectedBranchContextMessageId = $state<string | null>(null); // Track the last message in the selected branch for context
  // Track streaming text per branchId for parallel variations
  let streamingTextByBranch = $state<Map<string, string>>(new Map());
  // Track the branch we're currently sending from (doesn't affect visual selection)
  let sendingBranchIndex = $state<number | null>(null);
  let sendingBranchContextMessageId = $state<string | null>(null);
  // Track when a branch was selected to exclude messages sent from main input after selection
  let branchSelectionTime = $state<number | null>(null);

  async function setActiveBranch(branchIndex: number) {
    if (!currentThread) return;
    
    activeBranchIndex = branchIndex;
    showBranches = false; // Hide other branches when one is selected
    
    // Find the branch box and get its branchId
    const branchBox = branchBoxes.find(b => b.branchIndex === branchIndex);
    if (!branchBox) {
      selectedBranchContextMessageId = null;
      branchSelectionTime = null;
      return;
    }
    
    // Update thread's currentBranchId via API
    const result = await threadService.switchBranch(currentThread.id, branchBox.userMessage.branchId);
    if (result.success) {
      // Update local thread state
      currentThread = result.thread;
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
      branchSelectionTime = lastMessage.createdAt;
    } else if (branchBox.assistantMessage) {
      selectedBranchContextMessageId = branchBox.assistantMessage.id;
      branchSelectionTime = branchBox.assistantMessage.createdAt;
    } else if (branchBox.userMessage) {
      selectedBranchContextMessageId = branchBox.userMessage.id;
      branchSelectionTime = branchBox.userMessage.createdAt;
    } else {
      selectedBranchContextMessageId = null;
      branchSelectionTime = null;
    }
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

  function toggleBranches() {
    showBranches = !showBranches;
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
    const forkPointMessages = forkPointBranchIds
      .map(branchId => messages.find(m => m.branchId === branchId && m.role === 'user'))
      .filter((m): m is Message => m !== undefined);
    
    if (forkPointMessages.length === 0) return null;
    
    // Return the earliest fork point (by createdAt)
    return forkPointMessages.sort((a, b) => a.createdAt - b.createdAt)[0]?.id ?? null;
  });

  // Helper function to get all messages in a branch using branchId
  function getAllMessagesInBranch(branchId: string): Message[] {
    return getBranchMessages(messages, branchId);
  }

  // Build branch boxes (original + variations) for rendering
  const branchBoxes = $derived.by(() => {
    if (!firstForkPointId) return [];
    const parent = messages.find((m) => m.id === firstForkPointId && m.role === 'user');
    if (!parent) return [];

    // Get all variations of this branch using branchId
    const variationChildren = getVariationsForBranch(messages, parent.branchId);
    
    // Include the parent (original branch) and all variations
    const userBranches = [parent, ...variationChildren];

    return userBranches.map((userMsg, index) => {
      // For the original branch, get all messages AFTER the fork point with the original branchId
      // For variations, get ONLY messages in that specific variation branchId (not parent hierarchy)
      let allBranchMessages: Message[];
      
      if (index === 0) {
        // Original branch - get all messages in this branch hierarchy
        // For branch "2.0", include messages with branchIds: "2.0", "2.0.1", "2.0.2", etc.
        // But exclude variation branches (e.g., "2.1.0", "2.2.0") and their continuations (e.g., "2.1.1")
        const baseParts = parent.branchId.split('.');
        const baseNum = baseParts[0]; // e.g., "2" from "2.0"
        const baseBranchId = `${baseNum}.0`; // e.g., "2.0"
        
        // If this branch is selected and collapsed, only include messages up to selection time
        // Messages sent from main input after selection should appear in main area, not branch box
        const isSelectedAndCollapsed = activeBranchIndex === index && !showBranches;
        const cutoffTime = isSelectedAndCollapsed && branchSelectionTime !== null
          ? branchSelectionTime
          : Infinity;
        
        const seenIds = new Set<string>();
        allBranchMessages = messages
          .filter(m => {
            // Deduplicate by message ID
            if (seenIds.has(m.id)) {
              return false;
            }
            seenIds.add(m.id);
            
            // If branch is selected and collapsed, exclude messages sent after selection
            // (these were sent from main input and should appear in main area)
            if (isSelectedAndCollapsed && m.createdAt > cutoffTime) {
              return false;
            }
            
            // Include messages with the exact base branchId (e.g., "2.0")
            if (m.branchId === baseBranchId) {
              return true;
            }
            
            // Include continuation messages (e.g., "2.0.1", "2.0.2")
            // These are messages that start with "baseNum.0." and have 3 parts
            const mParts = m.branchId.split('.');
            if (mParts.length === 3 && mParts[0] === baseNum && mParts[1] === '0') {
              return true;
            }
            
            return false;
          })
          .sort((a, b) => a.createdAt - b.createdAt);
      } else {
        // Variation branch - get all messages in this variation branch hierarchy
        // For variation "2.1.0", include messages with branchIds: "2.1.0", "2.1.1", "2.1.2", etc.
        // But exclude parent branch messages (e.g., "2.0") and other variations (e.g., "2.2.0")
        const variationParts = userMsg.branchId.split('.');
        const variationPrefix = variationParts.slice(0, 2).join('.'); // e.g., "2.1" from "2.1.0"
        const parentBranchId = `${variationParts[0]}.0`; // e.g., "2.0"
        
        // If this branch is selected and collapsed, only include messages up to selection time
        // Messages sent from main input after selection should appear in main area, not branch box
        const isSelectedAndCollapsed = activeBranchIndex === index && !showBranches;
        const cutoffTime = isSelectedAndCollapsed && branchSelectionTime !== null
          ? branchSelectionTime
          : Infinity;
        
        const seenIds = new Set<string>();
        allBranchMessages = messages
          .filter(m => {
            // Deduplicate by message ID
            if (seenIds.has(m.id)) {
              return false;
            }
            seenIds.add(m.id);
            
            // Exclude parent branch messages
            if (m.branchId === parentBranchId) {
              return false;
            }
            
            // If branch is selected and collapsed, exclude messages sent after selection
            // (these were sent from main input and should appear in main area)
            if (isSelectedAndCollapsed && m.createdAt > cutoffTime) {
              return false;
            }
            
            // Include messages that start with the variation prefix (e.g., "2.1.0", "2.1.1", "2.1.2")
            // This includes the variation root and all continuations
            if (m.branchId.startsWith(`${variationPrefix}.`)) {
              return true;
            }
            
            // Also include exact match for the variation root
            if (m.branchId === userMsg.branchId) {
              return true;
            }
            
            return false;
          })
          .sort((a, b) => a.createdAt - b.createdAt);
      }
      
      // Separate user and assistant messages for display
      const assistantMessages = allBranchMessages.filter(m => m.role === 'assistant');

      return {
        branchIndex: index, // Index for UI purposes only
        userMessage: userMsg,
        assistantMessage: assistantMessages[assistantMessages.length - 1] ?? null,
        allMessages: allBranchMessages,
      };
    });
  });

  // Get all message IDs that should be excluded from normal display (all messages in branches)
  const excludedMessageIds = $derived.by(() => {
    if (!firstForkPointId) return new Set<string>();
    
    const excluded = new Set<string>();
    
    // If a branch is selected and collapsed, exclude ALL messages from ALL branches
    // This ensures only the selected branch appears in its box, and other branch messages don't appear in main area
    if (activeBranchIndex !== null && !showBranches) {
      // Exclude all messages from all branch boxes (original and variations)
      // This prevents messages from other branches (like the original response) from appearing below
      for (const box of branchBoxes) {
        for (const msg of box.allMessages) {
          excluded.add(msg.id);
        }
      }
      // Also exclude any messages with branchIds matching any branch hierarchy (safety check)
      for (const box of branchBoxes) {
        const branchId = box.userMessage.branchId;
        for (const msg of messages) {
          if (msg.branchId === branchId || msg.branchId.startsWith(branchId + '.')) {
            excluded.add(msg.id);
          }
        }
      }
    } else {
      // Show all branches - exclude all messages from all branch boxes
      for (const box of branchBoxes) {
        for (const msg of box.allMessages) {
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
  
  // Initialize activeBranchIndex from thread's currentBranchId when thread/branches load
  // But skip if variations exist or were just created (user should see all branches)
  $effect(() => {
    console.log('[ChatPane] currentThread:', currentThread);
    // Don't auto-select if we've created variations or if auto-selection is disabled
    if (hasCreatedVariations || !allowAutoSelection) return;
    
    // Don't auto-select if there are multiple branch boxes (variations exist)
    if (branchBoxes.length > 1) {
      return;
    }
    
    // Check both top-level currentBranchId and metadata.currentBranchId
    // The metadata one is the authoritative source after branch switching
    const threadBranchIdRaw = currentThread?.metadata?.currentBranchId ?? currentThread?.currentBranchId;
    const threadBranchId = typeof threadBranchIdRaw === 'string' ? threadBranchIdRaw : undefined;
    if (threadBranchId && branchBoxes.length > 0 && activeBranchIndex === null) {
      // Don't auto-select if the thread's currentBranchId is a variation branch (has 3 parts like "1.1.0")
      // Variation branches should remain visible, not auto-selected
      const branchParts = threadBranchId.split('.');
      const isVariationBranch = branchParts.length === 3 && branchParts[2] === '0';
      if (isVariationBranch) {
        // Keep all branches visible for variation branches
        return;
      }
      
      // Find the branch box that matches the thread's currentBranchId
      const matchingBox = branchBoxes.find(box => {
        const boxBranchId = box.userMessage.branchId;
        
        // Exact match
        if (boxBranchId === threadBranchId) return true;
        
        // Check if threadBranchId is a continuation of boxBranchId
        // e.g., boxBranchId = "2.0", threadBranchId = "2.0.1"
        // e.g., boxBranchId = "2.1.0", threadBranchId = "2.1.1"
        if (threadBranchId.startsWith(boxBranchId + '.')) return true;
        
        return false;
      });
      
      if (matchingBox) {
        activeBranchIndex = matchingBox.branchIndex;
        showBranches = false; // Collapse to show only the active branch
      }
    }
  });

  // Determine if the main input should be disabled
  // Disable when branches exist and are shown, but no branch is selected
  // The UI shows all branches when: activeBranchIndex === null OR showBranches === true
  // The UI shows single branch when: activeBranchIndex !== null && !showBranches
  const isMainInputDisabled = $derived.by(() => {
    // No branches = don't disable
    if (branchBoxes.length === 0) return false;
    
    // Single branch selected and collapsed = don't disable (user can continue in that branch)
    if (activeBranchIndex !== null && !showBranches) return false;
    
    // All branches shown but none selected = disable (user must select a branch first)
    return activeBranchIndex === null;
  });

  // Split messages into before and after fork point
  const messagesBeforeFork = $derived.by(() => {
    if (!firstForkPointId) {
      // No fork point, show all non-excluded messages
      return messages.filter((m) => !excludedMessageIds.has(m.id));
    }
    const forkPointIndex = messages.findIndex((m) => m.id === firstForkPointId);
    if (forkPointIndex < 0) return messages.filter((m) => !excludedMessageIds.has(m.id));
    return messages.slice(0, forkPointIndex).filter((m) => !excludedMessageIds.has(m.id));
  });

  const messagesAfterFork = $derived.by(() => {
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

    const result = await window.electronAPI.chat.createProvider(config.provider, {
      url: config.url,
      model: config.model,
    });

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

    // Remove any existing token listeners to prevent duplicates
    window.electronAPI.chat.offToken();

    window.electronAPI.chat.onToken((token: string) => {
      // Force reactivity by creating a new string reference
      responseText = responseText + token;

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
    if (!chatServiceCreated) {
      error = 'Chat service not initialized';
      return;
    }

    if (!userMessage.trim() && attachments.length === 0) return;

    // Build conversation history based on selected branch context
    let historyMessages: Array<{ role: string; content: string }>;
    
    // Use sending branch context if sending from a branch box, otherwise use active branch
    const contextBranchIndex = sendingBranchIndex !== null ? sendingBranchIndex : activeBranchIndex;
    const contextMessageId = sendingBranchContextMessageId ?? selectedBranchContextMessageId;
    
    // Check if message is sent from main input when a branch is selected and collapsed
    const isMainInputWithBranchSelected = sendingBranchIndex === null && activeBranchIndex !== null && !showBranches;
    
    if (isMainInputWithBranchSelected && activeBranchIndex !== null && firstForkPointId) {
      // When sending from main input with a branch selected and collapsed:
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
      branchId = lastUserMessage?.branchId ?? thread?.currentBranchId ?? '1.0';
    } else if (sendingBranchIndex !== null) {
      // Message sent from branch lane input - continue that branch hierarchy
      const branchBox = branchBoxes.find(b => b.branchIndex === sendingBranchIndex);
      const currentBranchId = branchBox?.userMessage.branchId ?? thread?.currentBranchId ?? '1.0';
      // Get the next branchId in this branch hierarchy (e.g., "2.1.0" -> "2.1.1")
      branchId = getNextBranchIdInBranch(currentBranchId, messages);
    } else if (activeBranchIndex !== null && !showBranches) {
      // Branch is selected and collapsed, but message sent from main input
      // Start a new main branch instead of continuing the selected branch
      branchId = getNextSequentialBranchId(messages);
    } else if (activeBranchIndex !== null) {
      // Branch is selected but branches are shown - continue the branch hierarchy
      const branchBox = branchBoxes.find(b => b.branchIndex === activeBranchIndex);
      const currentBranchId = branchBox?.userMessage.branchId ?? thread?.currentBranchId ?? '1.0';
      // Get the next branchId in this branch hierarchy (e.g., "2.1.0" -> "2.1.1")
      branchId = getNextBranchIdInBranch(currentBranchId, messages);
    } else {
      // Linear conversation - get next sequential branchId
      branchId = getNextSequentialBranchId(messages);
    }

    // Determine model for the new message
    let modelId: string | null = null;

    // Use sendingBranchIndex if we're sending from a branch box, otherwise use activeBranchIndex
    const branchIndexToUse = sendingBranchIndex !== null ? sendingBranchIndex : activeBranchIndex;

    if (branchIndexToUse !== null) {
      // Get modelId from the branch's user message
      const branchBox = branchBoxes.find(b => b.branchIndex === branchIndexToUse);
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
      if (userMsg) {
        await transmitter.sendUserMessage(
          userMsg,
          thread,
          isOnline,
          branchId,
        );
      }
      isStreaming = false;
      return;
    }

    try {
      isStreaming = true;
      
      // If sending from a branch, set up branch-specific streaming
      if (sendingBranchIndex !== null) {
        const branchBox = branchBoxes.find(b => b.branchIndex === sendingBranchIndex);
        if (branchBox) {
          const branchKey = branchBox.userMessage.branchId;
          streamingBranchIndex = branchKey;
          streamingTextByBranch.set(branchKey, '');
        }
      }
      
      setupTokenListener();

      // Format thread_id with branch_id: "threadId,branch_id=branchId"
      const threadData: string | undefined = currentThread?.id
        ? `${currentThread.id},branch_id=${branchId}`
        : undefined;
      const request = {
        messages: [...historyMessages, { role: 'user', content: userMessage }],
        streaming: true,
        model: modelName,
        ...(currentThread?.id && { thread_id: threadData }),
        branch_id: branchId,
      };
      console.log('[ChatPane] Sending chat request with thread_id:', request.thread_id, 'branchId:', branchId);

      // Send user message (message will be created locally when chat is called)
      // Only send if we actually created an optimistic user message
      if (userMsg) {
        await transmitter.sendUserMessage(userMsg, thread, isOnline, branchId);
      }

      // Use chatWithFileTools for all requests - tools are invisible to user
      const result = await window.electronAPI.chat.chatWithFileTools(request) as { success: boolean; error?: string };

      if (!result.success) {
        error = result.error || 'Chat failed';
        console.error('Chat failed:', result.error);
        isStreaming = false;
        return;
      }
      
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
        
        await transmitter.handleAssistantResponse(
          responseText,
          currentThread,
          userMessage,
          actualUserMessage || userMsg,
        );
      } else {
        await transmitter.handleAssistantResponse(responseText, currentThread, userMessage);
      }

      // Clear streaming state after message is added
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
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error sending message:', err);
    } finally {
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
      const request = {
        messages: historyMessages,
        streaming: true,
        model: modelName,
        ...(currentThread?.id && { thread_id: currentThread.id }),
      };

      // Use chatWithFileTools for all requests - tools are invisible to user
      const chatResult = await window.electronAPI.chat.chatWithFileTools(request);

      if (!chatResult.success) {
        error = chatResult.error || 'Chat failed';
        console.error('[ChatPane] Chat failed:', chatResult.error);
        showToast(`Error generating response: ${chatResult.error}`);
      } else {
        // Find the edited user message to pass branch info
        const editedUserMessage = messages.find(m => m.id === messageId);
        await transmitter.handleAssistantResponse(responseText, currentThread, newContent, editedUserMessage);
        
        // Clear streaming state after message is added
        const usedBranchId = editedUserMessage?.branchId || currentThread.currentBranchId || '1.0';
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
      
      // Refresh messages from backend ONLY for locating the canonical original message.
      // Do not overwrite the local messages array (it contains assistant replies needed for context).
      const refreshedMessages = await threadService.getMessages(currentThread.id);
      
      // Find the message again with refreshed data
      // Try to match by ID first (backend-assigned), then by clientMessageId (if optimistic)
      let messageForVariation = refreshedMessages.find(m => m.id === showVariationModalFor!.id);
      if (!messageForVariation && showVariationModalFor!.clientMessageId) {
        // Fallback: try to find by clientMessageId
        messageForVariation = refreshedMessages.find(m => m.clientMessageId === showVariationModalFor!.clientMessageId);
      }
      
      if (!messageForVariation) {
        variationError = 'Original message not found in backend. The message may not have been saved yet. Please wait a moment and try again.';
        console.error('[ChatPane] Message not found after refresh. Original ID:', showVariationModalFor!.id, 'clientMessageId:', showVariationModalFor!.clientMessageId);
        return;
      }
      
      console.log('[ChatPane] Using refreshed message for variation. Backend ID:', messageForVariation.id, 'clientMessageId:', messageForVariation.clientMessageId);
      
      // For single model, create a single variation
      if (modelIds.length === 0 || modelIds.length === 1) {
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
        showBranches = true;
        
        // Generate response - handleAssistantResponse will add the assistant message via onMessageAdd
        await generateResponseForVariation(result.message);
      } else {
        // For multiple models, create one variation per selected model
        const createdMessages: Message[] = [];
        
        for (const modelId of modelIds) {
          const result = await threadService.createVariation(
            currentThread,
            messageForVariation,
            content, // Pass the variation content from the modal
            modelId, // Pass the specific modelId for this variation
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
        showBranches = true;

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

    try {
      // Track streaming state for this specific branch
      isStreaming = true;
      streamingBranchIndex = branchKey;
      // Initialize streaming text for this branch
      streamingTextByBranch.set(branchKey, '');
      
      // Set up token listener that captures to local variable and updates branch-specific streaming text
      // When running in parallel, each variation will update its own branch's streaming text
      window.electronAPI.chat.offToken();
      window.electronAPI.chat.onToken((token: string) => {
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

      // Build context exactly like a normal linear chat, but:
      // - Drop the original forked branch (e.g. 2.0 user+assistant)
      // - Keep all earlier history (e.g. 1.0 user+assistant)
      // - Then add the variation user message
      //
      // Backend branch scheme for main path: "1.0", "2.0", "3.0", ...
      // Variation branchId will look like "2.1.0", "2.2.0", etc. (middle number increments)
      const parts = userMessage.branchId.split('.');
      const baseIndex = parseInt(parts[0], 10); // e.g. "2.1.0" -> 2
      const baseBranchId = `${baseIndex}.0`;

      // Build context from in‑memory messages (what the UI shows), which includes assistant replies
      const contextMessages = messages
        .filter((m) => {
          if (!m.branchId) return false;
          const p = m.branchId.split('.');
          // Only main path messages: X.0
          if (p.length !== 2 || p[1] !== '0') return false;

          const idx = parseInt(p[0], 10);
          // Keep only earlier branches (1.0 before 2.0, etc.)
          if (idx >= baseIndex) return false;

          return true;
        })
        .sort((a, b) => a.createdAt - b.createdAt);

      const historyMessages = [
        ...contextMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userMessage.content },
      ];

      // Get model details if modelId is provided (for model variations)
      let modelToUse = userMessage.modelId || modelName;
      let providerToUse = modelProvider;
      let urlToUse = modelUrl;

      // If we have a modelId (accessName), try to find the model details to get provider/url
      if (userMessage.modelId) {
        try {
          const allModels = await window.electronAPI.models.listAll();
          const modelDetails = allModels.find(m => m.accessName === userMessage.modelId);
          if (modelDetails) {
            modelToUse = modelDetails.accessName;
            providerToUse = modelDetails.provider;
            urlToUse = modelDetails.url;
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
        
        // Wait a bit for service to be ready
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Format thread_id with branch_id: "threadId,branch_id=branchId"
      const threadData: string | undefined = currentThread?.id
        ? `${currentThread.id},branch_id=${branchKey}`
        : undefined;
      
      const request = {
        messages: historyMessages,
        streaming: true,
        model: modelToUse,
        ...(currentThread?.id && { thread_id: threadData }),
        branch_id: branchKey,
      };

      console.log('[generateResponseForVariation] Final request for variation:', {
        thread_id: request.thread_id,
        branch_id: request.branch_id,
        messages: request.messages,
      });

      // Use chatWithFileTools for variations (same as normal messages)
      // The backend will persist both user and assistant messages when branch_id is included
      const result = await window.electronAPI.chat.chatWithFileTools(request) as { success: boolean; error?: string };

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
      
      // Ensure branches remain visible after variation response
      // Don't let auto-selection happen - keep all branches shown
      activeBranchIndex = null;
      showBranches = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ChatPane] Error generating variation response:', err);
      // Clear streaming text on error
      streamingTextByBranch.delete(branchKey);
    } finally {
      // When running in parallel, multiple variations may be streaming
      // Check if any branches are still streaming
      const hasStreamingBranches = streamingTextByBranch.size > 0;
      if (!hasStreamingBranches) {
        isStreaming = false;
        streamingBranchIndex = null;
        responseText = '';
      } else if (streamingBranchIndex === branchKey) {
        // If this was the last tracked branch, clear it
        streamingBranchIndex = Array.from(streamingTextByBranch.keys())[0] ?? null;
      }
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
      // Use chatWithFileTools for all requests - tools are invisible to user
      chat: (request) => window.electronAPI.chat.chatWithFileTools(request),
      setStreaming: (streaming) => {
        isStreaming = streaming;
      },
      offToken: () => window.electronAPI.chat.offToken(),
    });
  }

  // Keyboard shortcuts for branching
  function handleKeyDown(event: KeyboardEvent) {
    // Cmd/Ctrl + Shift + B: Toggle branch view
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'B') {
      event.preventDefault();
      if (branchBoxes.length > 0) {
        toggleBranches();
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
              <BranchIndicator 
                currentBranchId={currentThread.currentBranchId} 
                isMainBranch={currentThread.currentBranchId === '1.0'} 
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
        <!-- Show messages before fork point -->
        {#each messagesBeforeFork as m (m.id)}
          <div class="message-wrapper">
            <MessageBubble
              message={m}
              onRetry={retryMessage}
              onEdit={handleEdit}
              onShowVersions={handleShowVersions}
              onCreateVariation={handleCreateVariation}
              threadId={currentThread?.id}
              {isStreaming}
              {showComments}
            />
          </div>
        {/each}

        <!-- Show branch lanes -->
        {#if branchBoxes.length > 0}
          {#if activeBranchIndex !== null && !showBranches}
            <!-- Show only selected branch with toggle -->
            <div class="branch-container-selected">
              {#each branchBoxes.filter((b) => b.branchIndex === activeBranchIndex) as box (box.branchIndex)}
                <BranchLane
                  userMessage={box.userMessage}
                  assistantMessage={box.assistantMessage}
                  branchIndex={box.branchIndex}
                  isSelected={true}
                  isActiveBranch={true}
                  onSelect={() => {}}
                  hideHeader={false}
                  streamingText={streamingTextByBranch.get(box.userMessage.branchId) ?? null}
                  onSendMessage={sendMessageInBranch}
                  isStreaming={isStreaming && streamingBranchIndex === box.userMessage.branchId}
                  allMessages={box.allMessages}
                />
              {/each}
              <button class="branch-toggle-btn" onclick={toggleBranches} title="Show all branches">
                <i class="pi pi-sitemap"></i>
                <span>Show branches</span>
              </button>
            </div>
          {:else}
            {#if activeBranchIndex !== null}
              <button class="branch-toggle-btn" onclick={toggleBranches} title="Hide branches">
                <i class="pi pi-eye-slash"></i>
                <span>Hide branches</span>
              </button>
            {/if}
            <!-- Show all branches -->
            <div class="branch-boxes-wrapper">
              <div class="branch-boxes-vertical">
                {#each branchBoxes as box (box.branchIndex)}
                  <BranchLane
                    userMessage={box.userMessage}
                    assistantMessage={box.assistantMessage}
                    branchIndex={box.branchIndex}
                    isSelected={activeBranchIndex === box.branchIndex}
                    isActiveBranch={activeBranchIndex === box.branchIndex && !showBranches}
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

        <!-- Show messages after fork point -->
        {#each messagesAfterFork as m (m.id)}
          <div class="message-wrapper">
            <MessageBubble
              message={m}
              onRetry={retryMessage}
              onEdit={handleEdit}
              onShowVersions={handleShowVersions}
              onCreateVariation={handleCreateVariation}
              threadId={currentThread?.id}
              {isStreaming}
              {showComments}
            />
          </div>
        {/each}

        <!-- Show streaming response if active (not in a branch) -->
        {#if isStreaming && responseText && streamingBranchIndex === null}
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
    /* Content inside can be wider than 100% and will scroll */
    /* Horizontal scrolling handled here */
    /* Vertical overflow passes through to parent .messages */
    /* Add padding-right to ensure last box is fully visible when scrolling */
    padding-right: 48px;
    /* Use scroll-padding to ensure last item is fully visible when scrolling */
    scroll-padding-right: 24px;
  }
  
  /* Add margin-right to last box to ensure it's fully visible when scrolling */
  .branch-boxes-wrapper > .branch-boxes-vertical > :global(*:last-child) {
    margin-right: 24px;
  }

  /* Make branch boxes fill available width when there's space */
  .branch-boxes-vertical {
    justify-content: flex-start;
  }

  .branch-boxes-vertical > :global(*) {
    flex: 1 1 auto;
    min-width: 450px;
    max-width: 600px;
    /* Boxes can grow between 450px and 600px when there's space, but won't shrink below 450px */
  }
  
  /* When inside wrapper, boxes can grow but won't shrink below min-width */
  .branch-boxes-wrapper > .branch-boxes-vertical > :global(*) {
    flex: 1 0 auto;
    min-width: 450px;
    max-width: 600px;
    /* flex-grow: 1 allows boxes to grow and fill space when there are few boxes */
    /* flex-shrink: 0 prevents boxes from shrinking, enabling horizontal scroll when many boxes */
    /* Maintain min-width to ensure horizontal scrolling works */
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
    /* Horizontal scrolling handled by inner container */
    /* Override parent's overflow-x: hidden to allow horizontal scrolling */
    overflow-x: visible;
    overflow-y: visible;
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


