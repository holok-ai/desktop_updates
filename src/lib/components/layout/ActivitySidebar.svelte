<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, isAuthenticated } from '../../stores/auth.store';
  import { ROUTE } from '../../constants/route.constant';
  import { push, location } from 'svelte-spa-router';
  import { writable } from 'svelte/store';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import type { AppThemeMode } from '$lib/types/app.type';
  import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
  import SidebarItem from '../common/SidebarItem.svelte';
  import { projectService } from '$lib/services/project.service';
  import { storageService } from '$lib/services/storage.service';
  import { confirmNavigation } from '$lib/stores/navigation-guard.store';
  const logoWhite = new URL('../../../assets/images/logo-white.png', import.meta.url).href;

  const modeStore = writable<AppThemeMode>(APP_THEME_MODE.LIGHT);
  const dispatch = createEventDispatcher();
  let isCollapsed = $state(false);
  let activities: SidebarActivity[] = [
    { id: 'home', label: 'Home', icon: 'pi pi-home', route: ROUTE.HOME },
    { id: 'threads', label: 'Threads', icon: 'pi pi-comments', route: ROUTE.THREADS },
    { id: 'projects', label: 'Projects', icon: 'pi pi-folder', route: ROUTE.PROJECTS },
  ];
  let selected = $state(activities[0].id);
  let currentMode: AppThemeMode = $state(APP_THEME_MODE.LIGHT);
  let showProfileMenu = $state(false);

  async function handleLogout() {
    try {
      await window.electronAPI.auth.logout();
    } finally {
      push(ROUTE.LOGIN);
    }
  }

  function syncSelectedWithLocation(path: string) {
    const normalized = typeof path === 'string' && path.length > 0 ? path : ROUTE.HOME;
    let next = 'home';
    if (normalized.startsWith(ROUTE.THREADS)) {
      next = 'threads';
    } else if (normalized.startsWith(ROUTE.PROJECTS)) {
      next = 'projects';
    }
    if (selected !== next) {
      selected = next;
      const activity = activities.find((a) => a.id === next)!;
      // Inform parent about current selection without navigating again
      dispatch('select', activity);
    }
  }

  onMount(() => {
    isCollapsed = storageService.getSidebarCollapsed();

    const stored = storageService.getThemeMode();
    setMode(stored === APP_THEME_MODE.DARK ? APP_THEME_MODE.DARK : APP_THEME_MODE.LIGHT);

    void (async () => {
      try {
        await projectService.loadProjects();
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    })();

    // React to theme changes applied elsewhere (e.g., Settings page)
    const html = document.documentElement;
    const syncFromClass = () => {
      const isDark = html.classList.contains(APP_THEME_MODE.DARK);
      const nextMode = isDark ? APP_THEME_MODE.DARK : APP_THEME_MODE.LIGHT;
      if (currentMode !== nextMode) {
        currentMode = nextMode;
        modeStore.set(nextMode);
      }
    };
    const observer = new MutationObserver(syncFromClass);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    // Also handle storage changes (in case of multi-window)
    const onStorage = (e: StorageEvent) => {
      if (e.key === APP_THEME_MODE_STORAGE_KEY && e.newValue) {
        const next =
          e.newValue === APP_THEME_MODE.DARK ? APP_THEME_MODE.DARK : APP_THEME_MODE.LIGHT;
        if (currentMode !== next) {
          currentMode = next;
          modeStore.set(next);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    // Initial sync with current route
    let currentPath = '';
    const unsub = location.subscribe((p: string) => (currentPath = p));
    syncSelectedWithLocation(currentPath);
    unsub();

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
    };
  });

  $effect(() => {
    storageService.setSidebarCollapsed(isCollapsed);
  });

  $effect(() => {
    const unsubscribe = modeStore.subscribe((mode) => (currentMode = mode));
    return unsubscribe;
  });

  // Keep selection in sync when route changes
  $effect(() => {
    const unsubscribe = location.subscribe((path: string) => syncSelectedWithLocation(path));
    return unsubscribe;
  });

  function handleNavigate(activity: SidebarActivity) {
    if (!confirmNavigation()) return;
    selected = activity.id;
    dispatch('select', activity);
    if (activity.route) push(activity.route);
  }

  function toggle() {
    isCollapsed = !isCollapsed;
  }

  function setMode(mode: AppThemeMode) {
    currentMode = mode;
    modeStore.set(mode);
    const html = document.documentElement;
    if (mode === APP_THEME_MODE.DARK) {
      html.classList.add(APP_THEME_MODE.DARK);
    } else {
      html.classList.remove(APP_THEME_MODE.DARK);
    }
    storageService.setThemeMode(mode);
  }
</script>

<nav
  class="flex flex-col bg-[var(--surface-sidebar-primary)] h-screen transition-all duration-300 {isCollapsed
    ? 'w-[var(--sidebar-primary-collapsed)] p-2'
    : 'w-[var(--sidebar-primary-expanded)] p-4'}"
  aria-label="Main sidebar"
>
  <div class="sidebar-header flex justify-center items-center h-16">
    <img src={logoWhite} alt="Holokai Logo" class="w-[160px] h-[80px] {isCollapsed && 'hidden'}" />
    <button
      class="bg-transparent text-black dark:text-white border-none cursor-pointer text-secondary font-size-1-4 text-center mt-2 focus:outline-none {!isCollapsed &&
        'p-0'}"
      onclick={toggle}
      aria-label="Collapse/Expand Sidebar"
    >
      <i class={isCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'}></i>
    </button>
  </div>
  <ul class="nav-icons" role="menu">
    {#each activities as activity}
      <SidebarItem
        isSelected={selected === activity.id}
        item={activity}
        {isCollapsed}
        on:click={() => void handleNavigate(activity)}
      />
    {/each}
  </ul>
  <div class="flex flex-col items-center justify-center">
    {#if $isAuthenticated}
      <div
        class="flex flex-col items-center justify-center w-full relative transition-all duration-300"
      >
        <button
          class="profile-trigger"
          tabindex="0"
          aria-haspopup="true"
          aria-expanded={showProfileMenu}
          onclick={() => (showProfileMenu = !showProfileMenu)}
        >
          <span class="profile-trigger-content">
            {#if !isCollapsed}
              <i
                class={showProfileMenu
                  ? 'pi pi-chevron-up profile-trigger-icon'
                  : 'pi pi-chevron-down profile-trigger-icon'}
              ></i>
            {/if}
            {#key showProfileMenu}
              <i class="pi pi-user profile-trigger-icon"></i>
            {/key}
            {#if !isCollapsed}
              <span class="profile-trigger-label">{$currentUser?.name ?? 'User'}</span>
            {/if}
          </span>
        </button>

        {#if showProfileMenu && !isCollapsed}
          <div class="w-full mt-2 gap-2 flex flex-col">
            <button
              class="profile-menu-button"
              onclick={() => {
                showProfileMenu = false;
                push(ROUTE.SETTINGS);
              }}
            >
              <i class="pi pi-cog"></i>
              <span>Settings</span>
            </button>
            <button class="profile-menu-button" onclick={handleLogout}>
              <i class="pi pi-sign-out"></i>
              <span>Logout</span>
            </button>
          </div>
        {/if}
        {#if isCollapsed}
          <span class="text-xs text-[var(--text-primary)] text-center"
            >{$currentUser?.name ?? 'User'}</span
          >
        {/if}
      </div>
    {/if}
  </div>
</nav>

<style lang="postcss">
  .profile-trigger {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: flex-start;
    gap: var(--content-padding);
    padding: calc(var(--inline-spacing) * 2) var(--content-padding);
    border-radius: var(--border-radius);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-active);
    cursor: pointer;
    transition:
      background 0.2s ease,
      transform 0.2s ease;
  }

  .profile-trigger:focus {
    outline: none;
  }

  .profile-trigger:hover {
    background: var(--background-primary-hover);
  }

  .profile-trigger-content {
    display: flex;
    align-items: center;
    gap: var(--content-padding);
    width: 100%;
  }

  .profile-trigger-icon {
    color: #fff;
    font-size: 16px;
  }

  .profile-trigger-label {
    color: #fff;
    font-size: 14px;
  }

  .profile-menu-button {
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
    width: 100%;
    padding: calc(var(--inline-spacing) * 1.5) calc(var(--content-padding) * 1.2);
    background: transparent;
    border: none;
    color: #fff;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .profile-menu-button span {
    color: #fff;
  }

  .profile-menu-button:focus {
    outline: none;
  }

  .profile-menu-button:hover {
    background: var(--background-primary-hover);
  }

  .nav-icons {
    @apply flex flex-col gap-4 mt-8;
    flex: 1;
  }
</style>
