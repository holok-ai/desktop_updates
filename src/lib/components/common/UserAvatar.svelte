<script lang="ts">
  import { currentUser, isAuthenticated, authStore } from '../../stores/auth.store';
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '../../constants/route.constant';
  import { toastStore } from '../../services/toast.service';

  let showMenu = $state(false);
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  // Get user initials from name
  function getInitials(name: string | undefined): string {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function handleClick() {
    if (!$isAuthenticated) {
      push(ROUTE.LOGIN);
    }
  }

  function handleMouseEnter() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    showMenu = true;
  }

  function handleMouseLeave() {
    // Add a small delay before hiding to allow moving to menu
    hideTimeout = setTimeout(() => {
      showMenu = false;
    }, 150);
  }

  async function handleLogout() {
    const userName = $currentUser?.name;
    showMenu = false;
    try {
      await window.electronAPI.auth.logout();
      authStore.logout();
      window.electronAPI.log.info('[UserAvatar] User logged out');
      if (userName) {
        toastStore.show(`${userName} has been logged out.`, { variant: 'success' });
      }
    } catch (error) {
      window.electronAPI.log.error('[UserAvatar] Logout failed', error);
      console.error('Logout failed:', error);
    } finally {
      push(ROUTE.LOGIN);
    }
  }

  function handleSettings() {
    showMenu = false;
    push(ROUTE.SETTINGS);
  }
</script>

{#if $isAuthenticated && $currentUser}
  <div
    class="avatar-container"
    role="region"
    aria-label="User profile"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
  >
    <button class="avatar-circle" aria-label="User profile">
      {getInitials($currentUser.name)}
    </button>

    {#if showMenu}
      <div
        class="profile-menu"
        role="menu"
        tabindex="0"
        onmouseenter={handleMouseEnter}
        onmouseleave={handleMouseLeave}
        onkeydown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            showMenu = false;
          }
        }}
      >
        <button class="menu-item" role="menuitem" onclick={handleSettings}>
          <i class="pi pi-cog"></i>
          <span>Settings</span>
        </button>
        <button class="menu-item" role="menuitem" onclick={handleLogout}>
          <i class="pi pi-sign-out"></i>
          <span>Logout</span>
        </button>
      </div>
    {/if}
  </div>
{:else}
  <button class="login-box" onclick={handleClick}>
    Login
  </button>
{/if}

<style>
  .avatar-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .avatar-circle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary-color, #4f46e5);
    color: rgba(255, 255, 255, 0.85);
    font-weight: 600;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .avatar-circle:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .profile-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--surface-card, #ffffff);
    border-radius: 0.75rem;
    border: 1px solid var(--input-border);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.15);
    min-width: 180px;
    z-index: 1000;
  }

  :global(html.dark) .profile-menu {
    background: #2a2a2a;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.2s ease;
    font-size: 14px;
  }

  .menu-item:hover {
    background: var(--surface-hover);
  }

  .menu-item i {
    font-size: 16px;
  }

  .login-box {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    background: transparent;
    color: var(--text-active);
    font-weight: 500;
    font-size: 14px;
    border: 1px solid var(--surface-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .login-box:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.05));
    border-color: var(--text-active);
  }
</style>
