<script lang="ts">
  import type { Message, BranchType } from '$lib/types/thread.type';
  import { canCreateVariation } from '$lib/utils/branch-utils';

  interface Props {
    message: Message;
    onclick: () => void;
    disabled?: boolean;
    canCreate?: boolean;
  }

  let { message, onclick, disabled = false, canCreate = true }: Props = $props();

  const tooltipText = $derived(() => {
    if (!canCreate) return 'Maximum variations reached';
    return 'Create variation';
  });
</script>

<button
  class="variation-btn"
  {onclick}
  disabled={disabled || !canCreate}
  title={tooltipText()}
  aria-label="Create variation"
>
  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 3v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="6" r="3" />
    <path d="M18 9v3a3 3 0 0 1-3 3H9" />
    <path d="M15 12l3 3 3-3" />
  </svg>
</button>

<style>
  .variation-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .variation-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--surface-border);
    color: var(--text-primary);
  }

  .variation-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .icon {
    width: 16px;
    height: 16px;
  }
</style>


