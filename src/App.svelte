<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './lib/stores/auth.store';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import Toast from './lib/components/Toast.svelte';
  import { toastStore } from './lib/services/toast.service';
  import ConfirmNavigationModal from './lib/components/modals/ConfirmNavigationModal.svelte';
  import '$lib/services/menu-navigation.service';

  let isLoading = $state(true);

  // Load initial auth state
  onMount(() => {
    (async () => {
      try {
        const state = await window.electronAPI.auth.getAuthState();
        authStore.setAuthState(state);
      } catch (error) {
        window.electronAPI.log.error('[App] Failed to load auth state', error);
      } finally {
        isLoading = false;
      }
    })();

    // Listen for OAuth callback success
    const unsubscribeSuccess = window.electronAPI.auth.onAuthCallbackSuccess((data) => {
      window.electronAPI.log.info('[App] OAuth callback success received', data);
      authStore.setAuthState({
        isAuthenticated: data.isAuthenticated,
        user: data.user,
        tokens: null, // tokens stay in main process
      });
      if (data.user?.name) {
        toastStore.show(`${data.user.name} successfully logged in.`, { variant: 'success' });
      }
    });

    // Listen for OAuth callback errors
    const unsubscribeError = window.electronAPI.auth.onAuthCallbackError((error) => {
      window.electronAPI.log.error('[App] OAuth callback error received', error);
      window.electronAPI.log.error('[App] OAuth authentication failed', error.description);
    });

    // Cleanup listeners when component unmounts
    return () => {
      unsubscribeSuccess();
      unsubscribeError();
    };
  });
</script>

{#if isLoading}
  <div class="loading">Loading...</div>
{:else}
  <AppLayout />
{/if}

<Toast />

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
