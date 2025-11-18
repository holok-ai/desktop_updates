<script lang="ts">
  import { currentUser } from '../../stores/auth.store';

  async function handleLogout() {
    await window.electronAPI.auth.logout();
    window.location.reload();
  }
</script>

<header>
  <div class="logo">Holokai Desktop</div>
  <div class="user-section">
    {#if $currentUser}
      <span>{$currentUser.name}</span>
      <button class="logout-button" onclick={handleLogout}>Logout</button>
    {/if}
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--content-padding) calc(var(--content-padding) * 1.6);
    background: var(--surface-sidebar-primary);
    border-bottom: 1px solid var(--surface-border);
  }

  .logo {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-active);
  }

  .user-section {
    display: flex;
    align-items: center;
    gap: var(--content-padding);
    color: var(--text-active);
  }

  .logout-button {
    background: transparent;
    border: 1px solid var(--surface-border);
    color: var(--text-active);
    padding: calc(var(--inline-spacing) * 0.75) var(--content-padding);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-button:hover {
    background: var(--surface-hover);
    border-color: var(--border-active);
  }
</style>
