<script lang="ts">
  /** Thread view types */
  export type ThreadViewType = 'chat' | 'prompt' | 'graphic' | 'execution' | 'file';

  interface ViewOption {
    type: ThreadViewType;
    icon: string;
    label: string;
  }

  const VIEW_OPTIONS: ViewOption[] = [
    { type: 'chat', icon: 'pi-comments', label: 'Chat' },
    { type: 'prompt', icon: 'pi-pencil', label: 'Prompt' },
    { type: 'graphic', icon: 'pi-image', label: 'Graphic' },
    { type: 'execution', icon: 'pi-play', label: 'Execution' },
    { type: 'file', icon: 'pi-file', label: 'File' },
  ];

  interface Props {
    activeView: ThreadViewType;
    onViewChange?: (view: ThreadViewType) => void;
  }

  let { activeView = $bindable('chat'), onViewChange }: Props = $props();

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

<nav class="view-selector" role="tablist" aria-label="Thread view selector">
  {#each VIEW_OPTIONS as opt}
    <button
      role="tab"
      class="view-tab"
      class:active={activeView === opt.type}
      aria-selected={activeView === opt.type}
      onclick={() => selectView(opt.type)}
      title="{opt.label} view"
    >
      <i class="pi {opt.icon}"></i>
      <span class="view-label">{opt.label}</span>
    </button>
  {/each}
</nav>

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
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-secondary, #666);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    position: relative;
    top: 1px;
  }

  .view-tab:hover {
    color: var(--text-primary, #111);
    background: var(--surface-hover, #f0f0f0);
  }

  .view-tab.active {
    color: var(--primary-color, #646cff);
    border-bottom-color: var(--primary-color, #646cff);
  }

  .view-tab i {
    font-size: 0.875rem;
  }

  .view-label {
    line-height: 1;
  }
</style>
