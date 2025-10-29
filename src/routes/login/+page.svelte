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

    <button onclick={handleLogin} disabled={isLoading} class="primary-button">
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

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .login-card {
    background: white;
    color: #333;
    padding: 3rem;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 100%;
  }

  h1 {
    margin-bottom: 0.5rem;
    color: #333;
  }

  .provider-select {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 2rem 0;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  button {
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }

  .primary-button {
    background: #667eea;
    color: white;
    margin-bottom: 1.5rem;
  }

  .primary-button:hover:not(:disabled) {
    background: #5568d3;
  }

  .mock-button {
    background: #e0e0e0;
    color: #333;
    margin-top: 1rem;
  }

  .mock-button:hover:not(:disabled) {
    background: #d0d0d0;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .divider {
    text-align: center;
    margin: 1.5rem 0;
    position: relative;
  }

  .divider::before,
  .divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: #ddd;
  }

  .divider::before {
    left: 0;
  }

  .divider::after {
    right: 0;
  }

  .divider span {
    background: white;
    padding: 0 1rem;
    color: #999;
    font-size: 0.875rem;
  }

  .note {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: #666;
    text-align: center;
  }
</style>
