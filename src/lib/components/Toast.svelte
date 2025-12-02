<script lang="ts">
  import { toastStore } from '../services/toast.service';

  let toast = $state<{ id: string; message: string; duration?: number } | null>(null);

  toastStore.subscribe((value) => {
    toast = value;
  });
</script>

{#if toast}
  <div class="toast" role="alert">
    {toast.message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: color-mix(in srgb, var(--surface-900) 92%, transparent);
    color: var(--surface-card);
    padding: calc(var(--inline-spacing) * 1.2) calc(var(--content-padding) * 1.2);
    border-radius: var(--border-radius);
    box-shadow: 0 10px 30px color-mix(in srgb, var(--surface-900) 45%, transparent);
    z-index: 10000;
    min-width: 240px;
    text-align: center;
    font-weight: 600;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>

