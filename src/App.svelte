<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './lib/stores/auth.store';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import Login from './routes/login/+page.svelte';

  let isLoading = true;
  let authState = { isAuthenticated: false, user: null, tokens: null };

  onMount(async () => {
    // Check authentication status on app load
    try {
      const state = await window.electronAPI.auth.getAuthState();
      authStore.setAuthState(state);
      authState = state;
    } catch (error) {
      console.error('Failed to load auth state:', error);
    } finally {
      isLoading = false;
    }

    // Subscribe to auth store changes
    const unsubscribe = authStore.subscribe((state) => {
      authState = state;
    });

    return unsubscribe;
  });
</script>

{#if isLoading}
  <div class="loading">Loading...</div>
{:else if authState.isAuthenticated}
  <AppLayout />
{:else}
  <Login />
{/if}

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.5rem;
  }
</style>
