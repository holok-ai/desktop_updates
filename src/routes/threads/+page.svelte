<script lang="ts">
  import { onMount } from 'svelte';
  import { threads } from '../../lib/stores/thread.store';
  import { threadService } from '../../lib/services/thread.service';
  import type { Thread } from '../../../src-electron/preload';
  import { router } from '$lib/services/router.service';
  import { THREAD_STATUS, type ThreadStatus } from '$lib/constants/status.constant';
  import { ROUTE } from '$lib/constants/route.constant';
  import ChatPane from '../../lib/components/ChatPane.svelte';
  import Composer from '../../lib/components/Composer.svelte';

  let isLoading = $state(true);
  let showDialog = $state(false);
  let editingThread: Thread | null = $state(null);

  let formData: {
    title: string;
    description: string;
    status: ThreadStatus;
  } = $state({
    title: '',
    description: '',
    status: THREAD_STATUS.ACTIVE,
  });

  let selectedThread: Thread | null = null;
  type Msg = { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: number };
  let messages: Msg[] = [];

  onMount(async () => {
    await loadThreads();
  });

  $effect(() => {
    const unsubscribe = router.current.subscribe((route) => {
      const shouldOpenDialog =
        route.path === ROUTE.THREADS &&
        route.params.get('openCreateDialog') === 'true';
      if (shouldOpenDialog && !showDialog) {
        openCreateDialog();
        router.navigate(ROUTE.THREADS, undefined, { replace: true });
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
    formData = { title: '', description: '', status: 'active' };
    showDialog = true;
  }

  function openEditDialog(thread: Thread) {
    editingThread = thread;
    formData = {
      title: thread.title,
      description: thread.description,
      status: thread.status,
    };
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

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this thread?')) {
      try {
        await threadService.delete(id);
      } catch (error) {
        console.error('Failed to delete thread:', error);
      }
    }
  }

  function handleSendEvent(e: CustomEvent) {
    // accept either a string detail or an object with { content }
    const detail = e.detail as any;
    const content: string = typeof detail === 'string' ? detail : detail?.content;
    if (!selectedThread || !content) return;

    // Persist user prompt via IPC
    window.electronAPI.thread
      .addUserPrompt(selectedThread.id, content)
      .then((res) => {
        // update selected thread and messages
        selectedThread = res.thread;
        messages = [...messages, { id: res.message.id, role: res.message.role as any, content: res.message.content, createdAt: res.message.createdAt }];

        // Simulate assistant response by adding assistant message via IPC
        setTimeout(async () => {
          const resp = await window.electronAPI.thread.addAssistantResponse(res.thread.id, 'Echo: ' + content);
          messages = [...messages, { id: resp.id, role: resp.role as any, content: resp.content, createdAt: resp.createdAt }];
        }, 400);
      })
      .catch((err) => console.error('Failed to send prompt:', err));
  }
</script>

<div class="threads-page">
    <div class="header">
    <h1>Threads</h1>
    <button onclick={openCreateDialog}>New Thread</button>
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
      <div class="threads-list">
        {#each $threads as thread (thread.id)}
          <div class="thread-card" role="button" tabindex="0" onclick={() => selectThread(thread)} onkeydown={(e) => e.key === 'Enter' && selectThread(thread)}>
            <div class="thread-header">
              <h3>{thread.title}</h3>
              <span class="status status-{thread.status}">{thread.status}</span>
            </div>
            <p>{thread.description}</p>
            <div class="thread-actions">
              <button onclick={(e) => { e.stopPropagation(); openEditDialog(thread); }}>Edit</button>
              <button class="danger" onclick={(e) => { e.stopPropagation(); handleDelete(thread.id); }}>Delete</button>
            </div>
          </div>
        {/each}
      </div>

      <div class="chat-column">
        <ChatPane thread={selectedThread} messages={messages} />
        <div class="composer-slot">
          <Composer onSend={(e: CustomEvent) => handleSendEvent(e)} />
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showDialog}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={() => (showDialog = false)} tabindex="0" role="dialog">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} tabindex="0" role="button">
      <h2>{editingThread ? 'Edit Thread' : 'Create Thread'}</h2>

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

      <div class="dialog-actions">
        <button onclick={() => (showDialog = false)}>Cancel</button>
        <button class="primary" onclick={handleSave}>
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

  .header h1 {
    color: #333;
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
  .threads-list {
    width: 360px;
    max-height: 70vh;
    overflow: auto;
    display: grid;
    gap: 1rem;
  }

  .chat-column { flex: 1; height: 70vh; }

  .thread-card {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .thread-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 1rem;
  }

  .thread-header h3 {
    margin: 0;
    color: #333;
  }

  .thread-card p {
    color: #666;
  }

  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-active {
    background: #22c55e;
    color: white;
  }

  .status-archived {
    background: #6b7280;
    color: white;
  }

  .thread-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .thread-actions button {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.875rem;
  }

  .danger {
    background: #ef4444;
    color: white;
  }

  .danger:hover {
    background: #dc2626;
  }

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

  .dialog h2 {
    margin-bottom: 1.5rem;
    color: #333;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #333;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    background: white;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    color: #333;
    font-family: inherit;
    font-size: 1rem;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #646cff;
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
