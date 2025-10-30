<script lang="ts">
  import Header from './Header.svelte';
  import Navbar from './Navbar.svelte';
  import Router from 'svelte-spa-router';
  import { routes } from '$lib/router/routes';

</script>

<div class="main-container">
  <Navbar />
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
    background: #f5f5f5;
  }
</style>
