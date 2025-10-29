<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import Navbar from './Navbar.svelte';
  import Home from '../../../routes/+page.svelte';
  import Threads from '../../../routes/threads/+page.svelte';
  import { router } from '$lib/services/router.service';
  import { ROUTE, type RoutePath } from '$lib/constants/route.constant';

  let currentPath = $state<RoutePath>(ROUTE.HOME);

  onMount(() => {
    router.start();
    const unsubscribe = router.current.subscribe((route) => {
      currentPath = route.path as RoutePath;
    });
    return unsubscribe;
  });

</script>

<div class="layout">
  <Header />
  <div class="main-container">
    <Navbar />
    <main class="content">
      {#if currentPath === ROUTE.HOME}
        <Home />
      {:else if currentPath === ROUTE.THREADS}
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
