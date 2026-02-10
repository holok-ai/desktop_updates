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
    /** Optional callback when lane is selected */
    onSelect?: () => void;
  }

  let {
    laneId: _laneId = '',
    laneIndex = 0,
    modelName = '',
    onSelect
  }: Props = $props();
</script>

<div class="chat-lane-header">
  <div class="lane-info">
    <span class="lane-number">Lane {laneIndex + 1}</span>
    {#if modelName}
      <span class="lane-model">{modelName}</span>
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
  }

  .lane-number {
    font-weight: 600;
    color: var(--text-primary, #111);
  }

  .lane-model {
    color: var(--text-secondary, #666);
    font-size: 0.75rem;
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
