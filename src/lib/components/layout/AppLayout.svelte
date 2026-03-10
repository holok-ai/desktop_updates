<script lang="ts">
  import Header from './Header.svelte';
  import Sidebar from './Sidebar.svelte';
  import Router from 'svelte-spa-router';
  import { routes } from '$lib/router/routes';
</script>

<div class="app-layout">
  <Sidebar />
  <div class="right-column">
    <Header />
    <main class="content">
      <Router {routes} />
    </main>
  </div>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: row;
    height: 100vh;
    overflow: hidden;
  }

  .right-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 1rem 2rem 2rem 2rem;
    background: var(--surface-main);
    transition: all 0.3s ease;
  }
</style>
