<script lang="ts">
  import { authStore } from '../../lib/stores/auth.store';

  let isLoading = false;
  let provider: 'microsoft' | 'google' | 'oauth2' = 'microsoft';

  async function handleLogin() {
    isLoading = true;
    try {
      const authState = await window.electronAPI.auth.mockLogin(provider);
      authStore.setAuthState(authState);
      window.electronAPI.log.info('Login successful', { provider });
    } catch (error) {
      console.error('Login failed:', error);
      window.electronAPI.log.error('Login failed', error);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <h1>Holokai Desktop</h1>
    <p>Sign in to continue</p>

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

    <button onclick={handleLogin} disabled={isLoading}>
      {isLoading ? 'Signing in...' : 'Sign In (Mock)'}
    </button>

    <p class="note">Note: This is a mock authentication for demonstration purposes</p>
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
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: #764ba2;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .note {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: #666;
    text-align: center;
  }
</style>
