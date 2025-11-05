<script lang="ts">
  import { onMount } from 'svelte';
  import { threads } from '../../lib/stores/thread.store';
  import { threadService } from '../../lib/services/thread.service';
  import type { Thread } from '../../../src-electron/preload';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import { querystring, replace } from 'svelte-spa-router';
  import ChatPane from '../../lib/components/ChatPane.svelte';
  import Composer from '../../lib/components/Composer.svelte';
  import ModelChooser from '../../lib/components/ModelChooser.svelte';
  import type { MokuModel } from '../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';

  let isLoading = $state(true);
  let showDialog = $state(false);
  let editingThread: Thread | null = $state(null);

  let formData: Thread = $state({
    id: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    title: '',
    description: '',
    status: THREAD_STATUS.ACTIVE,
  });

  let selectedModel: MokuModel | null = $state(null);
  let chooserInitial: { provider: string; id: string } | null = $state(null);

  let selectedThread: Thread | null = $state(null);
  type Msg = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
  };
  let messages: Msg[] = $state([]);

  onMount(async () => {
    await loadThreads();
  });

  $effect(() => {
    const unsubscribe = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');
      if (params.has('create') && !showDialog) {
        openCreateDialog();
        void replace(ROUTE.THREADS);
      }
      const threadId = params.get('threadId');
      if (threadId) {
        const found = $threads.find((thread) => thread.id === threadId);
        if (found) {
          selectThread(found);
        }
      }
    });
    return unsubscribe;
  });

  async function loadThreads() {
    isLoading = true;
    try {
      await threadService.getAll();
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      isLoading = false;
    }
  }

  function openCreateDialog() {
    editingThread = null;
    formData = {
      id: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      title: '',
      description: '',
      status: THREAD_STATUS.ACTIVE,
    };
    // Reset model selection for new thread
    selectedModel = null;
    chooserInitial = null;
    formData.metadata = {};
    showDialog = true;
  }

  function selectThread(thread: Thread) {
    selectedThread = thread;
    // reset messages for now (will be wired to IPC in a later task)
    messages = [];
  }

  async function handleSave() {
    try {
      const data = $state.snapshot(formData);
      // Ensure model selection is included in metadata if chosen
      if (selectedModel) {
        const merged = {
          ...((data.metadata as Record<string, unknown>) ?? {}),
          model: selectedModel.id,
          provider: selectedModel.provider,
        } as Record<string, unknown>;
        // Cast to any because Svelte $state snapshot can produce narrower types
        (data as any).metadata = merged;
      }

      if (editingThread) {
        await threadService.update(editingThread.id, data);
      } else {
        await threadService.create(data);
      }
      showDialog = false;
    } catch (error) {
      console.error('Failed to save thread:', error);
    }
  }
</script>

<div class="threads-page">
  <div class="header">
    <h1>Threads</h1>
  </div>

  {#if isLoading}
    <div class="loading">Loading threads...</div>
  {:else if $threads.length === 0}
    <div class="empty">
      <p>No threads yet. Create your first thread!</p>
      <button onclick={openCreateDialog}>Create Thread</button>
    </div>
  {:else}
    <div class="threads-grid">
      <div class="w-full">
        <ChatPane thread={selectedThread} {messages}>
          {#snippet composer({ sendMessage, isStreaming })}
            {#if selectedThread}
              <Composer {sendMessage} {isStreaming} />
            {/if}
          {/snippet}
        </ChatPane>
      </div>
    </div>
  {/if}
</div>

{#if showDialog}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={() => (showDialog = false)} tabindex="0" role="dialog">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} tabindex="0" role="button">
      <h2 class="mb-6">{editingThread ? 'Edit Thread' : 'Create Thread'}</h2>

      <div class="form-group">
        <label for="title">Title</label>
        <input
          id="title"
          type="text"
          bind:value={formData.title}
          placeholder="Enter thread title"
        />
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          bind:value={formData.description}
          placeholder="Enter thread description"
          rows="4"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="status">Status</label>
        <select id="status" bind:value={formData.status}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div class="form-group">
        <span>Model</span>
        <ModelChooser
          initialSelection={chooserInitial}
          on:modelSelected={(e) => {
            // e.detail is the selected MokuModel
            const m = (e as CustomEvent).detail as any;
            if (m) {
              selectedModel = m;
              formData.metadata = {
                ...(formData.metadata ?? {}),
                model: m.id,
                provider: m.provider,
              };
            }
          }}
        />
      </div>

      <div class="dialog-actions">
        <button class="text-white" onclick={() => (showDialog = false)}>Cancel</button>
        <button
          class="primary"
          onclick={handleSave}
          disabled={!editingThread && !selectedModel}
          aria-disabled={!editingThread && !selectedModel}
        >
          {editingThread ? 'Confirm Update' : 'Confirm Create'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .threads-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .loading,
  .empty {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .empty button {
    margin-top: 1rem;
  }

  .threads-grid { display: flex; gap: 1rem }

  /* Dialog styles */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .dialog {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    min-width: 500px;
    max-width: 90%;
    border: 1px solid #e0e0e0;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 1rem;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #646cff;
  }

  .dialog {
    background: var(--surface-main);
    border: 1px solid var(--border-sidebar);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }

  .dialog-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
  }

  .dialog-actions button {
    padding: 0.75rem 1.5rem;
  }

  .primary {
    background: #646cff;
    color: white;
  }

  .primary:hover {
    background: #535bf2;
  }
</style>
