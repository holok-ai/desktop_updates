<script lang="ts">
  import type { ToolCall } from '$lib/types/tool-call.type';

  interface Props {
    tools: ToolCall[];
  }

  let { tools }: Props = $props();
</script>

<div class="tool-details">
  <div class="tool-details-header">
    <i class="pi pi-cog"></i>
    <span>Tool calls</span>
  </div>
  {#each tools as tool (tool.id)}
    <div class="tool-row">
      <div
        class="tool-main"
        class:complete={tool.status === 'complete'}
        class:error={tool.status === 'error'}
      >
        <span class="status-icon">
          {#if tool.status === 'in_progress'}
            <i class="pi pi-spinner pi-spin"></i>
          {:else if tool.status === 'complete'}
            <i class="pi pi-check"></i>
          {:else}
            <i class="pi pi-times"></i>
          {/if}
        </span>
        <span class="tool-hint">{tool.inputHint}</span>
      </div>
      {#if tool.status === 'in_progress' && tool.message}
        <div class="tool-sub-text">{tool.message}</div>
      {:else if tool.status === 'error' && tool.error}
        <div class="tool-sub-text tool-error-text">{tool.error}</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .tool-details {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding-top: 0.375rem;
    border-top: 1px solid var(--surface-border, #e0e0e0);
    font-size: 0.75rem;
  }

  .tool-details-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--text-secondary, #666);
    font-weight: 500;
    margin-bottom: 0.1rem;
  }

  .tool-details-header i {
    font-size: 0.7rem;
  }

  .tool-row {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .tool-main {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--text-secondary, #666);
  }

  .tool-main.complete .status-icon {
    color: #10b981;
  }

  .tool-main.error .status-icon {
    color: #dc2626;
  }

  .status-icon {
    width: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .status-icon i {
    font-size: 0.7rem;
  }

  .tool-hint {
    color: var(--text-secondary, #666);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-sub-text {
    padding-left: 1.2rem;
    color: var(--text-tertiary, #999);
    font-size: 0.7rem;
  }

  .tool-error-text {
    color: #dc2626;
  }
</style>
