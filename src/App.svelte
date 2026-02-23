<script lang="ts">
  import { onMount } from 'svelte';
  import { replace } from 'svelte-spa-router';
  import { authStore } from './lib/stores/auth.store';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import Toast from './lib/components/Toast.svelte';
  import { toastStore } from './lib/services/toast.service';
  import { ROUTE } from '$lib/constants/route.constant';
  import { STARTING_PAGE } from '$lib/constants/app.constant';
  import '$lib/services/menu-navigation.service';

  let isLoading = $state(true);
  let updateCheckState = $state<'checking' | 'available' | null>(null);
  let availableVersion = $state<string | null>(null);

  function navigateToStartingPage(startingPage: string | undefined): void {
    let targetRoute: string | null = null;
    switch (startingPage) {
      case STARTING_PAGE.CREATE_CHAT:
        targetRoute = ROUTE.NEW_THREAD;
        break;
      case STARTING_PAGE.THREADS:
        targetRoute = ROUTE.THREADS;
        break;
      case STARTING_PAGE.LAST_PAGE:
        targetRoute = ROUTE.PROJECTS;
        break;
      case STARTING_PAGE.DASHBOARD:
        targetRoute = ROUTE.HOME;
        break;
    }
    if (targetRoute) replace(targetRoute);
  }

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

        setTimeout(async () => {
          try {
            const settings = await window.electronAPI.settings.getAll();

            const isDev = await window.electronAPI.updater.isDevelopmentBuild();

            if (settings.autoCheckUpdates && !isDev) {
              updateCheckState = 'checking';

              await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                  unsubscribe();
                  resolve();
                }, 15000);

                const unsubscribe = window.electronAPI.updater.onUpdateCheckComplete((result) => {
                  clearTimeout(timeout);
                  if (result.updateAvailable && result.version) {
                    availableVersion = result.version;
                    updateCheckState = 'available';
                  } else {
                    updateCheckState = null;
                  }
                  resolve();
                });
              });
            }

            navigateToStartingPage(settings.startingPage);
          } catch (error) {
            window.electronAPI.log.error('[App] Failed to apply startup page setting', error);
            updateCheckState = null;
            navigateToStartingPage(undefined);
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
</script>

{#if isLoading}
  <div class="loading">Loading...</div>
{:else}
  <AppLayout />
{/if}

{#if updateCheckState}
  <div class="update-overlay">
    <div class="update-modal">
      {#if updateCheckState === 'checking'}
        <i class="pi pi-spin pi-spinner"></i>
        <span>Checking for updates...</span>
      {:else if updateCheckState === 'available'}
        <i class="pi pi-arrow-circle-up"></i>
        <span>Version {availableVersion} is available.</span>
        <button onclick={() => (updateCheckState = null)}>OK</button>
      {/if}
    </div>
  </div>
{/if}

<Toast />

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.5rem;
  }

  .update-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .update-modal {
    background: var(--surface-card, #fff);
    border-radius: 10px;
    padding: 1.5rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9375rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    color: var(--text-primary, #111);
  }

  .update-modal i {
    font-size: 1.1rem;
    color: var(--primary-color, #646cff);
  }

  .update-modal button {
    margin-left: 0.5rem;
    padding: 0.25rem 0.875rem;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    background: var(--surface-hover, #f0f0f0);
    cursor: pointer;
    font-size: 0.875rem;
  }
</style>
