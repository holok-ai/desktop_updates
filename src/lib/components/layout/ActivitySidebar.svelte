<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, isAuthenticated } from '../../stores/auth.store';
  import { ROUTE } from '../../constants/route.constant';
  import { push } from 'svelte-spa-router';
  import { writable } from 'svelte/store';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { SIDEBAR_COLLAPSED_STORAGE_KEY } from '$lib/constants/sidebar.constant';
  import type { AppColorMode } from '$lib/types/app.type';
  import { APP_COLOR_MODE, APP_COLOR_MODE_STORAGE_KEY } from '$lib/constants/app.constant';

  const modeStore = writable<AppColorMode>(APP_COLOR_MODE.LIGHT);
  const dispatch = createEventDispatcher();
  let isCollapsed = $state(false);
  let activities: SidebarActivity[] = [
    { id: 'home', label: 'Home', icon: 'pi pi-home', route: ROUTE.HOME },
    { id: 'threads', label: 'Threads', icon: 'pi pi-comments', route: ROUTE.THREADS, badge: 3 },
  ];
  let selected = $state(activities[0].id);
  let currentMode: AppColorMode = $state(APP_COLOR_MODE.LIGHT);

  onMount(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (saved !== null) isCollapsed = saved === 'true';

    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? APP_COLOR_MODE.DARK : APP_COLOR_MODE.LIGHT;
    const stored = localStorage.getItem(APP_COLOR_MODE_STORAGE_KEY);
    setMode((stored === APP_COLOR_MODE.DARK || system === APP_COLOR_MODE.DARK) ? APP_COLOR_MODE.DARK : APP_COLOR_MODE.LIGHT);
  });

  $effect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  });

  $effect(() => {
    const unsubscribe = modeStore.subscribe((mode) => currentMode = mode);
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

  function setMode(mode: AppColorMode) {
    currentMode = mode;
    modeStore.set(mode);
    const html = document.documentElement;
    if (mode === APP_COLOR_MODE.DARK) {
      html.classList.add(APP_COLOR_MODE.DARK);
    } else {
      html.classList.remove(APP_COLOR_MODE.DARK);
    }
    localStorage.setItem(APP_COLOR_MODE_STORAGE_KEY, mode);
  }

  function handleKey(e: KeyboardEvent, activity: SidebarActivity) {
    if (e.key === 'Enter' || e.key === ' ') {
        handleNavigate(activity);
    }
  }
</script>

<nav class="activity-sidebar {isCollapsed ? 'collapsed' : ''}" aria-label="Main sidebar">
  <div class="sidebar-header">
    <span class="brand">HK</span>
  </div>
  <ul class="nav-icons" role="menu">
    {#each activities as activity}
      <li class:active={selected===activity.id}
          tabindex="0"
          role="menuitem"
          aria-label={activity.label}
          onclick={() => handleNavigate(activity)}
          onkeydown={(e) => handleKey(e, activity)}
          title={isCollapsed ? activity.label : undefined}>
        <i class={activity.icon}></i>
        {#if !isCollapsed}
          <span class="item-label">{activity.label}</span>
        {/if}
        {#if activity.badge && !isCollapsed}
          <span class="badge">{activity.badge}</span>
        {/if}
      </li>
    {/each}
  </ul>
  <div class="sidebar-footer">
    {#if $isAuthenticated}
      <div class="user-area flex flex-col items-center gap-2 w-full mt-2">
        <div class="flex items-center w-full gap-2">
          <i class="pi pi-user-circle text-xl"></i>
          {#if !isCollapsed}
            <span class="username">{$currentUser?.name ?? 'User'}</span>
          {/if}
        </div>
        {#if !isCollapsed}
        <div class="footer-controls flex gap-2 mt-2">
          <button class="mode-btn" aria-label="Toggle bright mode" onclick={() => setMode(APP_COLOR_MODE.LIGHT)} class:active={currentMode === APP_COLOR_MODE.LIGHT}><i class="pi pi-sun"></i></button>
          <button class="mode-btn" aria-label="Toggle dark mode" onclick={() => setMode(APP_COLOR_MODE.DARK)} class:active={currentMode === APP_COLOR_MODE.DARK}><i class="pi pi-moon"></i></button>
          <button class="profile-btn" aria-label="Profile/Settings"><i class="pi pi-cog"></i></button>
        </div>
        {/if}
      </div>
    {/if}
    <button class="collapse-btn mt-2" onclick={toggle} aria-label="Collapse/Expand Sidebar">
      <i class={isCollapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'}></i>
    </button>
  </div>
</nav>

<style>
  .activity-sidebar {
    display: flex;
    flex-direction: column;
    width: var(--sidebar-primary-expanded, 240px);
    background: var(--surface-sidebar-primary, #111827);
    transition: width 0.3s;
    color: var(--text-primary, #fff);
    height: 100vh;
    border-right: 1px solid var(--border-sidebar,#1f2937);
    z-index:var(--z-sidebar, 200);
  }
  .activity-sidebar.collapsed {
    width: var(--sidebar-primary-width, 64px);
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    height: 48px;
    margin: 1rem 0;
    padding: 0 1rem;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--accent-primary,#3b82f6);
    justify-content:center;
  }
  .nav-icons {
    flex:1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 2rem;
  }
  .nav-icons li {
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    color: var(--text-secondary, #9ca3af);
    transition: background 0.15s;
    outline:none;
  }
  .nav-icons li:focus {
    outline: 2px solid var(--border-active,#3b82f6);
    outline-offset: 0px;
    background: var(--surface-hover,rgba(59,130,246,0.04));
  }
  .nav-icons li.active {
    color: var(--text-primary,#fff);
    background: var(--surface-hover, rgba(59,130,246,0.12));
    border-left: 3px solid var(--border-active, #3b82f6);
  }
  .item-label {
    font-size: 1rem;
    flex:1;
  }
  .badge {
    margin-left: auto;
    background: #3b82f6;
    color:#fff;
    padding: 2px 8px;
    font-size: 0.8em;
    font-weight: 700;
    border-radius: 1rem;
  }
  .sidebar-footer {
    padding: 1rem 0.5rem 0.5rem 0.5rem;
    border-top: 1px solid var(--border-sidebar, #1f2937);
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 64px;
  }
  .user-area { width: 100%; color: var(--text-primary,#fff);}
  .username { font-size:1rem; font-weight:500; }
  .footer-controls button { background:none; border:none; color:var(--text-secondary,#9ca3af);cursor:pointer; border-radius:6px;font-size:1.1em;padding: 2px 7px; }
  .footer-controls button.active, .footer-controls button:focus {
    color: var(--border-active,#3b82f6);
    outline:2px solid var(--border-active,#3b82f6);
    outline-offset:0;
  }
  .collapse-btn {
    background: none;
    border: none;
    cursor:pointer;
    color: var(--text-secondary, #9ca3af);
    font-size: 1.4rem;
    width: 32px;
    height: 32px;
    margin: 0 auto;
  }
</style>
