<script lang="ts">
  import { threadService } from '$lib/services/thread.service';

  interface Props {
    threadId: string | null;
    title: string;
    onTitleChange?: (newTitle: string) => void;
  }

  let { threadId = null, title = $bindable(''), onTitleChange }: Props = $props();

  let isEditing = $state(false);
  let editValue = $state('');
  let inputRef: HTMLInputElement | undefined = $state();
  let showTokens = $state(false);
  let showStatus = $state(false);
  let hovered = $state(false);

  function startEditing() {
    editValue = title;
    isEditing = true;
    setTimeout(() => inputRef?.focus(), 0);
  }

  async function commitEdit() {
    isEditing = false;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) return;

    title = trimmed;
    onTitleChange?.(trimmed);

    if (threadId) {
      try {
        await threadService.rename(threadId, trimmed);
      } catch (err) {
        console.error('[ThreadPageHeader] Failed to rename thread:', err);
      }
    }
  }

  function cancelEdit() {
    isEditing = false;
    editValue = title;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }
</script>

<header class="thread-page-header">
  <div
    class="header-content"
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
  >
    <div class="header-left">
    {#if isEditing}
      <input
        bind:this={inputRef}
        bind:value={editValue}
        class="title-input"
        onblur={commitEdit}
        onkeydown={handleKeydown}
        aria-label="Edit thread title"
      />
    {:else}
      <h1 class="thread-title" ondblclick={startEditing} title="Double-click to edit">
        {title || 'Untitled Thread'}
      </h1>
    {/if}
  </div>

  <div class="header-commands">
    <button
      class="header-cmd"
      class:active={showTokens}
      onclick={() => (showTokens = !showTokens)}
      title="Show token count"
      aria-label="Toggle token count"
    >
      <i class="pi pi-hashtag"></i>
    </button>
    <button
      class="header-cmd"
      class:active={showStatus}
      onclick={() => (showStatus = !showStatus)}
      title="Show status"
      aria-label="Toggle status"
    >
      <i class="pi pi-info-circle"></i>
    </button>
  </div>
  </div>
</header>

<style>
  .thread-page-header {
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
    flex-shrink: 0;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    min-height: 48px;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  .thread-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #111);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
    line-height: 1.4;
  }

  .title-input {
    width: 100%;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #111);
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--primary-color, #646cff);
    outline: none;
    padding: 0;
    line-height: 1.4;
  }

  .header-commands {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0.15s ease;
  }

  .header-content:hover .header-commands {
    opacity: 1;
    visibility: visible;
  }

  .header-cmd {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .header-cmd:hover {
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-primary, #111);
  }

  .header-cmd.active {
    background: color-mix(in srgb, var(--primary-color, #646cff) 15%, transparent);
    color: var(--primary-color, #646cff);
  }
</style>
