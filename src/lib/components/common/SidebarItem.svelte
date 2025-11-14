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
    class="min-h-11 relative leading-none w-full flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-[var(--holokai-sidebar-item-hover-light-color)] dark:hover:bg-[var(--holokai-sidebar-item-hover-dark-color)]"
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
        <i class="{item.icon} text-base leading-none text-white"></i>
      </div>
    {/if}

    {#if !isCollapsed}
      <span class="text-sm leading-none truncate flex-1 text-white">{item.label}</span>
      {#if showActions}
        <button
          class="icon-button"
          title="More"
          onclick={(e) => {
            e.stopPropagation();
            menuOpen = !menuOpen;
          }}>⋯</button
        >
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
                dispatch('rename', item);
              }}
              aria-label="Rename thread"
            >
              <i class="pi pi-pencil"></i> Rename
            </button>
            <button
              class="menu-item"
              type="button"
              onclick={() => {
                menuOpen = false;
                dispatch('delete', item);
              }}
              aria-label="Delete thread"
            >
              <i class="pi pi-trash"></i> Delete
            </button>
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
    background-color: var(--background-primary-active);
    color: var(--text-active);

    span,
    .icon-button {
      color: #fff;
    }
  }
  .icon-button {
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 0;

    &:focus {
      outline: none;
    }
  }
  .menu {
    position: absolute;
    right: 8px;
    top: 36px;
    background: var(--surface-main);
    border-radius: var(--border-radius);
    padding: calc(var(--inline-spacing) / 2);
    z-index: 20;
    min-width: 160px;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    padding: var(--inline-spacing) calc(var(--inline-spacing) * 1.5);
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    cursor: pointer;
    font-size: 0.875rem;
    border-radius: 0.25rem;
  }
</style>
