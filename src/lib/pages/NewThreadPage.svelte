<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import type { ModelDetails } from '../../../src-electron/preload';
  import ThreadCreatePanel from '$lib/components/threads/ThreadCreatePanel.svelte';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import { threadService } from '$lib/services/thread.service';

  let selectedModel: ModelDetails | null = $state(null);
  let newThreadPrompt = $state('');
  let errorMessage = $state<string | null>(null);

  // Auth guard: redirect to login if not authenticated
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to create threads.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

  function handleModelSelect(event: CustomEvent<ModelDetails>) {
    selectedModel = event.detail;
  }

  async function handleSave() {
    if (!selectedModel || !newThreadPrompt.trim()) {
      toastStore.show('Please select a model and enter a prompt', { variant: 'error' });
      return;
    }

    try {
      // Create the thread using thread service
      const thread = await threadService.create({
       title: newThreadPrompt.substring(0, 50) + (newThreadPrompt.length > 50 ? '...' : ''),
        description: '',
        status: THREAD_STATUS.ACTIVE,
        currentBranchId: '1.0',
        metadata: {
          modelTitle: selectedModel.title,
          modelProvider: selectedModel.provider,
          modelId: selectedModel.id,
        },
      });

      if (!thread || !thread.id) {
        throw new Error('Failed to create thread');
      }

      // Navigate to the new thread page (ThreadPage with ThreadChatView)
      const params = new URLSearchParams();
      params.set('threadId', thread.id);
      params.set('prompt', newThreadPrompt);
      push(`${ROUTE.THREAD}?${params.toString()}`);
    } catch (error) {
      console.error('Failed to create thread:', error);
      const message = error instanceof Error ? error.message : 'Failed to create thread';
      toastStore.show(message, { variant: 'error' });
      // Stay on the page - don't navigate
    }
  }
</script>

<div class="new-thread-page">
  {#if errorMessage}
    <div class="error-banner">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{errorMessage}</span>
      <button class="error-close" onclick={() => (errorMessage = null)} aria-label="Dismiss error">
        <i class="pi pi-times"></i>
      </button>
    </div>
  {/if}

  <ThreadCreatePanel
    bind:selectedModel
    bind:newThreadPrompt
    on:modelSelect={handleModelSelect}
    on:save={handleSave}
  />
</div>

<style>
  .new-thread-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--error-bg);
    color: var(--error-color);
    border: 1px solid var(--error-color);
    border-radius: 0.5rem;
    margin: 1rem;
  }

  .error-banner i.pi-exclamation-triangle {
    font-size: 1.25rem;
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
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: background-color 0.15s ease;
  }

  .error-close:hover {
    background: rgba(0, 0, 0, 0.1);
  }
</style>
