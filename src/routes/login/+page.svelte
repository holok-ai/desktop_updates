<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { authStore } from '../../lib/stores/auth.store';
  import { toastStore } from '../../lib/services/toast.service';
  import { ROUTE } from '../../lib/constants/route.constant';
  import { STARTING_PAGE } from '../../lib/constants/app.constant';

  type AuthErrorPayload = { error?: string; description?: string; message?: string };

  let isLoading = false;
  let toastMessage = '';
  let toastTimeout: number | null = null;
  let hasNavigatedHome = false;

  onMount(() => {
    const unsubscribeAuth = authStore.subscribe((state) => {
      if (state.isAuthenticated) {
        navigateHome();
      } else {
        hasNavigatedHome = false;
      }
    });

    const unsubscribeSuccess = window.electronAPI.auth.onAuthCallbackSuccess((data) => {
      window.electronAPI.log.info('[Login] Auth callback success received', data);
      authStore.setAuthState({
        isAuthenticated: data.isAuthenticated,
        user: data.user,
        tokens: null,
      });
      if (data.user?.name) {
        toastStore.show(`${data.user.name} successfully logged in.`, { variant: 'success' });
      }
      navigateHome();
    });

    const unsubscribeError = window.electronAPI.auth.onAuthCallbackError((error) => {
      window.electronAPI.log.error('[Login] Auth callback failed', error);
      showToast(formatAuthError(error));
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSuccess();
      unsubscribeError();
    };
  });

  async function navigateHome(): Promise<void> {
    if (hasNavigatedHome) {
      return;
    }

    hasNavigatedHome = true;

    // Get the startup page setting
    try {
      const settings = await window.electronAPI.settings.getAll();
      const startingPage = settings.startingPage || STARTING_PAGE.CREATE_CHAT;

      // Map startup page setting to route
      let targetRoute: string = ROUTE.HOME;
      switch (startingPage) {
        case STARTING_PAGE.CREATE_CHAT:
          targetRoute = ROUTE.NEW_THREAD;
          break;
        case STARTING_PAGE.THREADS:
          targetRoute = ROUTE.THREADS;
          break;
        case STARTING_PAGE.DASHBOARD:
          targetRoute = ROUTE.HOME;
          break;
        case STARTING_PAGE.LAST_PAGE:
          // TODO: Implement last page tracking
          targetRoute = ROUTE.HOME;
          break;
        default:
          targetRoute = ROUTE.HOME;
      }

      push(targetRoute);
    } catch (error) {
      window.electronAPI.log.error('[Login] Failed to get startup page setting', error);
      // Fallback to home page
      push(ROUTE.HOME);
    }
  }

  async function handleLogin() {
    isLoading = true;
    try {
      await window.electronAPI.auth.startOAuthFlow();
      window.electronAPI.log.info('OAuth flow initiated');
    } catch (error) {
      const message = formatAuthError(error);
      window.electronAPI.log.error('Login failed', error);
      showToast(message);
    } finally {
      isLoading = false;
    }
  }

  function showToast(message: string, duration = 4000): void {
    toastMessage = message;
    if (toastTimeout) {
      window.clearTimeout(toastTimeout);
    }
    toastTimeout = window.setTimeout(() => {
      toastMessage = '';
      toastTimeout = null;
    }, duration);
  }

  function formatAuthError(error: unknown): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return `Login failed: ${error}`;
    }

    if (error instanceof Error && error.message) {
      return `Login failed: ${error.message}`;
    }

    const payload = error as AuthErrorPayload;
    if (payload?.description || payload?.message) {
      return `Login failed: ${payload.description ?? payload.message}`;
    }

    return 'Login failed: Something went wrong, please try again.';
  }
</script>

<div class="login-container">
  <div class="login-card">
    <div class="banner">
      <h1>Holokai</h1>
    </div>

    <p class="info-text">
      You will need a Holokai account to use Desktop. Press the login button to provide your
      credentials on the Moku web site. Your access from Moku will be used by Desktop.
    </p>

    <button onclick={handleLogin} disabled={isLoading} class="login-primary">
      {isLoading ? 'Redirecting...' : 'Login'}
    </button>
  </div>
</div>

{#if toastMessage}
  <div class="toast">{toastMessage}</div>
{/if}

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: var(--surface-main);
    padding: 2rem;
  }

  .login-card {
    background: color-mix(in srgb, var(--surface-card) 95%, white);
    color: var(--text-primary);
    padding: 3rem;
    border-radius: calc(var(--border-radius) * 2);
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    max-width: 500px;
    width: 100%;
  }

  :global(html.dark) .login-card {
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .banner {
    text-align: center;
    margin-bottom: 2rem;
  }

  .banner h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--primary-color);
    margin: 0;
  }

  .info-text {
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.6;
    margin-bottom: 2rem;
    text-align: center;
  }

  button {
    font-size: 16px;
    font-weight: 600;
  }

  .login-primary {
    background: var(--holokai-blue);
    color: white;
    border: 1px solid var(--holokai-blue);
    padding: 14px 32px;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s;
    width: 50%;
    margin: 0 auto;
    display: block;
  }

  .login-primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--holokai-blue) 85%, black);
    border-color: color-mix(in srgb, var(--holokai-blue) 85%, black);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .toast {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: color-mix(in srgb, var(--surface-900) 92%, transparent);
    color: var(--surface-card);
    padding: calc(var(--inline-spacing) * 1.2) calc(var(--content-padding) * 1.2);
    border-radius: var(--border-radius);
    box-shadow: 0 10px 30px color-mix(in srgb, var(--surface-900) 45%, transparent);
    z-index: 10;
    min-width: 240px;
    text-align: center;
    font-weight: 600;
  }
</style>
