<script lang="ts">
  import { toastStore } from '../services/toast.service';

  const { position = 'top-right' } = $props<{
    position?:
      | 'top'
      | 'bottom'
      | 'left'
      | 'right'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'bottom-center'
      | 'top-center'
      | 'left-center'
      | 'right-center';
  }>();

  let toast = $state<{ id: string; message: string; duration?: number; variant?: string } | null>(
    null,
  );

  toastStore.subscribe((value) => {
    toast = value;
  });
</script>

{#if toast}
  <div class={`toast ${position} ${toast.variant ?? 'success'}`} role="alert">
    <span class="toast-message">{toast.message}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 2rem;
    padding: 12px;
    border-radius: var(--border-radius);
    box-shadow: 0 10px 30px color-mix(in srgb, var(--surface-900) 45%, transparent);
    z-index: 10000;
    min-width: 240px;
    max-width: 400px;
    text-align: center;
    animation: slideUp 0.3s ease-out;
  }

  .toast-message {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    line-clamp: 3;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
    color: var(--surface-0);
  }

  .toast.success {
    background: var(--green-500);
    color: var(--surface-0);
  }

  .toast.info {
    background: var(--primary-500);
    color: var(--surface-0);
  }

  .toast.warning {
    background: var(--yellow-500);
    color: var(--surface-900);
  }

  .toast.error {
    background: var(--error-color);
    color: var(--surface-0);
  }

  .toast.top {
    top: 2rem;
    bottom: auto;
  }

  .toast.bottom {
    bottom: 2rem;
    top: auto;
  }

  .toast.bottom-left {
    left: 2rem;
    bottom: 2rem;
    transform: none;
  }

  .toast.bottom-right {
    right: 2rem;
    left: auto;
    bottom: 2rem;
    transform: none;
  }

  .toast.top-left {
    left: 2rem;
    top: 2rem;
    bottom: auto;
    transform: none;
  }

  .toast.top-right {
    right: 2rem;
    top: 2rem;
    left: auto;
    bottom: auto;
    transform: none;
  }

  .toast.left {
    left: 2rem;
    top: 50%;
    bottom: auto;
    transform: translateY(-50%);
  }

  .toast.right {
    right: 2rem;
    left: auto;
    top: 50%;
    bottom: auto;
    transform: translateY(-50%);
  }

  .toast.bottom-center {
    left: 50%;
    bottom: 2rem;
    transform: translateX(-50%);
  }

  .toast.top-center {
    left: 50%;
    top: 2rem;
    transform: translateX(-50%);
  }

  .toast.left-center {
    left: 2rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .toast.right-center {
    right: 2rem;
    top: 50%;
    transform: translateY(-50%);
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
