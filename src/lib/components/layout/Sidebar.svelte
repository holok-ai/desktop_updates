<script lang="ts">
  import { onMount } from 'svelte';
  import ActivitySidebar from './ActivitySidebar.svelte';
  import ActivityListSidebar from './ActivityListSidebar.svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { SIDEBAR_STORAGE_KEY } from '$lib/constants/sidebar.constant';

  let selectedActivity = $state<SidebarActivity | null>(null);

  onMount(() => {
    const sidebarActivity = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (sidebarActivity) {
      try { selectedActivity = JSON.parse(sidebarActivity); }

      catch (error) {
        console.error('Failed to parse sidebar activity:', error);
      }
    }
  });

  $effect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(selectedActivity));
  });

  function handleActivitySelect(event: CustomEvent<{id:string,label:string,icon?:string}>) {
    selectedActivity = event.detail;
  }

</script>

<div class="dual-sidebar-layout">
  <ActivitySidebar on:select={handleActivitySelect}/>
  <ActivityListSidebar activity={selectedActivity}/>
</div>

<style>
  .dual-sidebar-layout {
    display: flex;
    height: 100%;
    background: var(--surface-sidebar-secondary);
  }
</style>
