<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { ROUTE } from '../../constants/route.constant';
  import { location, querystring, push } from 'svelte-spa-router';
  import { getSelectedActivity } from '../../utils/sidebar-route.util';
  import { writable } from 'svelte/store';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import type { AppThemeMode } from '$lib/types/app.type';
  import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
  import { projectService } from '$lib/services/project.service';
  import { storageService } from '$lib/services/storage.service';
  import { requestNavigation } from '$lib/stores/navigation-guard.store';
  import { threads } from '$lib/stores/thread.store';
  import { projects } from '$lib/stores/project.store';
  import { favorites, type FavoriteType } from '$lib/stores/favorite.store';
  import { breadcrumbStore } from '$lib/stores/breadcrumb.store';
  import type { Thread } from '../../../../src-electron/preload';
  import { threadFacade as threadService } from '$lib/services/thread-facade';
  import { currentUser, isAuthenticated, authStore } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import { sidebarCollapsed } from '$lib/stores/sidebar.store';

  const modeStore = writable<AppThemeMode>(APP_THEME_MODE.LIGHT);
  const dispatch = createEventDispatcher();
  let sidebarElement: HTMLElement | null = null;
  let allActivities: SidebarActivity[] = [
    { id: 'new-thread', label: '+ New Thread', icon: 'pi pi-plus', route: ROUTE.NEW_THREAD },
    { id: 'search', label: 'Search', icon: '', route: ROUTE.SEARCH },
    { id: 'projects', label: 'Projects', icon: 'pi pi-folder', route: ROUTE.PROJECTS },
    { id: 'threads', label: 'Threads', icon: 'pi pi-comments', route: ROUTE.THREADS },
  ];

  // Filter activities based on authentication
  let activities = $derived(allActivities);

  let selected = $state('search');
  let currentMode: AppThemeMode = $state(APP_THEME_MODE.LIGHT);
  let showFavorites = $state(false);
  let showRecentThreads = $state(false);
  let isCollapsed = $state(false);

  // Sync local state with shared store (allows external components to collapse sidebar)
  $effect(() => {
    const unsub = sidebarCollapsed.subscribe((v) => {
      isCollapsed = v;
    });
    return unsub;
  });
  let isSettingsMenuOpen = $state(false);
  let settingsWrapperEl = $state<HTMLDivElement | undefined>(undefined);
  let settingsBtnEl = $state<HTMLButtonElement | undefined>(undefined);
  let settingsMenuStyle = $state('');

  // Get last 10 threads sorted by most recent
  const recentThreads = $derived(
    $threads
      .filter((t) => !t.metadata?.projectId)
      .sort((a, b) => {
        const aTime =
          typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime();
        const bTime =
          typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      })
      .slice(0, 10),
  );

  // Derive favorite items for display, ordered by most recently added
  const favoriteItems = $derived(
    [...$favorites]
      .sort((a, b) => b.addedAt - a.addedAt)
      .map((f) => {
        if (f.type === 'thread') {
          const thread = $threads.find((t) => t.id === f.id);
          if (!thread) return null;
          return {
            id: f.id,
            type: f.type as FavoriteType,
            route: f.route,
            label: thread.title || 'Untitled',
            sublabel: (thread.metadata?.modelTitle as string) || '',
          };
        } else {
          const project = $projects.find((p) => p.id === f.id);
          if (!project) return null;
          return {
            id: f.id,
            type: f.type as FavoriteType,
            route: f.route,
            label: project.title,
            sublabel: project.type,
          };
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  );

  function toggleFavorites() {
    showFavorites = !showFavorites;
  }

  function handleFavoriteClick(item: {
    id: string;
    type: FavoriteType;
    route: string;
    label: string;
  }) {
    const proceed = () => {
      let targetRoute: string;
      if (item.route) {
        targetRoute = item.route;
      } else if (item.type === 'thread') {
        targetRoute = `${ROUTE.THREAD}?threadId=${item.id}`;
      } else {
        targetRoute = `${ROUTE.PROJECTS_VIEW}?projectId=${item.id}`;
      }

      // Set breadcrumb trail: parent route -> item
      if (item.type === 'thread') {
        // Check if this is a project thread (route contains projectId)
        const params = new URLSearchParams(targetRoute.split('?')[1] ?? '');
        const projectId = params.get('projectId');
        if (projectId) {
          breadcrumbStore.navigateWithTrail([
            { label: 'Projects', route: ROUTE.PROJECTS },
            {
              label: 'Loading...',
              route: `${ROUTE.PROJECTS_VIEW}?projectId=${projectId}`,
              projectId,
            },
            { label: 'Loading...', route: targetRoute, threadId: item.id },
          ]);
        } else {
          breadcrumbStore.navigateWithTrail([
            { label: 'Threads', route: ROUTE.THREADS },
            { label: item.label, route: targetRoute, threadId: item.id },
          ]);
        }
      } else {
        breadcrumbStore.navigateWithTrail([
          { label: 'Projects', route: ROUTE.PROJECTS },
          { label: item.label, route: targetRoute, projectId: item.id },
        ]);
      }
    };
    if (requestNavigation(proceed)) {
      proceed();
    }
  }

  async function toggleRecentThreads() {
    // If we're about to show recent threads and the thread list is empty, load threads first
    if (!showRecentThreads && $threads.length === 0) {
      const result = await threadService.getAll({ updateStore: true });
      if (!result.success) {
        console.error('[ActivitySidebar] Failed to load threads:', result.errorText);
      }
    }
    showRecentThreads = !showRecentThreads;
  }

  function handleThreadClick(thread: Thread) {
    const proceed = () => {
      const targetRoute = `${ROUTE.THREAD}?threadId=${thread.id}`;
      breadcrumbStore.navigateWithTrail([
        { label: 'Threads', route: ROUTE.THREADS },
        { label: thread.title || 'Untitled', route: targetRoute, threadId: thread.id },
      ]);
    };
    if (requestNavigation(proceed)) {
      proceed();
    }
  }

  function toggleSettingsMenu() {
    if (!isSettingsMenuOpen && settingsBtnEl) {
      const rect = settingsBtnEl.getBoundingClientRect();
      // Anchor menu above the button, left-aligned with it
      settingsMenuStyle = `bottom: ${window.innerHeight - rect.top + 6}px; left: ${rect.left}px;`;
    }
    isSettingsMenuOpen = !isSettingsMenuOpen;
  }

  function handleNavigateSettings() {
    isSettingsMenuOpen = false;
    void push(ROUTE.SETTINGS);
  }

  function handleCheckUpdate() {
    isSettingsMenuOpen = false;
    void push(`${ROUTE.APP_UPDATES}?checkNow=1`);
  }

  async function handleLogoutFromMenu() {
    const userName = $currentUser?.name;
    isSettingsMenuOpen = false;
    try {
      await window.electronAPI.auth.logout();
      authStore.logout();
      if (userName) {
        toastStore.show(`${userName} has been logged out.`, { variant: 'success' });
      }
    } catch (error) {
      console.error('[ActivitySidebar] Logout failed:', error);
    } finally {
      void push(ROUTE.LOGIN);
    }
  }

  function handleLoginFromMenu() {
    isSettingsMenuOpen = false;
    void push(ROUTE.LOGIN);
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    sidebarCollapsed.set(isCollapsed);
    storageService.setSidebarCollapsed(isCollapsed);
    if (isCollapsed) {
      showFavorites = false;
      showRecentThreads = false;
    }
  }

  function syncSelectedWithLocation(path: string, qs?: string) {
    const next = getSelectedActivity(path, qs);
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

    // Load collapsed state
    isCollapsed = storageService.getSidebarCollapsed();
    sidebarCollapsed.set(isCollapsed);

    void (async () => {
      try {
        await projectService.loadProjects();
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    })();

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

    // Close settings menu on outside click or Escape
    function handleSettingsOutsideClick(e: MouseEvent) {
      if (
        isSettingsMenuOpen &&
        settingsWrapperEl !== undefined &&
        !settingsWrapperEl.contains(e.target as Node)
      ) {
        isSettingsMenuOpen = false;
      }
    }

    function handleSettingsKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        isSettingsMenuOpen = false;
      }
    }

    document.addEventListener('click', handleSettingsOutsideClick, true);
    document.addEventListener('keydown', handleSettingsKeyDown);

    // Keep selection in sync with route changes
    let currentPath = '';
    let currentQs = '';

    const unsubLoc = location.subscribe((path: string) => {
      currentPath = path;
      syncSelectedWithLocation(currentPath, currentQs);
    });

    const unsubQs = querystring.subscribe((qs: string | undefined) => {
      currentQs = qs ?? '';
      syncSelectedWithLocation(currentPath, currentQs);
    });

    return () => {
      unsubLoc();
      unsubQs();
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('click', handleSettingsOutsideClick, true);
      document.removeEventListener('keydown', handleSettingsKeyDown);
    };
  });

  $effect(() => {
    const unsubscribe = modeStore.subscribe((mode) => (currentMode = mode));
    return unsubscribe;
  });

  /** Map sidebar activity id to breadcrumb label */
  function activityLabel(id: string): string {
    switch (id) {
      case 'new-thread':
        return 'New Thread';
      case 'search':
        return 'Search';
      case 'projects':
        return 'Projects';
      case 'threads':
        return 'Threads';
      default:
        return id;
    }
  }

  function handleNavigate(activity: SidebarActivity) {
    const proceed = () => {
      // For new thread, keep threads selected in sidebar
      if (activity.id === 'new-thread') {
        selected = 'threads';
      } else {
        selected = activity.id;
      }
      dispatch('select', activity);

      // Primary routes clear the breadcrumb queue and push their own entry
      if (activity.route) {
        breadcrumbStore.navigatePrimary({
          label: activityLabel(activity.id),
          route: activity.route,
        });
      }
    };

    // If no unsaved changes, requestNavigation returns true and we proceed immediately
    // If there are unsaved changes, it shows the modal and returns false
    if (requestNavigation(proceed)) {
      proceed();
    }
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
  class="activity-sidebar flex flex-col bg-[var(--surface-sidebar-primary)] h-full px-3 py-4"
  class:collapsed={isCollapsed}
  bind:this={sidebarElement}
  aria-label="Main sidebar"
>
  <ul class="nav-items" role="menu">
    {#each activities as activity}
      <li>
        <button
          class="nav-button"
          class:new-thread={activity.id === 'new-thread'}
          class:selected={selected === activity.id && activity.id !== 'new-thread'}
          onclick={() => void handleNavigate(activity)}
          aria-label={activity.label}
          title={isCollapsed ? activity.label : ''}
        >
          {#if isCollapsed}
            <i
              class="pi {activity.id === 'new-thread'
                ? 'pi-plus'
                : activity.id === 'search'
                  ? 'pi-search'
                  : activity.id === 'threads'
                    ? 'pi-comments'
                    : activity.id === 'projects'
                      ? 'pi-folder'
                      : ''}"
            ></i>
          {:else}
            {activity.label}
          {/if}
        </button>
      </li>
    {/each}

    <!-- Favorites Section - only show when not collapsed -->
    {#if !isCollapsed}
      <li class="favorites-section">
        <div
          class="recent-header"
          role="button"
          tabindex="0"
          onclick={toggleFavorites}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleFavorites();
            }
          }}
        >
          <span class="recent-label">Favorites</span>
          <button
            class="recent-toggle"
            onclick={(e) => {
              e.stopPropagation();
              toggleFavorites();
            }}
          >
            {showFavorites ? 'hide' : 'show'}
          </button>
        </div>
        <hr class="recent-divider" />

        {#if showFavorites && favoriteItems.length > 0}
          <ul class="recent-threads">
            {#each favoriteItems as item (item.id)}
              <li>
                <button class="recent-thread-item" onclick={() => handleFavoriteClick(item)}>
                  <span class="thread-title">
                    {#if item.type === 'project'}
                      <i class="pi pi-folder" style="font-size: 10px;"></i>
                    {/if}
                    {item.label}
                  </span>
                  <span class="thread-model">{item.sublabel}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/if}

    <!-- Recent Section - only show when not collapsed -->
    {#if !isCollapsed}
      <li class="recent-section">
        <div
          class="recent-header"
          role="button"
          tabindex="0"
          onclick={() => void toggleRecentThreads()}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void toggleRecentThreads();
            }
          }}
        >
          <span class="recent-label">Recent</span>
          <button
            class="recent-toggle"
            onclick={(e) => {
              e.stopPropagation();
              void toggleRecentThreads();
            }}
          >
            {showRecentThreads ? 'hide' : 'show'}
          </button>
        </div>
        <hr class="recent-divider" />

        {#if showRecentThreads && recentThreads.length > 0}
          <ul class="recent-threads">
            {#each recentThreads as thread (thread.id)}
              <li>
                <button class="recent-thread-item" onclick={() => handleThreadClick(thread)}>
                  <span class="thread-title">{thread.title || 'Untitled'}</span>
                  <span class="thread-model">{thread.metadata?.modelTitle || ''}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/if}
  </ul>

  <!-- Settings button at the bottom -->
  <div class="settings-wrapper" bind:this={settingsWrapperEl}>
    <button
      class="settings-btn"
      class:settings-btn-collapsed={isCollapsed}
      bind:this={settingsBtnEl}
      onclick={toggleSettingsMenu}
      aria-label="Settings menu"
      aria-expanded={isSettingsMenuOpen}
      aria-haspopup="true"
      style="color: rgba(255, 255, 255, 0.75);"
    >
      <i class="pi pi-cog settings-icon"></i>
      {#if !isCollapsed}
        <span class="settings-label">Settings</span>
      {/if}
    </button>

    {#if isSettingsMenuOpen}
      <div class="context-menu settings-menu" role="menu" style={settingsMenuStyle}>
        <div class="menu-email">{$currentUser?.email ?? ''}</div>
        <hr class="settings-menu-divider" />
        <button class="menu-item" role="menuitem" onclick={handleNavigateSettings}>
          <i class="pi pi-cog"></i>
          <span>Settings</span>
        </button>
        <button class="menu-item" role="menuitem" onclick={() => void handleCheckUpdate()}>
          <i class="pi pi-sync"></i>
          <span>Check for Updates</span>
        </button>
        {#if $isAuthenticated}
          <button class="menu-item" role="menuitem" onclick={() => void handleLogoutFromMenu()}>
            <i class="pi pi-sign-out"></i>
            <span>Logout</span>
          </button>
        {:else}
          <button class="menu-item" role="menuitem" onclick={handleLoginFromMenu}>
            <i class="pi pi-sign-in"></i>
            <span>Login</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Collapse/Expand Tab Button -->
  <button
    class="collapse-tab"
    onclick={toggleCollapse}
    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    <i class="pi {isCollapsed ? 'pi-angle-right' : 'pi-angle-left'}"></i>
  </button>
</nav>

<style>
  .activity-sidebar {
    width: 230px; /* 15% wider than 200px */
    min-width: 230px;
    max-width: 230px;
    transition: width 0.3s ease;
    position: relative;
  }

  .activity-sidebar.collapsed {
    width: 64px;
    min-width: 64px;
    max-width: 64px;
  }

  .collapse-tab {
    position: absolute;
    top: 54px; /* below the 42px header */
    right: -24px;
    width: 24px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-sidebar-primary);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-left: none;
    border-radius: 0 8px 8px 0;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
    z-index: 10;
    outline: none;
  }

  .collapse-tab:hover {
    background: var(--surface-sidebar-primary);
  }

  .collapse-tab:focus {
    outline: none;
  }

  .collapse-tab:hover i {
    color: var(--holokai-blue);
  }

  .collapse-tab i {
    font-size: 12px;
    transition: color 0.2s ease;
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem; /* 75% smaller than 0.75rem */
    flex: 1;
    min-height: 0; /* allow flex child to shrink so settings btn stays in view */
    overflow-y: auto;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .nav-button {
    width: 100%;
    padding: 7.2px 16px; /* 10% shorter than 8px */
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--sidebar-text-normal) !important;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    outline: none;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .collapsed .nav-button {
    padding: 10px;
    justify-content: center;
  }

  .nav-button i {
    font-size: 18px;
  }

  .nav-button:focus {
    outline: none;
  }

  .nav-button:hover {
    color: var(--sidebar-text-full) !important;
    background: rgba(255, 255, 255, 0.05);
    font-weight: 700;
  }

  .nav-button.selected {
    color: var(--sidebar-text-full) !important;
    background: rgba(255, 255, 255, 0.05);
    font-weight: 700;
  }

  .nav-button.new-thread {
    border-color: rgba(255, 255, 255, 0.2);
    font-weight: 600;
    margin-top: 0.375rem;
  }

  .nav-button.new-thread:hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.08);
  }

  /* Favorites Section */
  .favorites-section {
    margin-top: 0.5rem;
  }

  /* Recent Section */
  .recent-section {
    margin-top: 0.5rem;
  }

  .recent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 16px;
    margin-bottom: 8px;
  }

  .recent-label {
    color: var(--sidebar-text-muted);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .recent-toggle {
    color: var(--sidebar-text-dim);
    font-size: 11px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
    outline: none;
  }

  .recent-toggle:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--holokai-blue);
  }

  .recent-toggle:focus {
    outline: none;
    border-color: transparent;
  }

  .recent-divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 0 0 8px 0;
  }

  .recent-threads {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .recent-thread-item {
    width: 100%;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 2px;
    outline: none;
  }

  .recent-thread-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.95);
  }

  .thread-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-model {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-thread-item:hover .thread-model {
    color: rgba(255, 255, 255, 0.6);
  }

  /* ── Settings button ── */
  .settings-wrapper {
    position: relative;
    flex-shrink: 0;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .settings-btn {
    width: 100%;
    padding: 7.2px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
    text-align: left;
    outline: none;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* Use :global so color is not blocked by Svelte scoping or external !important rules */
  :global(.activity-sidebar .settings-btn),
  :global(.activity-sidebar .settings-btn .settings-icon),
  :global(.activity-sidebar .settings-btn .settings-label) {
    color: rgba(255, 255, 255, 0.75) !important;
  }

  .settings-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .settings-btn:focus {
    outline: none;
  }

  .settings-btn-collapsed {
    padding: 10px;
    justify-content: center;
  }

  .settings-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .settings-label {
    white-space: nowrap;
  }

  /* ── Settings popup menu — fixed so it escapes sidebar overflow ── */
  .settings-menu {
    position: fixed !important;
    min-width: 220px;
  }

  .menu-email {
    padding: 0.5rem 0.75rem 0.4rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    word-break: break-all;
    min-height: 1.5rem;
  }

  .settings-menu-divider {
    border: none;
    border-top: 1px solid var(--surface-border, #e0e0e0);
    margin: 0 0 0.25rem;
  }
</style>
