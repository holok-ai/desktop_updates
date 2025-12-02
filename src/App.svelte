<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './lib/stores/auth.store';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import Login from './routes/login/+page.svelte';
  import ConfirmNavigationModal from './lib/components/modals/ConfirmNavigationModal.svelte';
  import type { AuthState } from '../src-electron/services/auth.service';
  import '$lib/services/menu-navigation.service';

  let isLoading = $state(true);
  let authState = $state<AuthState>({ isAuthenticated: false, user: null, tokens: null });

  // Load initial auth state
  onMount(async () => {
    try {
      const state = await window.electronAPI.auth.getAuthState();
      authStore.setAuthState(state);
      authState = state;
    } catch (error) {
      console.error('Failed to load auth state:', error);
    } finally {
      isLoading = false;
    }

    // Listen for OAuth callback success
    const unsubscribeSuccess = window.electronAPI.auth.onAuthCallbackSuccess((data) => {
      window.electronAPI.log.info('[App] OAuth callback success received', data);
      authStore.setAuthState({
        isAuthenticated: data.isAuthenticated,
        user: data.user,
        tokens: null, // tokens stay in main process
      });
    });

    // Listen for OAuth callback errors
    const unsubscribeError = window.electronAPI.auth.onAuthCallbackError((error) => {
      window.electronAPI.log.error('[App] OAuth callback error received', error);
      console.error('OAuth authentication failed:', error.description);
      // Could show error message to user here
    });

    // Cleanup listeners when component unmounts
    return () => {
      unsubscribeSuccess();
      unsubscribeError();
    };
  });

  // Subscribe to auth store changes
  $effect(() => {
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

<!-- Global navigation confirmation modal -->
<ConfirmNavigationModal />

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.5rem;
  }
</style>
