<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import type { Thread } from '../../../src-electron/preload';
  import { outboxService } from '$lib/services/outbox.service';
  import { networkService } from '$lib/services/network.service';
  import { MessageTransmitter } from '$lib/services/message-transmitter.service';
  import { threadService } from '$lib/services/thread.service';
  import type { Message, BranchType } from '$lib/types/thread.type';
  import MessageBubble from './MessageBubble.svelte';
  import MessageVersionHistory from './MessageVersionHistory.svelte';
  import MoveThreadModal from './modals/MoveThreadModal.svelte';
  import { isThreadGeneratingTitle } from '$lib/stores/titleGeneration.store';
  import { storageService } from '$lib/services/storage.service';
import { FileWriteEventService, type FileWriteEvent } from '$lib/services/file-write-event.service';
  import VariationModal from './branching/VariationModal.svelte';
  import BranchLane from './branching/BranchLane.svelte';
  import { assembleContext } from '$lib/utils/branch-utils';

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

  let { thread = null, messages = $bindable([]), composer }: Props = $props();

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
      showBranches = true;
    }
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
  let streamingBranchIndex = $state<number | null>(null); // Track which branch is currently streaming
  let selectedBranchContextMessageId = $state<string | null>(null); // Track the last message in the selected branch for context
  // Track streaming text per branch index for parallel variations
  let streamingTextByBranch = $state<Map<number, string>>(new Map());
  // Track the branch we're currently sending from (doesn't affect visual selection)
  let sendingBranchIndex = $state<number | null>(null);
  let sendingBranchContextMessageId = $state<string | null>(null);

  function setActiveBranch(branchIndex: number) {
    activeBranchIndex = branchIndex;
    showBranches = false; // Hide other branches when one is selected
    
    // Find the last message in this branch to use as context endpoint
    const branchBox = branchBoxes.find(b => b.branchIndex === branchIndex);
    if (!branchBox) {
      selectedBranchContextMessageId = null;
      return;
    }
    
    // Find the last message in this branch by following the chain
    let lastMessage: Message | null = null;
    
    if (branchIndex === 0) {
      // Main branch: find the last message with branchIndex 0
      const mainBranchMessages = messages.filter(m => (m.branchIndex ?? 0) === 0);
      const messagesWithChildren = new Set(mainBranchMessages
        .filter(m => mainBranchMessages.some(child => child.parentMessageId === m.id))
        .map(m => m.id));
      
      lastMessage = mainBranchMessages
        .filter(m => !messagesWithChildren.has(m.id))
        .sort((a, b) => b.createdAt - a.createdAt)[0] 
        ?? mainBranchMessages.sort((a, b) => b.createdAt - a.createdAt)[0];
    } else {
      // Variation branch: follow the chain from the variation user message
      const branchMessages: Message[] = [branchBox.userMessage];
      let current = branchBox.userMessage;
      
      while (true) {
        const child = messages.find(m => 
          m.parentMessageId === current.id && 
          (m.branchIndex ?? 0) === branchIndex
        );
        if (!child) break;
        branchMessages.push(child);
        current = child;
      }
      
      lastMessage = branchMessages[branchMessages.length - 1] ?? branchBox.userMessage;
    }
    
    if (lastMessage) {
      selectedBranchContextMessageId = lastMessage.id;
    } else if (branchBox.assistantMessage) {
      selectedBranchContextMessageId = branchBox.assistantMessage.id;
    } else if (branchBox.userMessage) {
      selectedBranchContextMessageId = branchBox.userMessage.id;
    } else {
      selectedBranchContextMessageId = null;
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

    // Find the last message in this specific branch by following the parent-child chain
    let lastMessageInBranch: Message | null = null;
    const branchUserMsg = branchBox.userMessage;
    
    if (branchIndex === 0) {
      // Main branch: find the last message with branchIndex 0
      const mainBranchMessages = messages.filter(m => (m.branchIndex ?? 0) === 0);
      const messagesWithChildren = new Set(mainBranchMessages
        .filter(m => mainBranchMessages.some(child => child.parentMessageId === m.id))
        .map(m => m.id));
      
      lastMessageInBranch = mainBranchMessages
        .filter(m => !messagesWithChildren.has(m.id))
        .sort((a, b) => b.createdAt - a.createdAt)[0] 
        ?? mainBranchMessages.sort((a, b) => b.createdAt - a.createdAt)[0];
    } else {
      // Variation branch: follow the chain from the variation user message
      const branchMessages: Message[] = [branchUserMsg];
      let current = branchUserMsg;
      
      // Follow the chain: find children of current message with matching branchIndex
      while (true) {
        const child = messages.find(m => 
          m.parentMessageId === current.id && 
          (m.branchIndex ?? 0) === branchIndex
        );
        if (!child) break;
        branchMessages.push(child);
        current = child;
      }
      
      // The last message in the chain is the parent for the new message
      lastMessageInBranch = branchMessages[branchMessages.length - 1] ?? branchUserMsg;
    }

    // Store branch info for this send without changing activeBranchIndex (which controls selection)
    const branchInfo = {
      branchIndex,
      branchType: branchBox.branchType,
      modelId: branchBox.userMessage.modelId ?? null,
      parentMessageId: lastMessageInBranch?.id ?? null,
      contextMessageId: lastMessageInBranch?.id ?? null,
    };

    // Set sending branch context (doesn't affect visual selection)
    sendingBranchIndex = branchInfo.branchIndex;
    sendingBranchContextMessageId = branchInfo.contextMessageId;
    
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
      const latestAssistant = messages
        .filter(m => m.role === 'assistant' && (m.branchIndex ?? 0) === activeBranchIndex)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      
      if (latestAssistant && latestAssistant.id !== selectedBranchContextMessageId) {
        selectedBranchContextMessageId = latestAssistant.id;
      }
    }
  });

  // First fork point: any USER message that has at least one child with branchIndex > 0
  const firstForkPointId = $derived.by(() => {
    // Find the earliest user message that has variation children
    // This ensures we show the first fork point in the conversation
    let earliestForkPoint: { id: string; index: number } | null = null;
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== 'user') continue;
      
      // Check if this message has variation children (children with branchIndex > 0)
      // Variations are user messages with parentMessageId pointing to this message
      const hasVariationChild = messages.some(
        (m) => m.parentMessageId === msg.id && m.role === 'user' && (m.branchIndex ?? 0) > 0,
      );
      
      if (hasVariationChild) {
        if (!earliestForkPoint || i < earliestForkPoint.index) {
          earliestForkPoint = { id: msg.id, index: i };
        }
      }
    }
    
    return earliestForkPoint?.id ?? null;
  });

  // Helper function to get all messages in a branch by following the parent-child chain
  function getAllMessagesInBranch(startMessageId: string, branchIndex: number): Message[] {
    const branchMessages: Message[] = [];
    const messageMap = new Map(messages.map(m => [m.id, m]));
    
    // Start from the branch's first user message
    let current = messageMap.get(startMessageId);
    if (!current) return [];
    
    branchMessages.push(current);
    
    // Follow the chain: find all children with matching branchIndex
    // For branchIndex 0, also include messages with null/undefined branchIndex (legacy messages)
    while (true) {
      const child = messages.find(m => {
        if (m.parentMessageId !== current!.id) return false;
        
        // For branchIndex 0, accept messages with branchIndex 0 or null/undefined (legacy)
        if (branchIndex === 0) {
          return (m.branchIndex ?? 0) === 0;
        }
        
        // For other branch indices, require exact match
        return (m.branchIndex ?? 0) === branchIndex;
      });
      
      if (!child) {
        // For branchIndex 0, also check for legacy messages that come right after in the array
        // (handles case where old messages don't have parentMessageId set)
        if (branchIndex === 0) {
          const currentIndex = messages.findIndex(m => m.id === current!.id);
          if (currentIndex >= 0 && currentIndex < messages.length - 1) {
            const nextMsg = messages[currentIndex + 1];
            // If next message is assistant with branchIndex 0/null and no parentMessageId, include it
            if (nextMsg.role === 'assistant' && 
                (nextMsg.branchIndex ?? 0) === 0 && 
                !nextMsg.parentMessageId &&
                !branchMessages.some(m => m.id === nextMsg.id)) {
              branchMessages.push(nextMsg);
              current = nextMsg;
              continue;
            }
          }
        }
        break;
      }
      branchMessages.push(child);
      current = child;
    }
    
    return branchMessages.sort((a, b) => a.createdAt - b.createdAt);
  }

  // Build branch boxes (original + variations) for rendering
  const branchBoxes = $derived.by(() => {
    if (!firstForkPointId) return [];
    const parent = messages.find((m) => m.id === firstForkPointId && m.role === 'user');
    if (!parent) return [];

    // Get all user messages that are children of the fork point (variations)
    // Only include variations (branchIndex > 0), not the parent itself
    const variationChildren = messages.filter(
      (m) => m.parentMessageId === parent.id && m.role === 'user' && (m.branchIndex ?? 0) > 0
    );
    
    // Include the parent (original branch) and all variations
    // The parent should have branchIndex 0 or null
    const userBranches = [parent, ...variationChildren];
    userBranches.sort((a, b) => (a.branchIndex ?? 0) - (b.branchIndex ?? 0));

    return userBranches.map((userMsg) => {
      const userBranchIndex = userMsg.branchIndex ?? 0;
      
      // Get all messages in this branch (following the parent-child chain)
      const allBranchMessages = getAllMessagesInBranch(userMsg.id, userBranchIndex);
      
      // Separate user and assistant messages for display
      const assistantMessages = allBranchMessages.filter(m => m.role === 'assistant');

      return {
        branchIndex: userBranchIndex,
        branchType: userMsg.branchType ?? null,
        userMessage: userMsg, // First user message (for header/identification)
        assistantMessage: assistantMessages[assistantMessages.length - 1] ?? null, // Last assistant message
        allMessages: allBranchMessages, // All messages in the branch for display
      };
    });
  });

  // Get all message IDs that should be excluded from normal display (fork point + all its descendants)
  const excludedMessageIds = $derived.by(() => {
    if (!firstForkPointId) return new Set<string>();
    const excluded = new Set<string>([firstForkPointId]);
    
    // Collect all descendants of the fork point (including all assistant responses and variations)
    const queue = [firstForkPointId];
    const visited = new Set<string>([firstForkPointId]);
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = messages.filter((m) => m.parentMessageId === currentId);
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          excluded.add(child.id);
          queue.push(child.id);
        }
      }
    }
    
    // Also exclude the original assistant response if it comes right after the fork point
    // (handles case where old messages don't have parentMessageId set)
    const forkPointIndex = messages.findIndex((m) => m.id === firstForkPointId);
    if (forkPointIndex >= 0 && forkPointIndex < messages.length - 1) {
      const nextMsg = messages[forkPointIndex + 1];
      if (nextMsg.role === 'assistant' && (nextMsg.branchIndex ?? 0) === 0) {
        excluded.add(nextMsg.id);
      }
    }
    
    return excluded;
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
  async function initializeChatService(config: ProviderConfig): Promise<boolean> {
    console.log(`[ChatPane] Initializing chat provider: ${config.provider} with model ${config.model} at ${config.url}`);

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

    // Build conversation history based on selected branch context
    let historyMessages: Array<{ role: string; content: string }>;
    
    // Use sending branch context if sending from a branch box, otherwise use active branch
    const contextBranchIndex = sendingBranchIndex !== null ? sendingBranchIndex : activeBranchIndex;
    const contextMessageId = sendingBranchContextMessageId ?? selectedBranchContextMessageId;
    
    if (contextBranchIndex !== null && contextMessageId && contextBranchIndex > 0) {
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
          variationUserMsg = messages.find(m => m.id === selectedMsg.parentMessageId);
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
          // Find the fork point user message (parent of variation user)
          const forkPointUser = messages.find(m => m.id === variationUserMsg.parentMessageId);
          
          if (!forkPointUser) {
            // No fork point found, use variation path as-is
            const variationPath = assembleContext(messages, contextMessageId);
            historyMessages = variationPath.map((m) => ({
              role: m.role,
              content: m.content,
            }));
          } else {
            // Build path from root to the fork point's parent (messages before the fork)
            const pathBeforeFork = forkPointUser.parentMessageId 
              ? assembleContext(messages, forkPointUser.parentMessageId)
              : [];
            
            // Get variation messages: variation user and variation assistant
            const variationMessages: Message[] = [];
            if (variationUserMsg) {
              variationMessages.push(variationUserMsg);
            }
            if (selectedMsg.role === 'assistant') {
              variationMessages.push(selectedMsg);
            }
            
            // Combine: messages before fork -> variation messages
            const fullPath = [...pathBeforeFork, ...variationMessages];
            
            historyMessages = fullPath.map((m) => ({
              role: m.role,
              content: m.content,
            }));
          }
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

    // Determine branch info for the new message
    let parentMessageId: string | null = null;
    let branchIndex: number = 0;
    let branchType: BranchType | null = null;
    let modelId: string | null = null;

    // Use sendingBranchIndex if we're sending from a branch box, otherwise use activeBranchIndex
    const branchIndexToUse = sendingBranchIndex !== null ? sendingBranchIndex : activeBranchIndex;

    if (branchIndexToUse !== null) {
      branchIndex = branchIndexToUse;
      
      // Get branchType and modelId from the branch's user message
      const branchBox = branchBoxes.find(b => b.branchIndex === branchIndexToUse);
      if (branchBox) {
        branchType = branchBox.branchType;
        modelId = branchBox.userMessage.modelId ?? null;
      }

      // Find the last message in the branch by following the parent-child chain
      // Start from the branch's user message and follow the chain
      let lastMessageInBranch: Message | null = null;
      
      // Use sendingBranchContextMessageId if available, otherwise find it
      if (sendingBranchContextMessageId) {
        lastMessageInBranch = messages.find(m => m.id === sendingBranchContextMessageId) ?? null;
      }
      
      if (!lastMessageInBranch) {
        if (branchIndexToUse === 0) {
          // Main branch: find the last message with branchIndex 0 by following the chain
          const mainBranchMessages = messages.filter(m => (m.branchIndex ?? 0) === 0);
          // Find the message with no children (leaf node) or the latest one
          const messagesWithChildren = new Set(mainBranchMessages
            .filter(m => mainBranchMessages.some(child => child.parentMessageId === m.id))
            .map(m => m.id));
          
          lastMessageInBranch = mainBranchMessages
            .filter(m => !messagesWithChildren.has(m.id))
            .sort((a, b) => b.createdAt - a.createdAt)[0] 
            ?? mainBranchMessages.sort((a, b) => b.createdAt - a.createdAt)[0];
        } else {
          // Variation branch: follow the chain from the variation user message
          const branchUserMsg = branchBox?.userMessage;
          if (branchUserMsg) {
            // Find all messages in this branch by following parent-child chain
            const branchMessages: Message[] = [branchUserMsg];
            let current = branchUserMsg;
            
            // Follow the chain: find children of current message with matching branchIndex
            while (true) {
              const child = messages.find(m => 
                m.parentMessageId === current.id && 
                (m.branchIndex ?? 0) === branchIndexToUse
              );
              if (!child) break;
              branchMessages.push(child);
              current = child;
            }
            
            // The last message in the chain is the parent for the new message
            lastMessageInBranch = branchMessages[branchMessages.length - 1] ?? branchUserMsg;
          }
        }
      }

      if (lastMessageInBranch) {
        parentMessageId = lastMessageInBranch.id;
      }
    } else {
      // No active branch: find the last message in main branch
      const mainBranchMessages = messages.filter(m => (m.branchIndex ?? 0) === 0);
      const lastMessage = mainBranchMessages.sort((a, b) => b.createdAt - a.createdAt)[0];
      
      if (lastMessage) {
        parentMessageId = lastMessage.id;
        branchIndex = 0;
      }
    }

    // Create and add optimistic message with branch info
    const userMsg = transmitter.addOptimisticMessage(userMessage, isOnline);
    userMsg.parentMessageId = parentMessageId;
    userMsg.branchIndex = branchIndex;
    userMsg.branchType = branchType;
    userMsg.modelId = modelId;

    // If offline, queue for later and don't enter streaming state
    if (!isOnline) {
      await transmitter.sendUserMessage(userMsg, thread, isOnline, thread.currentBranchId);
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
        ...(currentThread?.id && { thread_id: currentThread.id }),
      };
      console.log('[ChatPane] Sending chat request with thread_id:', request.thread_id, 'currentThread:', currentThread?.id);

      // Send user message immediately
      await transmitter.sendUserMessage(userMsg, thread, isOnline, thread.currentBranchId);

      // Use chatWithFileTools for all requests - tools are invisible to user
      const result = await window.electronAPI.chat.chatWithFileTools(request) as { success: boolean; error?: string };

      if (!result.success) {
        error = result.error || 'Chat failed';
        console.error('Chat failed:', result.error);
        isStreaming = false;
        return;
      }
      
      // After streaming completes, handle assistant response
      // IMPORTANT: Use the backend-assigned user message ID (from the persisted message), not the optimistic one
      // The userMsg.id is the optimistic ID - we need to get the actual backend ID
      if (currentThread) {
        const persistedUserMessages = await threadService.getMessages(currentThread.id);
        const actualUserMessage = persistedUserMessages.find(m => 
          m.clientMessageId === userMsg.clientMessageId || 
          (m.content === userMessage && m.role === 'user' && Math.abs(m.createdAt - userMsg.createdAt) < 5000)
        );
        
        // Use the backend-assigned user message for the assistant's parent
        const assistantParentMessage = actualUserMessage || userMsg;
        console.log('[ChatPane] Using user message ID for assistant parent:', assistantParentMessage.id, '(optimistic:', userMsg.id, ')');
        
        await transmitter.handleAssistantResponse(responseText, currentThread, userMessage, assistantParentMessage);
      } else {
        await transmitter.handleAssistantResponse(responseText, currentThread, userMessage, userMsg);
      }
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

  async function handleSubmitVariation(content: string, branchType: BranchType, modelIds: string[]) {
    if (!currentThread || !showVariationModalFor) return;

    isCreatingVariation = true;
    variationError = '';

    try {
      console.log('[ChatPane] Creating variation from message:', showVariationModalFor.id, 'content:', content);
      
      // Refresh messages from backend to ensure we have the latest backend-assigned IDs
      // This is critical because optimistic messages may have client-generated IDs that don't exist in backend
      const refreshedMessages = await threadService.getMessages(currentThread.id);
      messages = refreshedMessages;
      
      // Find the message again with refreshed data
      // Try to match by ID first (backend-assigned), then by clientMessageId (if optimistic)
      let messageForVariation = messages.find(m => m.id === showVariationModalFor!.id);
      if (!messageForVariation && showVariationModalFor!.clientMessageId) {
        // Fallback: try to find by clientMessageId
        messageForVariation = messages.find(m => m.clientMessageId === showVariationModalFor!.clientMessageId);
      }
      
      if (!messageForVariation) {
        variationError = 'Original message not found in backend. The message may not have been saved yet. Please wait a moment and try again.';
        console.error('[ChatPane] Message not found after refresh. Original ID:', showVariationModalFor!.id, 'clientMessageId:', showVariationModalFor!.clientMessageId);
        return;
      }
      
      console.log('[ChatPane] Using refreshed message for variation. Backend ID:', messageForVariation.id, 'clientMessageId:', messageForVariation.clientMessageId);
      
      // For prompt variations, create a single variation
      if (branchType === 'prompt-variation') {
        const result = await threadService.createVariation(
          currentThread.id,
          messageForVariation.id,
          content,
          branchType,
          null,
          messages,
        );

        if (!result.success) {
          variationError = result.error;
          console.error('[ChatPane] Failed to create variation:', result.error);
          return;
        }

        messages = [...messages, result.message];
        showVariationModalFor = null;
        await generateResponseForVariation(result.message);
      } else {
        // For model variations, create one variation per selected model
        const createdMessages: Message[] = [];
        
        for (const modelId of modelIds) {
          const result = await threadService.createVariation(
            currentThread.id,
            messageForVariation.id,
            content,
            branchType,
            modelId,
            messages,
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
    }
  }

  async function generateResponseForVariation(userMessage: Message) {
    if (!currentThread) return;

    // Use a local variable to capture response text for this specific variation
    let variationResponseText = '';
    const branchIndex = userMessage.branchIndex ?? null;

    try {
      // Track streaming state for this specific branch
      isStreaming = true;
      streamingBranchIndex = branchIndex;
      // Initialize streaming text for this branch
      streamingTextByBranch.set(branchIndex, '');
      
      // Set up token listener that captures to local variable and updates branch-specific streaming text
      // When running in parallel, each variation will update its own branch's streaming text
      window.electronAPI.chat.offToken();
      window.electronAPI.chat.onToken((token: string) => {
        variationResponseText = variationResponseText + token;
        // Update branch-specific streaming text
        streamingTextByBranch.set(branchIndex, variationResponseText);
        // Also update shared responseText for backward compatibility
        responseText = variationResponseText;
        scrollToBottom('auto');
        if (streamingMessageEl) {
          streamingMessageEl.scrollIntoView({ block: 'end', behavior: 'auto' });
        }
      });

      // For variations, only send the variation question to avoid confusion
      // The AI should treat each variation as a separate conversation
      const historyMessages = [{
        role: 'user' as const,
        content: userMessage.content,
      }];

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

      const request = {
        messages: historyMessages,
        streaming: true,
        model: modelToUse,
        ...(currentThread?.id && { thread_id: currentThread.id }),
      };

      // For variations, use plain chat (no tools) to avoid long-running tool loops
      const result = await window.electronAPI.chat.chat(request);

      if (!result.success) {
        error = result.error || 'Chat failed';
        console.error('[ChatPane] Variation chat failed:', result.error);
        return;
      }

      // Wait a bit to ensure all tokens are received
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Save assistant response as part of the variation branch
      // The assistant response should be a child of the variation user message
      const metadata = {
        parentMessageId: userMessage.id,
        branchIndex: userMessage.branchIndex,
      };
      const assistantPersist = await threadService.appendMessage(currentThread.id, {
        role: 'assistant',
        content: variationResponseText,
        metadata,
        clientMessageId: crypto.randomUUID(),
      });

      const assistantMsg: Message = {
        id: assistantPersist.success ? assistantPersist.message.id : crypto.randomUUID(),
        role: 'assistant',
        content: variationResponseText,
        createdAt: assistantPersist.success ? assistantPersist.message.createdAt : Date.now(),
        parentMessageId: userMessage.id,
        branchIndex: userMessage.branchIndex,
        branchType: userMessage.branchType,
        modelId: userMessage.modelId,
      };

      // Add assistant message to the local messages array
      messages = [...messages, assistantMsg];
      
      // Clear streaming text for this branch
      streamingTextByBranch.delete(branchIndex);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ChatPane] Error generating variation response:', err);
      // Clear streaming text on error
      streamingTextByBranch.delete(branchIndex);
    } finally {
      // When running in parallel, multiple variations may be streaming
      // Check if any branches are still streaming
      const hasStreamingBranches = streamingTextByBranch.size > 0;
      if (!hasStreamingBranches) {
        isStreaming = false;
        streamingBranchIndex = null;
        responseText = '';
      } else if (streamingBranchIndex === branchIndex) {
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

  // Lifecycle hooks
  onMount(() => {
    outboxService.init();

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
    const needsReinit = !currentProviderConfig ||
      currentProviderConfig.provider !== newConfig.provider ||
      currentProviderConfig.url !== newConfig.url ||
      currentProviderConfig.model !== newConfig.model;

    if (needsReinit) {
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
      const userMessage = userMessages[0];
      const initialPrompt = userMessage.content;

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
            ...(currentThread?.id && { thread_id: currentThread.id }),
          };

          // Use chatWithFileTools for all requests - tools are invisible to user
          const result = await window.electronAPI.chat.chatWithFileTools(request) as { success: boolean; error?: string };

          if (!result.success) {
            error = result.error || 'Chat failed';
            console.error('Chat failed:', result.error);
          } else {
            await transmitter.handleAssistantResponse(responseText, currentThread, initialPrompt, undefined);
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
                  onSelect={() => {}}
                  hideHeader={false}
                  streamingText={streamingTextByBranch.get(box.branchIndex) ?? null}
                  onSendMessage={sendMessageInBranch}
                  isStreaming={isStreaming && streamingBranchIndex === box.branchIndex}
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
            <div class="branch-boxes-vertical">
              {#each branchBoxes as box (box.branchIndex)}
                <BranchLane
                  userMessage={box.userMessage}
                  assistantMessage={box.assistantMessage}
                  branchIndex={box.branchIndex}
                  isSelected={activeBranchIndex === box.branchIndex}
                  onSelect={() => setActiveBranch(box.branchIndex)}
                  hideHeader={false}
                  streamingText={streamingTextByBranch.get(box.branchIndex) ?? null}
                  onSendMessage={sendMessageInBranch}
                  isStreaming={isStreaming && streamingBranchIndex === box.branchIndex}
                  allMessages={box.allMessages}
                />
              {/each}
              
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
        {@render composer({ sendMessage, isStreaming })}
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

  .branch-boxes-vertical {
    display: flex;
    flex-direction: row;
    gap: 24px;
    align-items: stretch;
    margin-top: 1rem;
    overflow-x: auto;
    overflow-y: visible;
    scroll-behavior: smooth;
    padding-bottom: 8px;
    /* Hide scrollbar but keep functionality */
    scrollbar-width: thin;
    scrollbar-color: var(--surface-border) transparent;
  }

  .branch-boxes-vertical::-webkit-scrollbar {
    height: 8px;
  }

  .branch-boxes-vertical::-webkit-scrollbar-track {
    background: transparent;
  }

  .branch-boxes-vertical::-webkit-scrollbar-thumb {
    background: var(--surface-border);
    border-radius: 4px;
  }

  .branch-boxes-vertical::-webkit-scrollbar-thumb:hover {
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


