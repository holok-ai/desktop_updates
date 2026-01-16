<script lang="ts">
  import type { Message } from '$lib/types/thread.type';
  import { getForkPoints, getVariationsForBranch } from '$lib/utils/branch-utils';

  interface BranchOption {
    branchId: string;
    label: string;
    isMain: boolean;
    isCurrent: boolean;
  }

  interface Props {
    messages: Message[];
    currentBranchId: string;
    onSwitch: (branchId: string) => void;
  }

  let { messages, currentBranchId, onSwitch }: Props = $props();

  let isOpen = $state(false);

  const branchOptions = $derived(() => {
    const options: BranchOption[] = [];
    const forkPoints = getForkPoints(messages);

    // Always include main branch
    options.push({
      branchId: '1.0',
      label: 'Main Branch',
      isMain: true,
      isCurrent: currentBranchId === '1.0',
    });

    // Add all variation branches
    for (const forkPoint of forkPoints) {
      const variations = getVariationsForBranch(messages, forkPoint);
      for (const variation of variations) {
        options.push({
          branchId: variation.branchId,
          label: `Branch ${variation.branchId}`,
          isMain: false,
          isCurrent: currentBranchId === variation.branchId,
        });
      }
    }

    return options;
  });

  function handleSelect(branchId: string) {
    isOpen = false;
    onSwitch(branchId);
  }

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.branch-switcher')) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  });
</script>

<div class="branch-switcher">
  <button class="switcher-button" onclick={toggleDropdown} aria-label="Switch branch">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 3v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v3a3 3 0 0 1-3 3H9" />
    </svg>
    <span class="current-branch">
      {branchOptions().find(b => b.isCurrent)?.label || 'Select Branch'}
    </span>
    <svg class="chevron" class:open={isOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>

  {#if isOpen}
    <div class="dropdown">
      {#each branchOptions() as option (option.branchId)}
        <button
          class="dropdown-item"
          class:active={option.isCurrent}
          class:main={option.isMain}
          onclick={() => handleSelect(option.branchId)}
        >
          <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {#if option.isMain}
              <path d="M3 3l18 18M3 21L21 3" />
            {:else}
              <path d="M6 3v12" />
              <circle cx="6" cy="18" r="3" />
            {/if}
          </svg>
          <span class="item-label">{option.label}</span>
          {#if option.isCurrent}
            <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .branch-switcher {
    position: relative;
    display: inline-block;
  }

  .switcher-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 160px;
  }

  .switcher-button:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }

  .icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  .current-branch {
    flex: 1;
    text-align: left;
  }

  .chevron {
    width: 14px;
    height: 14px;
    transition: transform 0.2s;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--surface-main);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    z-index: 1000;
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
  }

  .dropdown-item:hover {
    background: var(--surface-hover);
  }

  .dropdown-item.active {
    background: rgba(100, 108, 255, 0.1);
    color: #646cff;
  }

  .dropdown-item.main {
    font-weight: 600;
  }

  .item-icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  .dropdown-item.active .item-icon {
    color: #646cff;
  }

  .item-label {
    flex: 1;
  }

  .check-icon {
    width: 16px;
    height: 16px;
    color: #646cff;
  }
</style>


