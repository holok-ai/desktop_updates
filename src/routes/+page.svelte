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
  <h1>Welcome to Holokai Desktop</h1>
  <p>This is a reference implementation demonstrating best practices for building Electron applications with Svelte.</p>
  
  <div class="system-info">
    <h2>System Information</h2>
    <p><strong>Platform:</strong> {platform}</p>
    <p><strong>Electron Version:</strong> {version}</p>
  </div>
  
  <div class="features">
    <h2>Features Demonstrated:</h2>
    <ul>
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

  h1 {
    margin-bottom: 1rem;
    color: #333;
  }

  p {
    color: #666;
  }

  .system-info, .features {
    margin-top: 2rem;
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .system-info h2, .features h2 {
    color: #333;
    margin-bottom: 1rem;
  }

  .system-info p {
    margin-bottom: 0.5rem;
  }

  ul {
    margin-left: 1.5rem;
    margin-top: 1rem;
  }

  li {
    margin-bottom: 0.5rem;
    color: #666;
  }
</style>
