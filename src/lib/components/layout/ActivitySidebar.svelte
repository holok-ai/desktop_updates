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
  let sidebarElement: HTMLElement | null = null;
  let activities: SidebarActivity[] = [
    { id: 'home', label: 'Home', icon: 'pi pi-home', route: ROUTE.HOME },
    { id: 'threads', label: 'Threads', icon: 'pi pi-comments', route: ROUTE.THREADS },
    { id: 'projects', label: 'Projects', icon: 'pi pi-folder', route: ROUTE.PROJECTS },
  ];
  let selected = $state(activities[0].id);
  let currentMode: AppThemeMode = $state(APP_THEME_MODE.LIGHT);
  let showProfileMenu = $state(false);
  let profileSection: HTMLElement | null = null;

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
  class="activity-sidebar flex flex-col bg-[var(--surface-sidebar-primary)] h-screen px-3 py-4"
  bind:this={sidebarElement}
  aria-label="Main sidebar"
>
  <div class="sidebar-header flex justify-center items-center h-20">
    <img src={logoWhite} alt="Holokai Logo" class="sidebar-logo" />
  </div>
  <ul class="nav-icons" role="menu">
    {#each activities as activity}
      <SidebarItem
        isSelected={selected === activity.id}
        item={activity}
        isCollapsed={true}
        hideCollapsedLabel={false}
        on:click={() => void handleNavigate(activity)}
      />
    {/each}
  </ul>
  <div
    class="sidebar-footer mt-auto flex flex-col items-center justify-center relative"
    bind:this={profileSection}
    role="region"
    aria-label="User profile"
    onmouseenter={() => (showProfileMenu = true)}
    onmouseleave={() => (showProfileMenu = false)}
  >
    {#if $isAuthenticated}
      <button
        class="profile-trigger"
        tabindex="0"
        aria-haspopup="true"
        aria-expanded={showProfileMenu}
        aria-label="Open profile menu"
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showProfileMenu = !showProfileMenu;
          }
          if (event.key === 'Escape') {
            showProfileMenu = false;
          }
        }}
      >
        <i class="pi pi-user profile-trigger-icon"></i>
      </button>
      <span class="profile-name" aria-hidden="true">{$currentUser?.name ?? 'User'}</span>

      {#if showProfileMenu}
        <div
          class="profile-menu-panel"
          role="menu"
          tabindex="-1"
          onkeydown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              showProfileMenu = false;
            }
          }}
        >
          <button
            class="profile-menu-button"
            role="menuitem"
            onclick={() => {
              showProfileMenu = false;
              push(ROUTE.SETTINGS);
            }}
          >
            <i class="pi pi-cog"></i>
            <span>Settings</span>
          </button>
          <button class="profile-menu-button" role="menuitem" onclick={handleLogout}>
            <i class="pi pi-sign-out"></i>
            <span>Logout</span>
          </button>
        </div>
      {/if}
    {/if}
  </div>
</nav>

<style lang="postcss">
  .activity-sidebar {
    width: 92px;
    min-width: 92px;
    max-width: 92px;
  }

  .sidebar-logo {
    width: 100%;
    height: auto;
    object-fit: contain;
  }

  .profile-trigger {
    display: flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--text-active);
    cursor: pointer;
    transition:
      background 0.2s ease,
      transform 0.2s ease;
  }

  .profile-trigger:focus {
    outline: none;
    border: none;
  }

  .profile-trigger:hover {
    background: var(--background-primary-hover);
    border: none;
  }

  .profile-trigger-icon {
    color: #fff;
    font-size: 18px;
  }

  .profile-menu-panel {
    position: absolute;
    left: calc(100% + 2px);
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(20, 24, 40, 0.95);
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 8px 18px rgba(0, 0, 0, 0.35),
      0 0 0 1px rgba(255, 255, 255, 0.05);
    min-width: 180px;
    z-index: 20;
  }

  .sidebar-footer {
    padding-right: 8px;
  }

  .profile-menu-button {
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
    width: 100%;
    padding: 0.5rem 0.75rem;
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
  .profile-name {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    line-height: 1.1;
  }
</style>
