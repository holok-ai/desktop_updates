<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import Navbar from './Navbar.svelte';
  import Home from '../../../routes/+page.svelte';
  import Threads from '../../../routes/threads/+page.svelte';

  let currentPage: 'home' | 'threads' = 'home';

  onMount(() => {
    // Listen for menu commands
    const cleanups: Array<() => void> = [];

    cleanups.push(
      window.electronAPI.onMenuCommand('menu:new-thread', () => {
        currentPage = 'threads';
      })
    );

    cleanups.push(
      window.electronAPI.onMenuCommand('menu:refresh', () => {
        // Trigger refresh
        window.location.reload();
      })
    );

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  });

  function navigateTo(page: 'home' | 'threads') {
    currentPage = page;
  }
</script>

<div class="layout">
  <Header />
  <div class="main-container">
    <Navbar {currentPage} on:navigate={(e) => navigateTo(e.detail)} />
    <main class="content">
      {#if currentPage === 'home'}
        <Home />
      {:else if currentPage === 'threads'}
        <Threads />
      {/if}
    </main>
  </div>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f5f5f5;
  }

  .main-container {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    background: #f5f5f5;
  }
</style>
