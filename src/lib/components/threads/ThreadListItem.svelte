<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Thread } from '../../../../src-electron/preload';

  interface Props {
    thread: Thread;
    projectId?: string | null;
  }

  let { thread, projectId = null }: Props = $props();

  function formatDateTime(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const dateStr = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
    const timeStr = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return `${dateStr} ${timeStr}`;
  }

  function handleClick() {
    const params = new URLSearchParams();

    if (projectId) {
      // Project thread context: use PROJECT_THREAD route
      params.set('projectId', projectId);
      params.set('threadId', thread.id);
      push(`${ROUTE.PROJECT_THREAD}?${params.toString()}`);
    } else {
      // General thread context: use THREADS route
      params.set('threadId', thread.id);
      push(`${ROUTE.THREADS}?${params.toString()}`);
    }
  }
</script>

<button class="thread-item" onclick={handleClick}>
  <div class="thread-item-title">{thread.title || 'Untitled Thread'}</div>
  <div class="thread-item-info">
    <span class="thread-item-date">Last updated on {formatDateTime(thread.updatedAt)}</span>
    <span class="thread-item-model">{thread.metadata?.modelTitle || ''}</span>
  </div>
</button>

<style>
  .thread-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--surface-border);
    cursor: pointer;
    transition: background 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .thread-item:hover {
    background: var(--surface-hover);
  }

  .thread-item:focus {
    background: var(--surface-hover);
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }

  .thread-item-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .thread-item-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .thread-item-date {
    flex: 1;
  }

  .thread-item-model {
    flex-shrink: 0;
    font-style: italic;
  }
</style>
