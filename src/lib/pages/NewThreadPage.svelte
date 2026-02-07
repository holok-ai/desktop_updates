<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import type { Thread, ModelDetails } from '../../../src-electron/preload';
  import ThreadCreatePanel from '$lib/components/threads/ThreadCreatePanel.svelte';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import { storageService } from '$lib/services/storage.service';
  import {
    setUnsavedChanges,
    clearUnsavedChanges,
    registerDiscardCallback,
  } from '$lib/stores/navigation-guard.store';

  let formData: Thread = $state({
    id: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    title: '',
    description: '',
    status: THREAD_STATUS.ACTIVE,
    currentBranchId: '1.0',
    messages: []
  });

  let selectedModel: ModelDetails | null = $state(null);
  let chooserInitial: string | null = $state(null);
  let newThreadPrompt = $state('');
  let modelSelectionTouched = $state(false);
  let errorMessage = $state<string | null>(null);

  // Auth guard: redirect to login if not authenticated
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to create threads.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

  // Track unsaved changes
  $effect(() => {
    const dirty = newThreadPrompt.trim().length > 0 || modelSelectionTouched;
    setUnsavedChanges('new-thread', dirty);
  });

  // Register cleanup callback
  onMount(() => {
    // Clear any selected thread
    storageService.removeLastThreadId();

    registerDiscardCallback('new-thread', () => {
      newThreadPrompt = '';
      selectedModel = null;
      modelSelectionTouched = false;
    });

    return () => {
      clearUnsavedChanges('new-thread');
    };
  });

  function handleModelSelect(event: CustomEvent<ModelDetails>) {
    selectedModel = event.detail;
    modelSelectionTouched = true;
  }

  async function handleSave() {
    if (!selectedModel || !newThreadPrompt.trim()) {
      errorMessage = 'Please select a model and enter a prompt';
      return;
    }

    try {
      // Create the thread
      const result = await window.electronAPI.threads.create({
        title: 'New Thread',
        description: '',
        status: THREAD_STATUS.ACTIVE,
        metadata: {
          modelTitle: selectedModel.title,
          modelProvider: selectedModel.provider,
          modelId: selectedModel.id,
        },
      });

      if (!result.success || !result.thread) {
        throw new Error(result.error || 'Failed to create thread');
      }

      const threadId = result.thread.id;

      // Send the initial message
      await window.electronAPI.chat.sendMessage({
        threadId,
        branchId: '1.0',
        content: newThreadPrompt,
        modelId: selectedModel.id,
      });

      // Clear unsaved changes
      clearUnsavedChanges('new-thread');

      // Navigate to the new thread
      push(`${ROUTE.THREADS}?threadId=${threadId}`);
    } catch (error) {
      console.error('Failed to create thread:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to create thread';
    }
  }

  function handleCancel() {
    clearUnsavedChanges('new-thread');
    push(ROUTE.THREADS);
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
    bind:formData
    bind:selectedModel
    bind:newThreadPrompt
    bind:chooserInitial
    on:modelSelect={handleModelSelect}
    on:save={handleSave}
    on:cancel={handleCancel}
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
