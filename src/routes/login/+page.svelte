<script lang="ts">
  import { authStore } from '../../lib/stores/auth.store';

  let isLoading = false;
  let isMockLoading = false;
  let provider: 'microsoft' | 'google' | 'oauth2' = 'microsoft';

  async function handleLogin() {
    isLoading = true;
    try {
      await window.electronAPI.auth.startOAuthFlow();
      window.electronAPI.log.info('OAuth flow initiated');
    } catch (error) {
      console.error('Login failed:', error);
      window.electronAPI.log.error('Login failed', error);
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
    } catch (error) {
      console.error('Mock login failed:', error);
      window.electronAPI.log.error('Mock login failed', error);
    } finally {
      isMockLoading = false;
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <h1>Holokai Desktop</h1>
    <p>Sign in to continue</p>

    <button
      onclick={handleLogin}
      disabled={isLoading}
      class="login-primary"
    >
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

    <button
      onclick={handleMockLogin}
      disabled={isMockLoading}
      class="mock-button"
    >
      {isMockLoading ? 'Signing in...' : 'Sign In (Mock)'}
    </button>

    <p class="note">Mock login is for testing purposes only</p>
  </div>
</div>

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
</style>
