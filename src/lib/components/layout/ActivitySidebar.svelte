<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { isAuthenticated } from '../../stores/auth.store';
  import { ROUTE } from '../../constants/route.constant';
  import { push, location, querystring } from 'svelte-spa-router';
  import { writable } from 'svelte/store';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import type { AppThemeMode } from '$lib/types/app.type';
  import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
  import { projectService } from '$lib/services/project.service';
  import { storageService } from '$lib/services/storage.service';
  import { requestNavigation } from '$lib/stores/navigation-guard.store';

  const modeStore = writable<AppThemeMode>(APP_THEME_MODE.LIGHT);
  const dispatch = createEventDispatcher();
  let sidebarElement: HTMLElement | null = null;
  let allActivities: SidebarActivity[] = [
    { id: 'new-thread', label: '+ New Thread', icon: 'pi pi-plus', route: ROUTE.NEW_THREAD },
    { id: 'search', label: 'Search', icon: '', route: '/search' },
    { id: 'projects', label: 'Projects', icon: 'pi pi-folder', route: ROUTE.PROJECTS },
    { id: 'threads', label: 'Threads', icon: 'pi pi-comments', route: ROUTE.THREADS },
  ];

  // Filter activities based on authentication
  let activities = $derived(allActivities);

  let selected = $state('search');
  let currentMode: AppThemeMode = $state(APP_THEME_MODE.LIGHT);

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
        >
          {activity.label}
        </button>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .activity-sidebar {
    width: 160px;
    min-width: 160px;
    max-width: 160px;
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .nav-button {
    width: 100%;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    outline: none;
  }

  .nav-button:focus {
    outline: none;
  }

  .nav-button:hover {
    color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-button.selected {
    color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.05);
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
</style>
