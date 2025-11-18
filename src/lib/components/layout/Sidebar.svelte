<script lang="ts">
  import { onMount } from 'svelte';
  import ActivitySidebar from './ActivitySidebar.svelte';
  import ActivityListSidebar from './ActivityListSidebar.svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import { push } from 'svelte-spa-router';
  import { storageService } from '$lib/services/storage.service';

  let selectedActivity = $state<SidebarActivity | null>(null);

  onMount(() => {
    const sidebarActivity = storageService.getSidebarActivity();
    if (sidebarActivity) {
      selectedActivity = sidebarActivity;
    }

    if (selectedActivity?.route) {
      push(selectedActivity.route);
    }
  });

  $effect(() => {
    if (selectedActivity) {
      storageService.setSidebarActivity(selectedActivity);
    }
  });

  function handleActivitySelect(event: CustomEvent<{ id: string; label: string; icon?: string }>) {
    selectedActivity = event.detail;
  }
</script>

<div class="dual-sidebar-layout">
  <ActivitySidebar on:select={handleActivitySelect} />
  <ActivityListSidebar activity={selectedActivity} />
</div>

<style>
  .dual-sidebar-layout {
    display: flex;
    height: 100%;
    background: var(--surface-sidebar-secondary);
  }
</style>
