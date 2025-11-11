<script lang="ts">
  interface Props {
    error: string;
    type?: 'error' | 'warning' | 'info';
    onDismiss?: () => void;
  }

  let { error, type = 'error', onDismiss }: Props = $props();

  const iconMap = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const colorMap = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
</script>

<div
  class="file-error-banner flex items-start gap-3 p-4 border rounded-lg {colorMap[type]}"
  role="alert"
  aria-live="assertive"
>
  <div class="flex-shrink-0 text-2xl" aria-hidden="true">
    {iconMap[type]}
  </div>

  <div class="flex-1 min-w-0">
    <p class="text-sm font-medium">
      {#if type === 'error'}
        File Error
      {:else if type === 'warning'}
        File Warning
      {:else}
        File Info
      {/if}
    </p>
    <p class="text-sm mt-1">
      {error}
    </p>

    {#if type === 'error'}
      <p class="text-xs mt-2 opacity-75">
        The file may have been deleted, expired, or is no longer accessible.
      </p>
    {/if}
  </div>

  {#if onDismiss}
    <button
      type="button"
      onclick={onDismiss}
      class="flex-shrink-0 p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-current"
      aria-label="Dismiss error"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  {/if}
</div>

<style>
  .file-error-banner {
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
