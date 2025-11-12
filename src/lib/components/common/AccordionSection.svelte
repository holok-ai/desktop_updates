<script lang="ts">
  import SidebarItem from './SidebarItem.svelte';
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { SidebarActivity } from '$lib/types/sidebar.type';

  const dispatch = createEventDispatcher();

  const { title, isSidebarCollapsed, items, showActions, selectedId, isSubsection, customIcon } = $props<{
    title: string;
    isSidebarCollapsed: boolean;
    items: SidebarActivity[];
    showActions?: boolean;
    selectedId?: string | null;
    isSubsection?: boolean;
    customIcon?: string;
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

<div class="w-full flex-col">
  <li
    class="min-h-11 relative leading-none w-full flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-800"
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
        <i class="{customIcon} text-base leading-none"></i>
      </div>
      {#if !isSidebarCollapsed}
        <span class="text-sm leading-none truncate flex-1">{title}</span>
        <i class="pi pi-angle-down arrow text-base leading-none" class:rotate={!isCollapsed}></i>
      {/if}
    {:else}
      <i class="pi pi-angle-down arrow text-base leading-none" class:rotate={!isCollapsed}></i>
      {#if !isSidebarCollapsed}
        <span class="text-sm leading-none truncate flex-1">{title}</span>
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
            on:click={() => onClick(item)}
            on:delete={() => dispatch('delete', item)}
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
</style>
