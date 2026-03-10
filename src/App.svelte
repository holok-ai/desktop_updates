<script lang="ts">
  import { onMount } from 'svelte';
  import { replace } from 'svelte-spa-router';
  import { authStore } from './lib/stores/auth.store';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import Toast from './lib/components/Toast.svelte';
  import InstallUpdateModal from './lib/modals/InstallUpdateModal.svelte';
  import { toastStore } from './lib/services/toast.service';
  import { ROUTE } from '$lib/constants/route.constant';
  import { STARTING_PAGE } from '$lib/constants/app.constant';
  import { breadcrumbStore } from '$lib/stores/breadcrumb.store';
  import { resetRendererSessionState } from '$lib/services/session-reset.service';
  import '$lib/services/menu-navigation.service';

  let isLoading = $state(true);
  let updateCheckState = $state<'checking' | 'available' | null>(null);
  let availableVersion = $state<string | null>(null);
  let isInstalling = $state(false);
  let downloadPercent = $state<number | null>(null);

  async function handleInstallNow(): Promise<void> {
    isInstalling = true;
    downloadPercent = 0;

    const unsubscribeProgress = window.electronAPI.updater.onDownloadProgress((percent) => {
      downloadPercent = percent;
    });

    try {
      const result = await window.electronAPI.updater.updateNow();
      if (!result.success) {
        toastStore.show(result.error ?? 'Failed to start update download.', { variant: 'error' });
        updateCheckState = null;
        downloadPercent = null;
        isInstalling = false;
        unsubscribeProgress();
      }
      // On success: keep isInstalling=true so the modal stays in progress state.
      // quitAndInstall is called automatically and the app will restart shortly.
    } catch {
      toastStore.show('Failed to start update download.', { variant: 'error' });
      updateCheckState = null;
      downloadPercent = null;
      isInstalling = false;
      unsubscribeProgress();
    }
  }

  function navigateToStartingPage(startingPage: string | undefined): void {
    let targetRoute: string | null = null;
    let breadcrumbLabel = 'New Thread';
    switch (startingPage) {
      case STARTING_PAGE.CREATE_CHAT:
        targetRoute = ROUTE.NEW_THREAD;
        breadcrumbLabel = 'New Thread';
        break;
      case STARTING_PAGE.THREADS:
        targetRoute = ROUTE.THREADS;
        breadcrumbLabel = 'Threads';
        break;
      case STARTING_PAGE.LAST_PAGE:
        targetRoute = ROUTE.PROJECTS;
        breadcrumbLabel = 'Projects';
        break;
      case STARTING_PAGE.DASHBOARD:
        targetRoute = ROUTE.HOME;
        breadcrumbLabel = 'New Thread';
        break;
    }
    // Seed the breadcrumb regardless of whether we navigate, so the header
    // always shows a label on startup instead of leaving the status badge
    // stranded on the left side.
    breadcrumbStore.seed({ label: breadcrumbLabel, route: targetRoute ?? ROUTE.HOME });
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

              // Check if the result already arrived before we registered the listener
              if (!checkCompleted) {
                const cached = await window.electronAPI.updater.getLastCheckResult();
                if (cached !== null) {
                  checkResult = cached;
                  checkCompleted = true;
                }
              }

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
      resetRendererSessionState();
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

{#if updateCheckState === 'checking'}
  <div class="update-overlay">
    <div class="update-modal">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Checking for updates...</span>
    </div>
  </div>
{:else if updateCheckState === 'available' && availableVersion}
  <InstallUpdateModal
    version={availableVersion}
    {isInstalling}
    {downloadPercent}
    onInstall={handleInstallNow}
    onDismiss={() => (updateCheckState = null)}
  />
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
    align-items: center;
  }

  .update-modal i {
    font-size: 1.1rem;
    color: var(--primary-color, #646cff);
  }
</style>
