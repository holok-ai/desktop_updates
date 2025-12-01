<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { authStore } from '../../lib/stores/auth.store';

  type AuthErrorPayload = { error?: string; description?: string; message?: string };

  let isLoading = false;
  let isMockLoading = false;
  let provider: 'microsoft' | 'google' | 'oauth2' = 'microsoft';
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

  function navigateHome(): void {
    if (hasNavigatedHome) {
      return;
    }

    hasNavigatedHome = true;
    push('/');
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

  async function handleMockLogin() {
    isMockLoading = true;
    try {
      const authState = await window.electronAPI.auth.mockLogin(provider);
      authStore.setAuthState(authState);
      window.electronAPI.log.info('Mock login successful', { provider });
      navigateHome();
    } catch (error) {
      const message = formatAuthError(error);
      window.electronAPI.log.error('Mock login failed', error);
      showToast(message);
    } finally {
      isMockLoading = false;
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
    <h1>Holokai Desktop</h1>
    <p>Sign in to continue</p>

    <button onclick={handleLogin} disabled={isLoading} class="login-primary">
      {isLoading ? 'Redirecting...' : 'Login'}
    </button>

    <div class="divider">
      <span>or use mock login</span>
    </div>

    <div class="provider-select">
      <label>
        <input type="radio" bind:group={provider} value="microsoft" />
        Microsoft
      </label>
      <label>
        <input type="radio" bind:group={provider} value="google" />
        Google
      </label>
      <label>
        <input type="radio" bind:group={provider} value="oauth2" />
        OAuth 2.0
      </label>
    </div>

    <button onclick={handleMockLogin} disabled={isMockLoading} class="mock-button">
      {isMockLoading ? 'Signing in...' : 'Sign In (Mock)'}
    </button>

    <p class="note">Mock login is for testing purposes only</p>
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
    background: linear-gradient(
      135deg,
      var(--primary-400) 0%,
      var(--purple-500, var(--primary-600)) 100%
    );
  }

  .login-card {
    background: var(--surface-card);
    color: var(--text-primary);
    padding: calc(var(--content-padding) * 2.4);
    border-radius: calc(var(--border-radius) * 2);
    box-shadow: 0 calc(var(--content-padding) * 2) calc(var(--content-padding) * 4)
      color-mix(in srgb, var(--surface-900) 18%, transparent);
    max-width: 400px;
    width: 100%;
  }

  h1 {
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  .provider-select {
    display: flex;
    flex-direction: column;
    gap: calc(var(--inline-spacing) * 1.5);
    margin: calc(var(--content-padding) * 1.6) 0;
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
    cursor: pointer;
    color: var(--text-primary);
  }

  button {
    width: 100%;
    font-size: 16px;
    font-weight: 600;
  }

  .login-primary {
    background: var(--primary-color);
    color: var(--primary-color-text);
    border: 1px solid var(--primary-color);
    margin-bottom: calc(var(--content-padding) * 1.2);
    padding: var(--inline-spacing) calc(var(--content-padding) * 1.2);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s;
  }

  .login-primary:hover:not(:disabled) {
    background: var(--primary-600);
    border-color: var(--primary-600);
  }

  .mock-button {
    background: var(--surface-100);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    margin-top: var(--content-padding);
    padding: var(--inline-spacing) calc(var(--content-padding) * 1.2);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s;
  }

  .mock-button:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--surface-border);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .divider {
    text-align: center;
    margin: calc(var(--content-padding) * 1.2) 0;
    position: relative;
  }

  .divider::before,
  .divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: var(--surface-border);
  }

  .divider::before {
    left: 0;
  }

  .divider::after {
    right: 0;
  }

  .divider span {
    background: var(--surface-card);
    padding: 0 var(--content-padding);
    color: var(--text-secondary);
    font-size: 14px;
  }

  .note {
    margin-top: var(--content-padding);
    font-size: 14px;
    color: var(--text-secondary);
    text-align: center;
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
