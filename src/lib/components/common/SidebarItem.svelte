<script lang="ts">
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  const { isSelected, isHidden, item, isCollapsed, showActions, isSubsection } = $props<{
    isSelected: boolean;
    isHidden?: boolean;
    item: SidebarActivity;
    isCollapsed: boolean;
    showActions?: boolean;
    isSubsection?: boolean;
  }>();

  function onClick(item: SidebarActivity) {
    dispatch('click', item);
  }

  function handleKey(e: KeyboardEvent, item: SidebarActivity) {
    if (e.key === 'Enter' || e.key === ' ') onClick(item);
  }

  let menuOpen = $state(false);
</script>

<div
  class="{isSubsection && 'px-4'} w-full transition-all duration-200 flex flex-col items-stretch"
  class:hidden={isHidden}
>
  <li
    class="min-h-11 relative leading-none w-full flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-800"
    class:active={isSelected}
    tabindex="0"
    role="menuitem"
    aria-label={item.label}
    onclick={() => onClick(item)}
    onkeydown={(e) => handleKey(e, item)}
    title={isCollapsed ? item.label : undefined}
  >
    {#if item.icon}
      <div class="flex items-center justify-center w-6 h-6 flex-shrink-0">
        <i class="{item.icon} text-base leading-none"></i>
      </div>
    {/if}

    {#if !isCollapsed}
      <span class="text-sm leading-none truncate flex-1">{item.label}</span>
      {#if showActions}
        <button
          class="icon-button"
          title="More"
          onclick={(e) => {
            e.stopPropagation();
            menuOpen = !menuOpen;
          }}
        >⋯</button>
        {#if menuOpen}
          <div
            class="menu"
            role="menu"
            tabindex="0"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => {
              if (e.key === 'Escape') menuOpen = false;
            }}
          >
            <button
              class="menu-item"
              type="button"
              onclick={() => {
                menuOpen = false;
                dispatch('delete', item);
              }}
            >Delete thread</button>
          </div>
        {/if}
      {/if}
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

    span, .icon-button {
      color: var(--text-active);
    }
  }
  .icon-button { 
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0 1rem;

    &:focus {
      outline: none;
    }
  }
  .menu {
    position: absolute;
    right: 8px;
    top: 36px;
    background: var(--surface-sidebar-secondary, #0f172a);
    border: 1px solid var(--border-card, #1f2937);
    border-radius: 6px;
    padding: 0.25rem;
    z-index: 20;
    min-width: 160px;
  }
  .menu-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
  }
  .menu-item:hover {
    background: rgba(255,255,255,0.06);
  }
</style>
