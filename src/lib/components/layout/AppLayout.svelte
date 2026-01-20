<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Router from 'svelte-spa-router';
  import { replace } from 'svelte-spa-router';
  import { routes } from '$lib/router/routes';

  // Always start at home page on app launch
  onMount(() => {
    replace('/');
  });
</script>

<div class="main-container">
  <Sidebar />
  <main class="content">
    <Router {routes} />
  </main>
</div>

<style>
  .main-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    height: 100vh;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 2rem;
    background: var(--surface-main);
    transition: all 0.3s ease;
  }
</style>
