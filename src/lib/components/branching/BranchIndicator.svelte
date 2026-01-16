<script lang="ts">
  interface Props {
    currentBranchId: string;
    isMainBranch?: boolean;
  }

  let { currentBranchId, isMainBranch = false }: Props = $props();

  const displayText = $derived(() => {
    if (currentBranchId === '1.0') return 'Main Branch';
    return `Branch ${currentBranchId}`;
  });
</script>

<div class="branch-indicator" class:main={isMainBranch}>
  <svg class="branch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 3v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="6" r="3" />
    <path d="M18 9v3a3 3 0 0 1-3 3H9" />
  </svg>
  <span class="branch-text">{displayText()}</span>
</div>

<style>
  .branch-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .branch-indicator.main {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .branch-icon {
    width: 14px;
    height: 14px;
  }

  .branch-text {
    user-select: none;
  }

  .branch-indicator:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }
</style>


