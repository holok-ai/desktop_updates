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

  // ── State ──
  let threadId = $state<string | null>(null);
  let threadTitle = $state('');
  let activeView = $state<ThreadViewType>('chat');
  let chatLayout = $state<ChatLayout>(CHAT_LAYOUT.LEFT_RIGHT as ChatLayout);

  // ── Parse query string ──
  $effect(() => {
    const qs = $querystring;
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('threadId');
      if (id) {
        threadId = id;
      }
    }
  });

  // ── Load settings on mount ──
  onMount(async () => {
    try {
      const settings = await window.electronAPI.settings.getAll();
      if (settings?.chatLayout) {
        chatLayout = settings.chatLayout as ChatLayout;
      }
    } catch (e) {
      console.warn('[ThreadPage] Could not load settings:', e);
    }
  });
</script>

<div class="thread-page">
  <ThreadPageHeader {threadId} bind:title={threadTitle} />

  <ThreadViewSelector bind:activeView />

  <div class="view-container">
    {#if activeView === 'chat'}
      <ThreadChatView {threadId} {chatLayout} />
    {:else if activeView === 'prompt'}
      <ThreadPromptView />
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
</style>
