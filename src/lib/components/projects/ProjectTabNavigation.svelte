<script lang="ts">
  export type ProjectTab = {
    id: string;
    label: string;
    icon: string;
    badge?: number;
  };

  let {
    tabs,
    activeTab,
    onTabChange,
  }: {
    tabs: ProjectTab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
  } = $props();
</script>

<div class="tab-nav" role="tablist" aria-label="Project sections">
  {#each tabs as tab}
    <button
      class="tab-button {activeTab === tab.id ? 'active' : ''}"
      onclick={() => onTabChange(tab.id)}
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls="{tab.id}-panel"
      id="{tab.id}-tab"
    >
      <i class="pi {tab.icon}"></i>
      <span>{tab.label}</span>
      {#if tab.badge !== undefined && tab.badge > 0}
        <span class="tab-badge">{tab.badge}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tab-nav {
    display: flex;
    padding: 0 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--background-secondary);
    overflow-x: auto;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab-button:hover:not(.active) {
    color: var(--text-primary);
    background: var(--background-hover);
  }

  .tab-button.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
  }

  .tab-button i {
    font-size: 16px;
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--badge-active-bg);
    color: var(--badge-active-text);
    font-size: 12px;
    font-weight: 600;
    margin-left: 8px;
  }

  .tab-button:not(.active) .tab-badge {
    background: var(--badge-inactive-bg);
    color: var(--badge-inactive-text);
  }

  /* Dark mode adjustments */
  :global(.dark-mode) .tab-nav {
    background: var(--background-secondary);
    border-bottom-color: var(--border-color);
  }
</style>






