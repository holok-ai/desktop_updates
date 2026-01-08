<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { threadService } from '$lib/services/thread.service';
  import ThreadListItem from '$lib/components/common/ThreadListItem.svelte';
  import type { Thread } from '../../../../../src-electron/preload';

  let { projectId, reloadToken }: { projectId: string; reloadToken: number } = $props();

  const dispatch = createEventDispatcher<{
    threadClick: { id: string; label: string; route?: string };
    newThread: void;
    threadDelete: { id: string };
    threadCountChanged: { count: number };
    error: { message: string };
  }>();

  let threadsLoading = $state(false);
  let projectThreads = $state<Thread[]>([]);

  async function loadProjectThreads(): Promise<void> {
    if (!projectId) return;
    threadsLoading = true;

    try {
      projectThreads = await threadService.getAll({
        projectId,
        updateStore: true,
      });
      dispatch('threadCountChanged', { count: projectThreads.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project threads';
      dispatch('error', { message });
      // Keep UI resilient
      projectThreads = [];
      dispatch('threadCountChanged', { count: 0 });
    } finally {
      threadsLoading = false;
    }
  }

  // Load on project change and on explicit refresh token bump
  $effect(() => {
    if (projectId) {
      void loadProjectThreads();
    }
  });

  $effect(() => {
    // reloadToken is a "signal" used by parent to request reload
    void reloadToken;
    if (projectId) {
      void loadProjectThreads();
    }
  });

  // Keep list reactive to thread events (so we don't need full reload after local actions)
  $effect(() => {
    if (!projectId) return;

    const offCreated = window.electronAPI.thread.onThreadCreated((newThread) => {
      const threadProjectId = newThread.metadata?.projectId;
      if (threadProjectId === projectId) {
        projectThreads = [newThread, ...projectThreads].sort((a, b) => {
          const aTime = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
          const bTime = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
        dispatch('threadCountChanged', { count: projectThreads.length });
      }
    });

    const offUpdated = window.electronAPI.thread.onThreadUpdated((updatedThread) => {
      projectThreads = projectThreads.map((t) => (t.id === updatedThread.id ? updatedThread : t));
    });

    const offDeleted = window.electronAPI.thread.onThreadDeleted((threadId) => {
      projectThreads = projectThreads.filter((t) => t.id !== threadId);
      dispatch('threadCountChanged', { count: projectThreads.length });
    });

    return () => {
      if (offCreated) offCreated();
      if (offUpdated) offUpdated();
      if (offDeleted) offDeleted();
    };
  });

  function handleNewThread(): void {
    dispatch('newThread');
  }

  function handleThreadClick(event: CustomEvent<{ id: string; label: string; route?: string }>): void {
    dispatch('threadClick', event.detail);
  }

  function handleThreadDelete(event: CustomEvent<{ id: string }>): void {
    dispatch('threadDelete', event.detail);
  }
</script>

{#if threadsLoading}
  <div class="loading-state">
    <i class="pi pi-spin pi-spinner"></i>
    <span>Loading threads...</span>
  </div>
{:else if projectThreads.length === 0}
  <div class="empty-state">
    <i class="pi pi-comments"></i>
    <h3>No threads yet</h3>
    <p>Create a new thread to get started with this project</p>
    <button class="btn-primary" onclick={handleNewThread}>
      <i class="pi pi-plus"></i>
      <span>New Thread</span>
    </button>
  </div>
{:else}
  <div class="thread-list-header">
    <h2 class="thread-list-title">Threads ({projectThreads.length})</h2>
    <button class="btn-primary" onclick={handleNewThread}>
      <i class="pi pi-plus"></i>
      <span>New Thread</span>
    </button>
  </div>
  <div class="thread-list">
    {#each projectThreads as thread (thread.id)}
      <ThreadListItem
        {thread}
        isSelected={false}
        showActions={true}
        on:click={handleThreadClick}
        on:delete={handleThreadDelete}
      />
    {/each}
  </div>
{/if}

<style>
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .loading-state i {
    font-size: 2rem;
  }

  .thread-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .thread-list-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .thread-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: var(--text-secondary);
    text-align: center;
    padding: 40px;
  }

  .empty-state i {
    font-size: 24px;
    opacity: 0.3;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 14px;
    margin: 0 0 24px 0;
    max-width: 4000px;
  }

  .empty-state span {
    font-weight: 600;
  }
</style>


