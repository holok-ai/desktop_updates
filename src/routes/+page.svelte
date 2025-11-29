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
    The Desktop application is an agent platform for automating personal and enterprise workflow
    using AI.
  </p>

  <div class="system-info">
    <h2 class="mb-4">System Information</h2>
    <p class="mb-2"><strong>Platform:</strong> {platform}</p>
    <p class="mb-2"><strong>Electron Version:</strong> {version}</p>
  </div>

  <div class="features">
    <h2 class="mb-4">Desktop Highlights:</h2>
    <ul class="ml-6 mt-4">
      <li>Chat with your favorite LLM</li>
      <li>Organize chats using threads</li>
      <li>Use multiple AI providers and models</li>
      <li>Optimize model interaction with advanced prompt retry and branching</li>
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
