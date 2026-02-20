<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { threads } from '../stores/thread.store';
  import { threadService } from '../services/thread.service';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import ThreadListItem from '$lib/components/threads/ThreadListItem.svelte';
  import { ROUTE } from '$lib/constants/route.constant';

  let isLoading = $state(true);
  let searchQuery = $state('');

  // Auth guard: redirect to login if not authenticated
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to access Threads.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

  // Load threads on mount
  onMount(async () => {
    try {
      await threadService.getAll({ updateStore: true });
    } catch (error) {
      console.error('[ThreadListPage] Failed to load threads:', error);
      toastStore.show('Failed to load threads', { variant: 'error' });
    } finally {
      isLoading = false;
    }
  });

  // Navigate to application thread page
  function handleNewThread() {
    push(ROUTE.NEW_THREAD);
  }

  // Filter to show only personal threads (no projectId), then apply search
  const personalThreads = $derived(() => {
    const query = searchQuery.trim().toLowerCase();
    return $threads
      .filter((t) => !t.projectId)
      .filter((t) => !query || (t.title ?? '').toLowerCase().includes(query));
  });
</script>

<div class="threads-page">
  <div class="page-header">
    <h1>Threads</h1>
    <button class="new-thread-button" onclick={handleNewThread}>
      <i class="pi pi-plus"></i>
      New Thread
    </button>
  </div>

  <div class="search-bar">
    <i class="pi pi-search"></i>
    <input type="text" placeholder="Search threads..." bind:value={searchQuery} />
  </div>

  {#if isLoading}
    <div class="loading-state">
      <p>Loading threads...</p>
    </div>
  {:else if personalThreads().length > 0}
    <div class="threads-section">
      <div class="threads-list">
        {#each personalThreads() as thread (thread.id)}
          <ThreadListItem {thread} />
        {/each}
      </div>
    </div>
  {:else if searchQuery.trim()}
    <div class="empty-threads">
      <i class="pi pi-search"></i>
      <p>No threads match "{searchQuery.trim()}".</p>
    </div>
  {:else}
    <div class="empty-threads">
      <i class="pi pi-comments"></i>
      <p>No threads yet. Create your first thread to get started.</p>
      <button class="create-first-button" onclick={handleNewThread}>
        <i class="pi pi-plus"></i>
        Create Thread
      </button>
    </div>
  {/if}
</div>

<style>
  .threads-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .new-thread-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .new-thread-button:hover {
    background: var(--primary-color-hover);
  }

  .new-thread-button i {
    font-size: 0.875rem;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    margin-bottom: 1.25rem;
  }

  .search-bar i {
    color: var(--text-secondary);
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .search-bar input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .search-bar input::placeholder {
    color: var(--text-secondary);
  }

  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    color: var(--text-secondary);
  }

  .threads-section {
    flex: 1;
  }

  .threads-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty-threads {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-threads i {
    font-size: 3rem;
    opacity: 0.4;
  }

  .empty-threads p {
    margin: 0;
    font-size: 1rem;
  }

  .create-first-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    margin-top: 1rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .create-first-button:hover {
    background: var(--primary-color-hover);
  }

  .create-first-button i {
    font-size: 0.875rem;
  }
</style>
