<script lang="ts">
  /**
   * ThreadPage — vertical stack:
   *   ThreadPageHeader → ThreadViewSelector → [active view] → ThreadPageFooter
   *
   * Route: /thread?threadId=...  (or /thread?appSlug=...&modelSlug=...&prompt=...)
   * ChatLayout loaded from settings on mount.
   */
  import { onMount } from 'svelte';
  import { querystring } from 'svelte-spa-router';

  import ThreadPageHeader from '$lib/components/thread/ThreadPageHeader.svelte';
  import ThreadViewSelector from '$lib/components/thread/ThreadViewSelector.svelte';
  import type { ThreadViewType } from '$lib/components/thread/ThreadViewSelector.svelte';
  import ThreadPageFooter from '$lib/components/thread/ThreadPageFooter.svelte';

  // Views
  import ThreadChatView from '$lib/components/thread/views/ThreadChatView.svelte';
  import ThreadPromptView from '$lib/components/thread/views/ThreadPromptView.svelte';
  import ThreadGraphicView from '$lib/components/thread/views/ThreadGraphicView.svelte';
  import ThreadExecutionView from '$lib/components/thread/views/ThreadExecutionView.svelte';
  import ThreadFileView from '$lib/components/thread/views/ThreadFileView.svelte';

  import type { ChatLayout } from '$lib/types/app.type';
  import { CHAT_LAYOUT } from '$lib/constants/app.constant';
  import type { Thread, ModelDetails } from '../../../src-electron/preload';
  import type { Message } from '$lib/types/thread.type';
  import { threadService } from '$lib/services/thread.service';

  // ── State ──
  let threadId = $state<string | null>(null);
  let thread = $state<Thread | null>(null);
  let threadTitle = $state('');
  let messages = $state<Message[]>([]);
  let availableModels = $state<ModelDetails[]>([]);
  let initialPrompt = $state<string | null>(null);
  let activeView = $state<ThreadViewType>('chat');
  let chatLayout = $state<ChatLayout>(CHAT_LAYOUT.LEFT_RIGHT as ChatLayout);
  let loading = $state(false);
  let error = $state('');

  /** Called by ThreadChatView when a brand-new thread is created */
  function handleThreadCreated(newThread: Thread) {
    threadId = newThread.id;
    thread = newThread;
    threadTitle = newThread.title || 'New Thread';
    // Messages will be added as they're sent
  }

  /** Called by ThreadChatView when messages are updated */
  function handleMessagesUpdate(updatedMessages: Message[]) {
    messages = updatedMessages;
  }

  // ── Load thread and messages when threadId changes ──
  async function loadThread(id: string) {
    loading = true;
    error = '';
    try {
      // Load thread metadata
      const t = await threadService.getThread(id);
      if (!t) {
        error = 'Thread not found';
        thread = null;
        threadTitle = '';
        messages = [];
        return;
      }
      thread = t;
      threadTitle = t.title || 'Untitled Thread';

      // Load messages for this thread
      const msgs = await threadService.getMessages(id);
      messages = msgs;
    } catch (e) {
      console.error('[ThreadPage] Failed to load thread:', e);
      error = e instanceof Error ? e.message : 'Failed to load thread';
      thread = null;
      threadTitle = '';
      messages = [];
    } finally {
      loading = false;
    }
  }

  // ── Parse query string and load thread ──
  $effect(() => {
    const qs = $querystring;
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('threadId');
      const prompt = params.get('prompt');

      if (id && id !== threadId) {
        threadId = id;
        void loadThread(id);
      } else if (!id) {
        // No threadId - reset to new thread state
        threadId = null;
        thread = null;
        threadTitle = '';
        messages = [];
      }

      if (prompt) {
        initialPrompt = prompt;
      }
    }
  });

  // ── Load settings and models on mount ──
  onMount(async () => {
    try {
      const settings = await window.electronAPI.settings.getAll();
      if (settings?.chatLayout) {
        chatLayout = settings.chatLayout as ChatLayout;
      }
    } catch (e) {
      console.warn('[ThreadPage] Could not load settings:', e);
    }

    // Load available models
    try {
      availableModels = await window.electronAPI.models.listAll();
    } catch (e) {
      console.warn('[ThreadPage] Could not load models:', e);
    }
  });
</script>

<div class="thread-page">
  <ThreadPageHeader {threadId} bind:title={threadTitle} />

  <ThreadViewSelector bind:activeView />

  <div class="view-container">
    {#if loading}
      <div class="loading-state">Loading thread...</div>
    {:else if error}
      <div class="error-state">{error}</div>
    {:else if activeView === 'chat'}
      <ThreadChatView {thread} bind:messages {availableModels} {chatLayout} {initialPrompt} onThreadCreated={handleThreadCreated} />
    {:else if activeView === 'prompt'}
      <ThreadPromptView {messages} {chatLayout} />
    {:else if activeView === 'graphic'}
      <ThreadGraphicView />
    {:else if activeView === 'execution'}
      <ThreadExecutionView />
    {:else if activeView === 'file'}
      <ThreadFileView />
    {/if}
  </div>

  <ThreadPageFooter />
</div>

<style>
  .thread-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main, #fafafa);
    overflow: hidden;
  }

  .view-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 2rem;
    color: var(--text-secondary, #666);
  }

  .error-state {
    color: var(--error-color, #dc2626);
  }
</style>
