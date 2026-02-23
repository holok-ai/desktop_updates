<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser, isAuthenticated, authStore } from '../../stores/auth.store';
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '../../constants/route.constant';
  import { toastStore } from '../../services/toast.service';
  import { AVATAR_COLORS, AVATAR_TYPE } from '../../constants/app.constant';
  import { defaultUserAvatar } from '../../types/app.type';
  import { settingsStore, avatarSettings } from '../../stores/settings.store';

  let showMenu = $state(false);
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  // Seed the store with persisted settings on first mount
  onMount(async () => {
    try {
      const loaded = await window.electronAPI.settings.getAll();
      if (loaded.avatar) {
        settingsStore.setAvatar(loaded.avatar);
      }
    } catch {
      // keep default
    }
  });

  // avatar is always in sync with the store
  const avatar = $derived($avatarSettings ?? defaultUserAvatar);

  function getAvatarBg(colorKey: string): string {
    return AVATAR_COLORS.find((c) => c.value === colorKey)?.bg ?? '#4f46e5';
  }

  function handleClick() {
    push(ROUTE.SETTINGS);
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

  function handleLogin() {
    showMenu = false;
    push(ROUTE.LOGIN);
  }
</script>

<div
  class="avatar-container"
  role="region"
  aria-label="User profile"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <button
    class="avatar-circle"
    aria-label="User profile"
    onclick={handleClick}
    style:background-color={getAvatarBg(avatar.bgColor)}
  >
    {#if avatar.type === AVATAR_TYPE.ICON}
      <i class="pi {avatar.icon}"></i>
    {:else if avatar.type === AVATAR_TYPE.LETTERS && avatar.letters}
      {avatar.letters.toUpperCase()}
    {:else if $isAuthenticated && $currentUser}
      {$currentUser.name?.substring(0, 2).toUpperCase() ?? ''}
    {:else}
      <i class="pi pi-user"></i>
    {/if}
  </button>

  {#if showMenu}
    <div
      class="context-menu avatar-menu"
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
      {#if $isAuthenticated && $currentUser}
        <button class="menu-item" role="menuitem" onclick={handleSettings}>
          <i class="pi pi-cog"></i>
          <span>Settings</span>
        </button>
        <button class="menu-item" role="menuitem" onclick={handleLogout}>
          <i class="pi pi-sign-out"></i>
          <span>Logout</span>
        </button>
      {:else}
        <button class="menu-item" role="menuitem" onclick={handleLogin}>
          <i class="pi pi-sign-in"></i>
          <span>Login</span>
        </button>
        <button class="menu-item" role="menuitem" onclick={handleSettings}>
          <i class="pi pi-cog"></i>
          <span>Settings</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

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
    color: rgba(255, 255, 255, 0.85);
    font-weight: 600;
    font-size: 14px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .avatar-circle:hover {
    border-color: var(--holokai-blue);
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* Avatar-specific menu positioning */
  .avatar-menu {
    top: calc(100% + 4px);
    right: 0;
    min-width: 180px;
  }
</style>
