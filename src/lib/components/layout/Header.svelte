<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '../../constants/route.constant';
  import UserAvatar from '../common/UserAvatar.svelte';

  function handleLogoClick() {
    push(ROUTE.HOME);
  }
</script>

<header>
  <button class="logo" onclick={handleLogoClick}>Holokai</button>
  <UserAvatar />
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 56px;
    padding: 0 24px;
    background: var(--surface-sidebar-primary);
    border-bottom: 1px solid var(--surface-border);
  }

  .logo {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s ease;
    outline: none;
  }

  .logo:hover {
    color: rgba(255, 255, 255, 1);
  }

  .logo:focus {
    outline: none;
  }

  .logo:focus:not(:focus-visible) {
    outline: none;
  }
</style>
