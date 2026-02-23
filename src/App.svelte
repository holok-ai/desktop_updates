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
  let isInstalling = $state(false);

  async function handleInstallNow(): Promise<void> {
    isInstalling = true;
    try {
      const result = await window.electronAPI.updater.updateNow();
      if (!result.success) {
        toastStore.show(result.error ?? 'Failed to start update download.', { variant: 'error' });
        updateCheckState = null;
      }
      // On success the download runs in background; update-downloaded handler shows the restart dialog
    } catch {
      toastStore.show('Failed to start update download.', { variant: 'error' });
      updateCheckState = null;
    } finally {
      isInstalling = false;
    }
  }

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
    // Set up update check listener immediately — before any async work — to avoid
    // missing the event if the main process fires it before we're ready.
    let checkResult: { updateAvailable: boolean; version?: string } | null = null;
    let checkCompleted = false;
    let resolveCheck: (() => void) | null = null;

    const unsubscribeCheck = window.electronAPI.updater.onUpdateCheckComplete((result) => {
      checkResult = result;
      checkCompleted = true;
      resolveCheck?.();
    });

    (async () => {
      let isAuthenticated = false;
      try {
        const state = await window.electronAPI.auth.getAuthState();
        authStore.setAuthState(state);
        isAuthenticated = state.isAuthenticated;
      } catch (error) {
        window.electronAPI.log.error('[App] Failed to load auth state', error);
      } finally {
        isLoading = false;

        setTimeout(async () => {
          try {
            const settings = await window.electronAPI.settings.getAll();
            const isDev = await window.electronAPI.updater.isDevelopmentBuild();

            if (!settings.autoCheckUpdates) {
              window.electronAPI.log.info(
                '[App] Update check skipped: autoCheckUpdates is disabled',
              );
            } else if (isDev) {
              window.electronAPI.log.info('[App] Update check skipped: development build');
            } else if (!isAuthenticated) {
              window.electronAPI.log.info('[App] Update check skipped: user is not logged in');
            }

            if (settings.autoCheckUpdates && !isDev && isAuthenticated) {
              updateCheckState = 'checking';

              if (!checkCompleted) {
                await new Promise<void>((resolve) => {
                  resolveCheck = resolve;
                  const fallback = setTimeout(() => resolve(), 15000);
                  const originalResolve = resolve;
                  resolveCheck = () => {
                    clearTimeout(fallback);
                    originalResolve();
                  };
                });
              }

              if (checkResult?.updateAvailable && checkResult.version) {
                availableVersion = checkResult.version;
                updateCheckState = 'available';
              } else {
                updateCheckState = null;
              }
            }

            navigateToStartingPage(settings.startingPage);
          } catch (error) {
            window.electronAPI.log.error('[App] Failed to apply startup page setting', error);
            updateCheckState = null;
            navigateToStartingPage(undefined);
          } finally {
            unsubscribeCheck();
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
      unsubscribeCheck();
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
        <div class="update-available-msg">
          <i class="pi pi-arrow-circle-up"></i>
          <span>Version <strong>{availableVersion}</strong> is available.</span>
        </div>
        <div class="update-actions">
          <button class="update-btn-primary" onclick={handleInstallNow} disabled={isInstalling}>
            {isInstalling ? 'Downloading...' : 'Install Now'}
          </button>
          <button
            class="update-btn-secondary"
            onclick={() => (updateCheckState = null)}
            disabled={isInstalling}
          >
            Install Later
          </button>
        </div>
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
    flex-direction: column;
    gap: 1rem;
    font-size: 0.9375rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    color: var(--text-primary, #111);
    min-width: 260px;
  }

  .update-available-msg {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .update-available-msg i {
    font-size: 1.1rem;
    color: var(--primary-color, #646cff);
  }

  /* checking state — single row */
  .update-modal > i,
  .update-modal > span {
    align-self: center;
  }

  .update-modal > i {
    font-size: 1.1rem;
    color: var(--primary-color, #646cff);
  }

  .update-actions {
    display: flex;
    gap: 0.625rem;
    justify-content: flex-end;
  }

  .update-btn-primary {
    padding: 0.3rem 1rem;
    border: none;
    border-radius: 6px;
    background: var(--primary-color, #646cff);
    color: #fff;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .update-btn-primary:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .update-btn-secondary {
    padding: 0.3rem 1rem;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    background: var(--surface-hover, #f0f0f0);
    color: #1a1a1a;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .update-btn-secondary:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
