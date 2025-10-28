<script lang="ts">
  import { onMount } from 'svelte';
  import { threads } from '../../lib/stores/thread.store';
  import { threadService } from '../../lib/services/thread.service';
  import type { Thread } from '../../../src-electron/preload';

  let isLoading = true;
  let showDialog = false;
  let editingThread: Thread | null = null;

  let formData: {
    title: string;
    description: string;
    status: 'active' | 'archived' | 'deleted';
  } = {
    title: '',
    description: '',
    status: 'active',
  };

  onMount(async () => {
    await loadThreads();
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

  async function handleSave() {
    try {
      if (editingThread) {
        await threadService.update(editingThread.id, formData);
      } else {
        await threadService.create(formData);
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
    <div class="threads-list">
      {#each $threads as thread (thread.id)}
        <div class="thread-card">
          <div class="thread-header">
            <h3>{thread.title}</h3>
            <span class="status status-{thread.status}">{thread.status}</span>
          </div>
          <p>{thread.description}</p>
          <div class="thread-actions">
            <button onclick={() => openEditDialog(thread)}>Edit</button>
            <button class="danger" onclick={() => handleDelete(thread.id)}>Delete</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showDialog}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={() => (showDialog = false)}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()}>
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
          {editingThread ? 'Update' : 'Create'}
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

  .threads-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

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
