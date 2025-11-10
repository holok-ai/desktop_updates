<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, isAuthenticated } from '../../stores/auth.store';
  import { ROUTE } from '../../constants/route.constant';
  import { push, location } from 'svelte-spa-router';
  import { writable } from 'svelte/store';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { SIDEBAR_COLLAPSED_STORAGE_KEY } from '$lib/constants/sidebar.constant';
  import type { AppThemeMode } from '$lib/types/app.type';
  import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
  import SidebarItem from '../common/SidebarItem.svelte';
  const logoWhite = new URL('../../../assets/images/logo-white.png', import.meta.url).href;
  const logoBlue = new URL('../../../assets/images/logo-blue.png', import.meta.url).href;

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
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (saved !== null) isCollapsed = saved === 'true';

    const stored = localStorage.getItem(APP_THEME_MODE_STORAGE_KEY);
    setMode(stored === APP_THEME_MODE.DARK ? APP_THEME_MODE.DARK : APP_THEME_MODE.LIGHT);

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
        const next = e.newValue === APP_THEME_MODE.DARK ? APP_THEME_MODE.DARK : APP_THEME_MODE.LIGHT;
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
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
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
    localStorage.setItem(APP_THEME_MODE_STORAGE_KEY, mode);
  }
</script>

<nav
  class="flex flex-col bg-[var(--surface-sidebar-primary)] h-screen transition-all duration-300 {isCollapsed
    ? 'w-[var(--sidebar-primary-collapsed)] p-2'
    : 'w-[var(--sidebar-primary-expanded)] p-4'}"
  aria-label="Main sidebar"
>
  <div class="sidebar-header flex justify-center items-center h-16">
    <img src={currentMode === APP_THEME_MODE.DARK ? logoWhite : logoBlue} alt="Holokai Logo" class="w-[160px] h-[80px] {isCollapsed && 'hidden'}" />
    <button
      class="bg-transparent text-black dark:text-white border-none cursor-pointer text-secondary font-size-1-4 text-center mt-2 focus:outline-none {!isCollapsed && 'p-0'}"
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
        on:click={() => handleNavigate(activity)}
      />
    {/each}
  </ul>
  <div class="flex flex-col items-center justify-center">
    {#if $isAuthenticated}
      <div class="flex flex-col items-center justify-center w-full relative transition-all duration-300">
        <button
          class="bg-[#474747] transition-all duration-200 w-full flex items-center justify-start gap-3 cursor-pointer rounded-lg py-3 px-4"
          tabindex="0"
          aria-haspopup="true"
          aria-expanded={showProfileMenu}
          onclick={() => showProfileMenu = !showProfileMenu}
        >
          <span class="flex items-center gap-3">
            {#if !isCollapsed}
              <i class={showProfileMenu ? 'pi pi-chevron-up text-white' : 'pi pi-chevron-down text-white'}></i>
            {/if}
            {#key showProfileMenu}
              <i class="pi pi-user text-white"></i>
            {/key}
            {#if !isCollapsed}
              <span class="text-base text-white">{$currentUser?.name ?? 'User'}</span>
            {/if}
          </span>
        </button>

        {#if showProfileMenu && !isCollapsed}
          <div class="w-full mt-2 gap-2 flex flex-col">
            <button class="hover:bg-gray-200 dark:hover:bg-gray-800 w-full bg-transparent border-none cursor-pointer flex items-center gap-2 py-2 pl-6 pr-4 text-[var(--text-primary)]" onclick={() => { showProfileMenu = false; push(ROUTE.SETTINGS); }}>
              <i class="pi pi-cog"></i>
              <span>Settings</span>
            </button>
            <button class="hover:bg-gray-200 dark:hover:bg-gray-800 w-full bg-transparent border-none cursor-pointer flex items-center gap-2 py-2 pl-6 pr-4 text-[var(--text-primary)]" onclick={handleLogout}>
              <i class="pi pi-sign-out"></i>
              <span>Logout</span>
            </button>
          </div>
        {/if}
        {#if isCollapsed}
          <span class="text-xs text-[var(--text-primary)] text-center">{$currentUser?.name ?? 'User'}</span>
        {/if}
      </div>
    {/if}
  </div>
</nav>

<style lang="postcss">
  .nav-icons {
    @apply flex flex-col gap-4 mt-8;
    flex: 1;
  }
</style>
