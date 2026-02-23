<script lang="ts">
  /**
   * ChatLaneHeaderReadOnly — read-only lane header for re-expanded branch view.
   * Supports expand/collapse but shows an X (dismiss) button instead of a
   * checkmark. Clicking X closes the branch view without changing isSelectedBranch.
   */

  interface Props {
    /** Lane identifier/number */
    laneId?: string;
    /** Display index (e.g., "Lane 1", "Lane 2") */
    laneIndex?: number;
    /** Optional model name used in this lane */
    modelName?: string;
    /** Optional model intended use for tooltip */
    modelIntendedUse?: string;
    /** Whether this lane is expanded */
    isExpanded?: boolean;
    /** Callback to toggle expand/collapse */
    onToggleExpand?: () => void;
    /** Callback to dismiss/close the branch view */
    onDismiss?: () => void;
  }

  let {
    laneId: _laneId = '',
    laneIndex = 0,
    modelName = '',
    modelIntendedUse = '',
    isExpanded = false,
    onToggleExpand,
    onDismiss,
  }: Props = $props();
</script>

<div class="chat-lane-header">
  <div
    class="lane-info"
    class:clickable={onToggleExpand}
    class:expanded={isExpanded}
    onclick={onToggleExpand}
    onkeydown={() => {}}
    role="button"
    tabindex={onToggleExpand ? 0 : undefined}
    title={isExpanded ? 'Click to collapse' : 'Click to expand'}
  >
    <span class="lane-model" title={modelIntendedUse || ''}
      >{modelName || `Model ${laneIndex + 1}`}</span
    >
    {#if onToggleExpand}
      <i class="pi pi-{isExpanded ? 'compress' : 'arrows-h'} expand-icon"></i>
    {/if}
  </div>
  {#if onDismiss}
    <button
      class="lane-dismiss-button"
      onclick={onDismiss}
      title="Close branch view"
      aria-label="Close branch view"
    >
      <i class="pi pi-times"></i>
    </button>
  {/if}
</div>

<style>
  .chat-lane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.75rem;
    background: var(--surface-overlay, #f5f5f5);
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .lane-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    flex: 1;
  }

  .lane-info.clickable {
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    margin: -0.25rem -0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .lane-info.clickable:hover {
    background: var(--surface-hover, #f0f0f0);
  }

  .lane-info.expanded {
    background: var(--primary-color-subtle, #e8eaff);
  }

  .expand-icon {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }

  .lane-model {
    font-weight: 600;
    color: var(--text-primary, #111);
    font-size: 0.8125rem;
  }

  .lane-dismiss-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary, #666);
    cursor: pointer;
    transition: all 0.2s;
  }

  .lane-dismiss-button:hover {
    background: var(--red-500, #ef4444);
    color: white;
    border-color: var(--red-500, #ef4444);
  }

  .lane-dismiss-button i {
    font-size: 0.75rem;
  }
</style>
