<script lang="ts">
  /**
   * ChatBranchFooter — footer displayed below a branch with multiple lanes
   */

  interface Props {
    /** Optional callback when user wants to merge/select a lane */
    onSelectLane?: (laneIndex: number) => void;
  }

  let { onSelectLane: _onSelectLane }: Props = $props();
</script>

<div class="chat-branch-footer">
  <!-- Placeholder for future branch actions -->
</div>

<style>
  .chat-branch-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fafafa);
    border-radius: 0 0 6px 6px;
    min-height: 2rem;
  }
</style>
