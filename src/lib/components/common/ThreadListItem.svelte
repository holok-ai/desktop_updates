<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Thread } from '../../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';

  const dispatch = createEventDispatcher();

  const { thread, isSelected, showActions } = $props<{
    thread: Thread;
    isSelected: boolean;
    showActions?: boolean;
  }>();

  function onClick() {
    dispatch('click', { id: thread.id, label: thread.title, route: ROUTE.THREADS });
  }

  function onDelete(e: MouseEvent) {
    e.stopPropagation();
    dispatch('delete', { id: thread.id });
  }

  function formatDate(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}/${day}`;
  }

  function getModelName(thread: Thread): string {
    const model = thread.metadata?.model;
    if (typeof model === 'string') {
      return model;
    }
    return 'unknown';
  }
</script>

<div
  class="thread-item"
  class:selected={isSelected}
  onclick={onClick}
  role="menuitem"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick();
    }
  }}
>
  <div class="thread-content">
    <div class="thread-title-container">
      <div class="thread-title">{thread.title}</div>
      {#if showActions}
        <div class="thread-actions">
          <button
            class="action-button edit"
            title="Edit"
            onclick={(e) => {
              e.stopPropagation();
              // TODO: Implement edit
            }}
          >
            <i class="pi pi-pencil"></i>
          </button>
          <button class="action-button delete" title="Delete" onclick={onDelete}>
            <i class="pi pi-trash"></i>
          </button>
        </div>
      {/if}
    </div>
    <div class="thread-description">{thread.description}</div>
    <div class="thread-meta">
      <span class="thread-date">{formatDate(thread.createdAt)}</span>
      <span class="thread-model">{getModelName(thread)}</span>
    </div>
  </div>
</div>

<style>
  .thread-title-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .thread-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    margin: 0.125rem 0.5rem;
  }

  .thread-description {
    font-size: 9pt;
    color: var(--text-primary, #fff);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .thread-item.selected {
    border-color: #3b82f6;
    background-color: transparent;
  }

  .thread-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .thread-title {
    font-size: 11pt;
    font-weight: 600;
    color: var(--text-primary, #fff);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 9pt;
    color: var(--text-secondary, #a3a3a3);
    line-height: 1.4;
  }

  .thread-date {
    font-size: 9pt;
  }

  .thread-model {
    font-size: 9pt;
  }

  .thread-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .thread-item:hover .thread-actions,
  .thread-actions:hover {
    opacity: 1;
  }

  .action-button {
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .action-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .action-button.edit {
    color: #3b82f6;
  }

  .action-button.delete {
    color: #ef4444;
  }

  .action-button i {
    font-size: 0.875rem;
  }
</style>
