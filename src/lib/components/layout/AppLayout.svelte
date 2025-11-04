<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import Router from 'svelte-spa-router';
  import { routes } from '$lib/router/routes';
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
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    background: var(--surface-main);
    transition: all 0.3s ease;
  }
</style>
