<script lang="ts">
  import SidebarItem from './SidebarItem.svelte';
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { SidebarActivity } from '$lib/types/sidebar.type';

  const dispatch = createEventDispatcher();

  const { title, isSidebarCollapsed, items, showActions, selectedId, isSubsection } = $props<{
    title: string;
    isSidebarCollapsed: boolean;
    items: SidebarActivity[];
    showActions?: boolean;
    selectedId?: string | null;
    isSubsection?: boolean;
  }>();

  let isCollapsed = $state(false);

  function toggleCollapse() {
    // debounce a bit to avoid double click jitter
    queueMicrotask(() => (isCollapsed = !isCollapsed));
  }

  function onClick(item: SidebarActivity) {
    dispatch('click', item);
  }
</script>

<div class="w-full flex-col {isSidebarCollapsed ? 'hidden' : 'flex'}">
  <button class="accordion-header text-[#666666] dark:text-[#A3A3A3]" onclick={toggleCollapse}>
    <i class="pi pi-angle-down arrow" class:rotate={!isCollapsed}></i>
    <span class="text-[#666666] dark:text-[#A3A3A3]">{title}</span>
  </button>

  {#key isCollapsed}
    {#if !isCollapsed}
      <div class="accordion-content gap-1 flex flex-col" transition:slide={{ duration: 200 }}>
        {#each items as item (item.id)}
          <SidebarItem
            {item}
            {isSubsection}
            isCollapsed={isSidebarCollapsed}
            isHidden={false}
            isSelected={selectedId === item.id}
            {showActions}
            on:click={() => onClick(item)}
            on:delete={() => dispatch('delete', item)}
          />
        {/each}
      </div>
    {/if}
  {/key}
</div>

<style>
  .accordion-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    transition: color 0.2s ease;
    position: sticky; /* keep header visible while scrolling long lists */
    top: 0;
    z-index: 1;
    background-color: var(--surface-sidebar-secondary);
  }

  .accordion-header:hover {
    color: var(--text-primary);

    span {
      color: var(--text-primary);
    }
  }

  .arrow {
    transition: transform 0.25s ease;
    display: inline-block; /* ensure rotate doesn't affect layout */
    flex-shrink: 0; /* prevent disappearing when container shrinks */
  }

  .arrow.rotate {
    transform: rotate(180deg);
  }

  .accordion-content {
    will-change: height;
    overflow-anchor: none; /* avoid scroll jump when expanding/collapsing */
  }
</style>
