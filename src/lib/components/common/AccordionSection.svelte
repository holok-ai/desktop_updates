<script lang="ts">
  import SidebarItem from './SidebarItem.svelte';
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { SidebarActivity } from '$lib/types/sidebar.type';

  const dispatch = createEventDispatcher();

const {
  title,
  isSidebarCollapsed,
  items,
  showActions,
  selectedId,
  isSubsection,
  customIcon,
  openMenuId,
} = $props<{
    title: string;
    isSidebarCollapsed: boolean;
    items: SidebarActivity[];
    showActions?: boolean;
    selectedId?: string | null;
    isSubsection?: boolean;
    customIcon?: string;
    openMenuId?: string | null;
  }>();

  let isCollapsed = $state(false);

  function toggleCollapse() {
    // debounce a bit to avoid double click jitter
    queueMicrotask(() => (isCollapsed = !isCollapsed));
  }

  function onClick(item: SidebarActivity) {
    dispatch('toggleMenu', null); // Close any open menu when clicking an item
    dispatch('click', item);
  }

  function handleMenuToggle(item: SidebarActivity) {
    dispatch('toggleMenu', item);
  }
</script>

<div class="w-full flex-col">
  <li
    class="min-h-11 relative leading-none w-full flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-[var(--holokai-sidebar-item-hover-light-color)] dark:hover:bg-[var(--holokai-sidebar-item-hover-dark-color)]"
    tabindex="0"
    role="menuitem"
    aria-label={title}
    onclick={toggleCollapse}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') toggleCollapse();
    }}
    title={isSidebarCollapsed ? title : undefined}
  >
    {#if customIcon}
      <div class="flex items-center justify-center w-6 h-6 flex-shrink-0">
        <i class="{customIcon} text-base leading-none accordion-icon"></i>
      </div>
      {#if !isSidebarCollapsed}
        <span class="text-sm truncate flex-1 accordion-title">{title}</span>
        <i class="pi pi-angle-down arrow text-base accordion-arrow" class:rotate={!isCollapsed}></i>
      {/if}
    {:else}
      <i class="pi pi-angle-down arrow text-base accordion-arrow" class:rotate={!isCollapsed}></i>
      {#if !isSidebarCollapsed}
        <span class="text-sm truncate flex-1 accordion-title">{title}</span>
      {/if}
    {/if}
  </li>

  {#key isCollapsed}
    {#if !isCollapsed && !isSidebarCollapsed}
      <div class="accordion-content gap-1 flex flex-col" transition:slide={{ duration: 200 }}>
        {#each items as item (item.id)}
          <SidebarItem
            {item}
            {isSubsection}
            isCollapsed={isSidebarCollapsed}
            isHidden={false}
            isSelected={selectedId === item.id}
            {showActions}
            isMenuOpen={openMenuId === item.id}
            on:click={() => onClick(item)}
            on:rename={() => dispatch('rename', item)}
            on:delete={() => dispatch('delete', item)}
            on:toggleMenu={(e) => handleMenuToggle(e.detail)}
          />
        {/each}
      </div>
    {/if}
  {/key}
</div>

<style>
  .arrow {
    transition: transform 0.25s ease;
    display: inline-block;
    flex-shrink: 0;
  }

  .arrow.rotate {
    transform: rotate(180deg);
  }

  .accordion-content {
    will-change: height;
    overflow-anchor: none;
  }

  .accordion-icon,
  .accordion-title,
  .accordion-arrow {
    color: var(--sidebar-accordion-title-color, #fff);
  }
</style>
