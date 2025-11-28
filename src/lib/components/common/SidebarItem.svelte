<script lang="ts">
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  const {
    isSelected,
    isHidden,
    item,
    isCollapsed,
    showActions,
    isSubsection,
    isMenuOpen,
    hideCollapsedLabel = false,
  } = $props<{
    isSelected: boolean;
    isHidden?: boolean;
    item: SidebarActivity;
    isCollapsed: boolean;
    showActions?: boolean;
    isSubsection?: boolean;
    isMenuOpen?: boolean;
    hideCollapsedLabel?: boolean;
  }>();

  let showTooltip = $state(false);
  const tooltipId = `sidebar-item-tooltip-${item.id}`;

  function setTooltipState(next: boolean) {
    if (!isCollapsed || !hideCollapsedLabel) return;
    showTooltip = next;
  }

  function onClick(item: SidebarActivity) {
    dispatch('click', item);
  }

  function handleKey(e: KeyboardEvent, item: SidebarActivity) {
    if (e.key === 'Enter' || e.key === ' ') onClick(item);
  }

  function toggleMenu(e: Event) {
    e.stopPropagation();
    dispatch('toggleMenu', item);
  }
</script>

<div
  class="{isSubsection &&
    'pl-4'} w-full transition-all duration-200 flex flex-col items-stretch relative"
  class:hidden={isHidden}
>
  <li
    class="sidebar-item min-h-11 relative leading-none w-full flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-[var(--holokai-sidebar-item-hover-light-color)] dark:hover:bg-[var(--holokai-sidebar-item-hover-dark-color)] {isCollapsed &&
    hideCollapsedLabel
      ? 'icon-only'
      : ''}"
    class:active={isSelected}
    tabindex="0"
    role="menuitem"
    aria-label={item.label}
    aria-describedby={isCollapsed && hideCollapsedLabel ? tooltipId : undefined}
    onclick={() => onClick(item)}
    onkeydown={(e) => handleKey(e, item)}
    onmouseenter={() => setTooltipState(true)}
    onmouseleave={() => setTooltipState(false)}
    onfocus={() => setTooltipState(true)}
    onblur={() => setTooltipState(false)}
  >
    {#if item.icon}
      <div class="flex items-center justify-center w-6 h-6 flex-shrink-0">
        <i class="{item.icon} text-base leading-none sidebar-item-icon"></i>
      </div>
    {/if}

    {#if !isCollapsed}
      <span class="text-sm truncate flex-1 sidebar-item-label">{item.label}</span>
      {#if showActions}
        <button class="icon-button" title="More" onclick={toggleMenu}>⋯</button>
        {#if isMenuOpen}
          <div
            class="menu"
            role="menu"
            tabindex="0"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                dispatch('toggleMenu', item);
              }
            }}
          >
            <button
              class="menu-item"
              type="button"
              onclick={() => {
                dispatch('toggleMenu', item);
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
                dispatch('toggleMenu', item);
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

  {#if isCollapsed && hideCollapsedLabel}
    {#if showTooltip}
      <div class="sidebar-tooltip" role="tooltip" id={tooltipId}>
        {item.label}
      </div>
    {/if}
  {/if}

  {#if isCollapsed && !hideCollapsedLabel}
    <span class="h-4 text-[10px] text-white text-center mt-[2px] truncate w-full leading-none">
      {item.shortLabel || item.label}
    </span>
  {/if}
</div>

<style scoped>
  .sidebar-item {
    position: relative;
  }

  .icon-only {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }

  .sidebar-tooltip {
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    background: rgba(11, 16, 28, 0.95);
    color: #fff;
    font-size: 0.75rem;
    white-space: nowrap;
    box-shadow:
      0 6px 14px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.08);
    z-index: 10;
  }

  .active {
    background-color: var(--sidebar-item-active-bg, var(--background-primary-active));
    color: var(--sidebar-item-active-text-color, var(--text-active));
  }

  .active .sidebar-item-label,
  .active .sidebar-item-icon,
  .active .icon-button {
    color: var(--sidebar-item-active-text-color, var(--text-active));
  }

  .sidebar-item-icon {
    color: var(--sidebar-item-icon-color, #fff);
  }

  .sidebar-item-label {
    color: var(--sidebar-item-text-color, #fff);
  }

  .icon-button {
    background: transparent;
    border: none;
    color: var(--sidebar-item-icon-color, #fff);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    line-height: 1;
    opacity: 0.7;

    &:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
      opacity: 1;
    }

    &:focus {
      outline: none;
      background: var(--surface-hover);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  .menu {
    position: absolute;
    right: 8px;
    top: 36px;
    background: var(--sidebar-item-menu-background, var(--surface-main));
    border-radius: var(--border-radius);
    padding: calc(var(--inline-spacing) / 2);
    z-index: 20;
    min-width: 160px;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(0, 0, 0, 0.05);
    animation: menuFadeIn 0.15s ease-out;
    backdrop-filter: blur(8px);
  }

  @keyframes menuFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    text-align: left;
    padding: 0.625rem 0.875rem;
    background: transparent;
    border: none;
    outline: none;
    color: var(--sidebar-item-menu-text-color, #fff);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 400;
    border-radius: 0.375rem;
    transition: all 0.15s ease;
    position: relative;

    i {
      font-size: 0.875rem;
      width: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    &:active {
      transform: scale(0.98);
    }

    &:focus {
      outline: none;
      background: var(--surface-hover);
    }

    &:first-child {
      i {
        color: var(--primary-color);
      }

      &:hover {
        background: color-mix(in srgb, var(--primary-color) 12%, transparent);
        i {
          color: var(--primary-color);
        }
      }
    }

    &:last-child {
      i {
        color: var(--error-color);
      }

      &:hover {
        background: var(--error-bg);
        i {
          color: var(--error-color);
        }
      }
    }
  }

  /* Dark mode specific adjustments */
  :global(html.dark) .menu {
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  /* Light mode specific adjustments */
  :global(html:not(.dark)) .menu {
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.1),
      0 0 0 1px rgba(0, 0, 0, 0.08);
  }
</style>
