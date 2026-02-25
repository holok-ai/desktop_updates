<script lang="ts">
  /**
   * ChatRequestCommands — hover-reveal command icons for requests.
   * Positioned after request with a configurable gap.
   * Aligns right when chatLayout is 'right-left'.
   */
  import type { ChatLayout } from '$lib/types/app.type';

  interface CommandDef {
    icon: string;
    label: string;
    action: () => void;
  }

  interface Props {
    commands: CommandDef[];
    /** Chat layout to determine alignment */
    chatLayout?: ChatLayout;
    /** Whether to show the branch indicator icon */
    showBranchIcon?: boolean;
    /** Callback when branch icon is clicked to re-expand branch view */
    onBranchClick?: () => void;
  }

  let {
    commands = [],
    chatLayout = 'left-right',
    showBranchIcon = false,
    onBranchClick,
  }: Props = $props();
  let hovered = $state(false);

  // Determine if commands should be right-aligned
  const shouldAlignRight = $derived(chatLayout === 'right-left');
</script>

<div
  class="commands-row"
  class:visible={hovered}
  class:align-right={shouldAlignRight}
  role="toolbar"
  aria-label="Request commands"
  tabindex="-1"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  {#each commands as cmd}
    <button class="cmd-btn" onclick={cmd.action} title={cmd.label} aria-label={cmd.label}>
      <i class="pi {cmd.icon}"></i>
    </button>
  {/each}
  {#if showBranchIcon}
    {#if onBranchClick}
      <button
        class="cmd-btn branch-icon branch-icon-clickable"
        onclick={onBranchClick}
        title="Expand branch view"
        aria-label="Expand branch view"
      >
        <i class="pi pi-share-alt"></i>
      </button>
    {:else}
      <span class="cmd-btn branch-icon" title="Selected branch" aria-label="Selected branch">
        <i class="pi pi-share-alt"></i>
      </span>
    {/if}
  {/if}
</div>

<style>
  .commands-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    height: 28px;
    padding-top: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
    overflow: hidden;
  }

  .commands-row.align-right {
    justify-content: flex-end;
  }

  .commands-row.visible {
    opacity: 1;
  }

  .commands-row .cmd-btn {
    pointer-events: auto;
  }

  .cmd-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: var(--surface-hover, #f0f0f0);
    border-radius: 4px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    font-size: 0.75rem;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .cmd-btn:hover {
    background: color-mix(in srgb, var(--primary-color, #646cff) 15%, transparent);
    color: var(--primary-color, #646cff);
  }

  .branch-icon {
    color: var(--green-500, #22c55e);
    cursor: default;
  }

  .branch-icon-clickable {
    cursor: pointer;
  }

  .branch-icon-clickable:hover {
    background: color-mix(in srgb, var(--green-500, #22c55e) 15%, transparent);
    color: var(--green-600, #16a34a);
  }
</style>
