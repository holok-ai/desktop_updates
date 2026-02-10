<script lang="ts">
  /**
   * ChatBranchHeader — header displayed above a branch with multiple lanes
   */

  interface Props {
    /** Number of lanes in this branch */
    laneCount?: number;
    /** Optional branch identifier */
    branchId?: string;
  }

  let {
    laneCount = 0,
    branchId: _branchId = ''
  }: Props = $props();
</script>

<div class="chat-branch-header">
  <div class="branch-info">
    <i class="pi pi-share-alt"></i>
    <span class="branch-label">
      {laneCount} {laneCount === 1 ? 'response' : 'responses'}
    </span>
  </div>
</div>

<style>
  .chat-branch-header {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fafafa);
    border-radius: 6px 6px 0 0;
  }

  .branch-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary, #666);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .branch-info i {
    font-size: 0.875rem;
  }

  .branch-label {
    color: var(--text-primary, #111);
  }
</style>
