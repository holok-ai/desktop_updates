<script lang="ts">
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  const {
    isSelected,
    isHidden,
    item,
    isCollapsed,
    showActions,
    isSubsection,
    menuOpen = false,
  } = $props<{
    isSelected: boolean;
    isHidden?: boolean;
    item: SidebarActivity;
    isCollapsed: boolean;
    showActions?: boolean;
    isSubsection?: boolean;
    menuOpen?: boolean;
  }>();

  function onClick(item: SidebarActivity) {
    dispatch('click', item);
  }

  function handleKey(e: KeyboardEvent, item: SidebarActivity) {
    if (e.key === 'Enter' || e.key === ' ') onClick(item);
  }

  let menuElement = $state<HTMLDivElement | null>(null);

  function handleMenuButtonClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('menuToggle');
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (menuOpen && menuElement && !menuElement.contains(event.target as Node)) {
      const target = event.target as HTMLElement;
      // Don't close if clicking the menu button itself (it has its own toggle)
      if (!target.closest('.icon-button')) {
        dispatch('menuToggle'); // Close the menu by toggling it
      }
    }
  }

  // Close menu on Escape key
  function handleEscapeKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && menuOpen) {
      dispatch('menuToggle');
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  });
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
        <button class="icon-button" title="More" onclick={handleMenuButtonClick}>⋯</button>
        {#if menuOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            bind:this={menuElement}
            class="menu"
            role="menu"
            tabindex="0"
            onclick={(e) => e.stopPropagation()}
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
