<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { ROUTE } from '../../constants/route.constant';
  import { push, location, querystring } from 'svelte-spa-router';
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
  import type { Thread } from '../../../../src-electron/preload';
  import { threadFacade as threadService } from '$lib/services/thread-facade';

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
  let favoritesHovered = $state(false);
  let showRecentThreads = $state(false);
  let recentHovered = $state(false);
  let isCollapsed = $state(false);

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

  function handleFavoriteClick(item: { id: string; type: FavoriteType; route: string }) {
    const proceed = () => {
      if (item.route) {
        push(item.route);
      } else if (item.type === 'thread') {
        push(`${ROUTE.THREAD}?threadId=${item.id}`);
      } else {
        push(`${ROUTE.PROJECTS_VIEW}?projectId=${item.id}`);
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
      push(`${ROUTE.THREAD}?threadId=${thread.id}`);
    };
    if (requestNavigation(proceed)) {
      proceed();
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    storageService.setSidebarCollapsed(isCollapsed);
    if (isCollapsed) {
      showFavorites = false;
      showRecentThreads = false;
    }
  }

  function syncSelectedWithLocation(path: string, qs?: string) {
    const normalized = typeof path === 'string' && path.length > 0 ? path : ROUTE.HOME;
    let next = 'search';

    // Check if we're viewing a project thread (threads route with projectId param)
    const params = new URLSearchParams(qs ?? '');
    const hasProjectId = params.has('projectId');

    if (normalized.startsWith('/search')) {
      next = 'search';
    } else if (normalized.startsWith(ROUTE.THREADS)) {
      // If viewing a thread from a project, keep Projects activity selected
      next = hasProjectId ? 'projects' : 'threads';
    } else if (normalized.startsWith(ROUTE.PROJECT_THREAD)) {
      // Project thread route always belongs to Projects
      next = 'projects';
    } else if (normalized.startsWith(ROUTE.PROJECTS)) {
      next = 'projects';
    } else if (normalized.startsWith(ROUTE.HOME)) {
      // When on home page, default to search
      next = 'search';
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
    };
  });

  $effect(() => {
    const unsubscribe = modeStore.subscribe((mode) => (currentMode = mode));
    return unsubscribe;
  });

  function handleNavigate(activity: SidebarActivity) {
    const proceed = () => {
      // For new thread, keep threads selected in sidebar
      if (activity.id === 'new-thread') {
        selected = 'threads';
      } else {
        selected = activity.id;
      }
      dispatch('select', activity);
      if (activity.route) push(activity.route);
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
  class="activity-sidebar flex flex-col bg-[var(--surface-sidebar-primary)] h-screen px-3 py-4"
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
          onmouseenter={() => (favoritesHovered = true)}
          onmouseleave={() => (favoritesHovered = false)}
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
            style="visibility: {favoritesHovered ? 'visible' : 'hidden'}"
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
          onmouseenter={() => (recentHovered = true)}
          onmouseleave={() => (recentHovered = false)}
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
            style="visibility: {recentHovered ? 'visible' : 'hidden'}"
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
    top: 20px;
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
    margin-bottom: 0.5rem;
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
</style>
