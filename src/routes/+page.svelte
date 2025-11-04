<script lang="ts">
  import { onMount } from 'svelte';

  let platform = '';
  let version = '';

  onMount(async () => {
    platform = await window.electronAPI.system.platform();
    version = await window.electronAPI.system.version();
  });
</script>

<div class="home">
  <h1 class="mb-4">Welcome to Holokai Desktop</h1>
  <p>
    This is a reference implementation demonstrating best practices for building Electron
    applications with Svelte.
  </p>

  <div class="system-info">
    <h2 class="mb-4">System Information</h2>
    <p class="mb-2"><strong>Platform:</strong> {platform}</p>
    <p class="mb-2"><strong>Electron Version:</strong> {version}</p>
  </div>

  <div class="features">
    <h2 class="mb-4">Features Demonstrated:</h2>
    <ul class="ml-6 mt-4">
      <li>Context Bridge for secure IPC</li>
      <li>Reactive Svelte stores for state management</li>
      <li>Service layer for business logic</li>
      <li>Real-time event broadcasting</li>
      <li>Mock authentication system</li>
    </ul>
  </div>
</div>

<style>
  .home {
    max-width: 800px;
  }

  .system-info,
  .features {
    margin-top: 2rem;
    padding: 1.5rem;
    background: var(--surface-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  li {
    margin-bottom: 0.5rem;
  }
</style>
