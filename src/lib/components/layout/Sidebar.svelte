<script lang="ts">
  import { onMount } from 'svelte';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { RoutePath } from '$lib/types/route.type';
  import { location, push } from 'svelte-spa-router';
  import ActivitySidebar from './ActivitySidebar.svelte';
  import ActivityListSidebar from './ActivityListSidebar.svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { SIDEBAR_STORAGE_KEY } from '$lib/constants/sidebar.constant';

  let currentPath = $state<RoutePath>(ROUTE.HOME);
  let selectedActivity = $state<SidebarActivity | null>(null);
  let selectedItem = $state<{id:string, label:string} | null>(null);

  onMount(() => {
    const sidebarActivity = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (sidebarActivity) {
      try { selectedActivity = JSON.parse(sidebarActivity); } catch {}
    }
  });

  $effect(() => {
    const unsubscribe = location.subscribe((path: string) => {
      currentPath = (typeof path === 'string' && path.length > 0 ? path : ROUTE.HOME) as RoutePath;
    });
    return unsubscribe;
  });

  $effect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(selectedActivity));
  });

  function handleActivitySelect(event: CustomEvent<{id:string,label:string,icon?:string}>) {
    selectedActivity = event.detail;
    selectedItem = null;
  }

  function handleListSelect(event: CustomEvent<{id:string, label:string}>) {
    selectedItem = event.detail;
  }
</script>

<div class="dual-sidebar-layout">
  <ActivitySidebar on:select={handleActivitySelect}/>
  <ActivityListSidebar activity={selectedActivity} on:select={handleListSelect} />
</div>

<style>
  .dual-sidebar-layout {
    display: flex;
    height: 100vh;
    background: #f5f5f5;
  }
</style>
