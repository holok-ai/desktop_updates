<script lang="ts">
  import Header from './Header.svelte';
  import Sidebar from './Sidebar.svelte';
  import Router from 'svelte-spa-router';
  import { routes } from '$lib/router/routes';
</script>

<div class="app-layout">
  <Header />
  <div class="main-container">
    <Sidebar />
    <main class="content">
      <Router {routes} />
    </main>
  </div>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .main-container {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 1rem 2rem 2rem 2rem; /* Reduced top padding from 2rem to 1rem */
    background: var(--surface-main);
    transition: all 0.3s ease;
  }
</style>
