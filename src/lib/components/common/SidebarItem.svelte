<script lang="ts">
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  const { isSelected, isHidden, item, isCollapsed } = $props<{
    isSelected: boolean;
    isHidden?: boolean;
    item: SidebarActivity;
    isCollapsed: boolean;
  }>();

  function onClick(item: SidebarActivity) {
    dispatch('click', item);
  }

  function handleKey(e: KeyboardEvent, item: SidebarActivity) {
    if (e.key === 'Enter' || e.key === ' ') onClick(item);
  }
</script>

<div
  class="w-full transition-all duration-200 flex flex-col items-stretch"
  class:hidden={isHidden}
>
  <li
    class="leading-none w-full flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200"
    class:active={isSelected}
    tabindex="0"
    role="menuitem"
    aria-label={item.label}
    onclick={() => onClick(item)}
    onkeydown={(e) => handleKey(e, item)}
    title={isCollapsed ? item.label : undefined}
  >
    <div class="flex items-center justify-center w-6 h-6 flex-shrink-0">
      <i class="{item.icon} text-base leading-none"></i>
    </div>

    {#if !isCollapsed}
      <span class="text-sm leading-none truncate">{item.label}</span>
    {/if}
  </li>

  {#if isCollapsed}
    <span
      class="h-4 text-[10px] text-[var(--text-primary)] text-center mt-[2px] truncate w-full leading-none"
    >
      {item.shortLabel || item.label}
    </span>
  {/if}
</div>

<style scoped>
  .active {
    background-color: var(--background-primary-active, #0f2239);
    color: var(--text-active, #ffffff);

    span {
      color: var(--text-active);
    }
  }
</style>
