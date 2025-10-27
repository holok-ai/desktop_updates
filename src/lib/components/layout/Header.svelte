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
      <button on:click={handleLogout}>Logout</button>
    {/if}
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: #1a1a1a;
    border-bottom: 1px solid #333;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
  }

  .user-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: white;
  }
</style>
