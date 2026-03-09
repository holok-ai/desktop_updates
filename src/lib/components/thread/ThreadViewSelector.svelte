<script lang="ts">
  /** Thread view types */
  export type ThreadViewType = 'chat' | 'composer' | 'prompt' | 'graphic' | 'execution';

  interface ViewOption {
    type: ThreadViewType;
    icon: string;
    label: string;
  }

  const VIEW_OPTIONS: ViewOption[] = [
    { type: 'chat', icon: 'pi-comments', label: 'Chat' },
    { type: 'composer', icon: 'pi-file-edit', label: 'Composer' },
    { type: 'prompt', icon: 'pi-pencil', label: 'Prompt' },
    { type: 'graphic', icon: 'pi-image', label: 'Graphic' },
    { type: 'execution', icon: 'pi-play', label: 'Execution' },
  ];

  interface Props {
    activeView: ThreadViewType;
    onViewChange?: (view: ThreadViewType) => void;
  }

  let { activeView = $bindable('chat'), onViewChange }: Props = $props();
  let isHovered = $state(false);

  function selectView(view: ThreadViewType) {
    activeView = view;
    onViewChange?.(view);
  }

  /** Cycle to previous view (Ctrl+Left) */
  function cyclePrev() {
    const idx = VIEW_OPTIONS.findIndex((v) => v.type === activeView);
    const prevIdx = (idx - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length;
    selectView(VIEW_OPTIONS[prevIdx].type);
  }

  /** Cycle to next view (Ctrl+Right) */
  function cycleNext() {
    const idx = VIEW_OPTIONS.findIndex((v) => v.type === activeView);
    const nextIdx = (idx + 1) % VIEW_OPTIONS.length;
    selectView(VIEW_OPTIONS[nextIdx].type);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      cyclePrev();
    } else if (e.ctrlKey && e.key === 'ArrowRight') {
      e.preventDefault();
      cycleNext();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="view-selector"
  role="tablist"
  tabindex="0"
  aria-label="Thread view selector"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
>
  {#each VIEW_OPTIONS as opt}
    {#if isHovered || activeView === opt.type}
      <button
        role="tab"
        class="view-tab"
        class:active={activeView === opt.type}
        aria-selected={activeView === opt.type}
        onclick={() => selectView(opt.type)}
        title="{opt.label} view"
      >
        <i class="pi {opt.icon}"></i>
      </button>
    {/if}
  {/each}
</div>

<style>
  .view-selector {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
    flex-shrink: 0;
    padding: 0 0.5rem;
  }

  .view-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid transparent;
    background: var(--surface-card, #fff);
    color: var(--text-secondary, #666);
    cursor: pointer;
    border-radius: 4px;
    transition:
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .view-tab:focus {
    outline: none;
  }

  .view-tab.active {
    border-color: var(--surface-border, #e0e0e0);
    color: var(--text-primary, #111);
  }

  .view-tab:hover:not(.active) {
    color: var(--text-primary, #111);
  }

  .view-tab i {
    font-size: 1rem;
  }
</style>
