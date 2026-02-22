<script lang="ts">
  /**
   * ChatLaneHeader — header displayed at the top of each lane within a branch
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
    /** Optional callback when lane is selected */
    onSelect?: () => void;
  }

  let {
    laneId: _laneId = '',
    laneIndex = 0,
    modelName = '',
    modelIntendedUse = '',
    isExpanded = false,
    onToggleExpand,
    onSelect,
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
  {#if onSelect}
    <button
      class="lane-select-button"
      onclick={onSelect}
      title="Select this lane as primary"
      aria-label="Select lane {laneIndex + 1}"
    >
      <i class="pi pi-check"></i>
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

  .lane-select-button {
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

  .lane-select-button:hover {
    background: var(--primary-color, #646cff);
    color: white;
    border-color: var(--primary-color, #646cff);
  }

  .lane-select-button i {
    font-size: 0.75rem;
  }
</style>
