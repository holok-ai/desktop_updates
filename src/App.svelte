<script lang="ts">
  import { onMount } from 'svelte';
  import { replace } from 'svelte-spa-router';
  import { authStore } from './lib/stores/auth.store';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import Toast from './lib/components/Toast.svelte';
  import { toastStore } from './lib/services/toast.service';
  import ConfirmNavigationModal from './lib/components/modals/ConfirmNavigationModal.svelte';
  import DeleteProjectModal from './lib/components/modals/DeleteProjectModal.svelte';
  import { deleteProjectModalStore } from './lib/stores/delete-project-modal.store';
  import { ROUTE } from '$lib/constants/route.constant';
  import { STARTING_PAGE } from '$lib/constants/app.constant';
  import '$lib/services/menu-navigation.service';

  let isLoading = $state(true);

  // Load initial auth state and handle startup page
  onMount(() => {
    (async () => {
      try {
        const state = await window.electronAPI.auth.getAuthState();
        authStore.setAuthState(state);
      } catch (error) {
        window.electronAPI.log.error('[App] Failed to load auth state', error);
      } finally {
        isLoading = false;

        // Handle startup page routing after app is loaded
        // Use setTimeout to ensure router is ready
        setTimeout(async () => {
          try {
            const settings = await window.electronAPI.settings.getAll();

            // Map startup page setting to route
            let targetRoute: string | null = null;
            switch (settings.startingPage) {
              case STARTING_PAGE.CREATE_CHAT:
                targetRoute = ROUTE.NEW_THREAD;
                break;
              case STARTING_PAGE.THREADS:
                targetRoute = ROUTE.THREADS;
                break;
              case STARTING_PAGE.LAST_PAGE:
                targetRoute = ROUTE.PROJECTS; // For now, use projects as "last page"
                break;
              case STARTING_PAGE.DASHBOARD:
                targetRoute = ROUTE.HOME;
                break;
            }

            // Navigate to target route if specified
            if (targetRoute) {
              replace(targetRoute);
            }
          } catch (error) {
            window.electronAPI.log.error('[App] Failed to apply startup page setting', error);
          }
        }, 100);
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

  // Handle project deletion success
  function handleProjectDeleted() {
    deleteProjectModalStore.close();
    toastStore.show('Project deleted successfully', { variant: 'success' });
  }
</script>

{#if isLoading}
  <div class="loading">Loading...</div>
{:else}
  <AppLayout />
{/if}

<Toast />

<!-- Global navigation confirmation modal -->
<ConfirmNavigationModal />

<!-- Global delete project modal -->
<DeleteProjectModal 
  bind:show={$deleteProjectModalStore.show} 
  bind:project={$deleteProjectModalStore.project}
  on:deleted={handleProjectDeleted}
/>

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.5rem;
  }
</style>
