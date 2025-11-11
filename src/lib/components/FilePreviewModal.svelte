<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    fileUrl: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    isOpen: boolean;
    onClose: () => void;
    onDownload?: () => void;
  }

  let {
    fileUrl,
    filename,
    mimeType,
    fileSize,
    isOpen = false,
    onClose,
    onDownload,
  }: Props = $props();

  // Determine if file is an image or PDF
  const isImage = $derived(mimeType.startsWith('image/'));
  const isPDF = $derived(mimeType === 'application/pdf');

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Handle keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  // Focus trap management
  let modalElement = $state<HTMLDivElement | undefined>(undefined);
  let previousActiveElement: Element | null = null;

  onMount(() => {
    if (isOpen) {
      previousActiveElement = document.activeElement;
      // Focus the close button after mount
      const closeButton = modalElement?.querySelector(
        '[data-close-button]',
      ) as HTMLButtonElement | null;
      closeButton?.focus();
    }

    return () => {
      // Restore focus when modal closes
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  });

  // Watch for open state changes
  $effect(() => {
    if (isOpen && modalElement) {
      const closeButton = modalElement.querySelector(
        '[data-close-button]',
      ) as HTMLButtonElement | null;
      closeButton?.focus();
    }
  });
</script>

{#if isOpen}
  <!-- Modal Backdrop -->
  <div
    class="modal-backdrop fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
    onclick={(e) => {
      // Close on backdrop click
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={`Preview of ${filename}`}
    tabindex="-1"
    bind:this={modalElement}
  >
    <!-- Modal Container -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-container bg-white rounded-lg shadow-2xl max-w-6xl max-h-[90vh] w-full flex flex-col"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        // Allow interaction with content
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
      role="document"
    >
      <!-- Header -->
      <div class="modal-header flex items-center justify-between p-4 border-b border-gray-200">
        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-semibold text-gray-900 truncate" title={filename}>
            {filename}
          </h2>
          <p class="text-sm text-gray-500">
            {formatFileSize(fileSize)} • {mimeType}
          </p>
        </div>

        <div class="flex items-center gap-2 ml-4">
          {#if onDownload}
            <button
              type="button"
              onclick={onDownload}
              class="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Download file"
              title="Download"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          {/if}

          <button
            type="button"
            onclick={onClose}
            data-close-button
            class="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Close preview (Escape)"
            title="Close (Esc)"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="modal-content flex-1 overflow-auto p-4 bg-gray-50">
        {#if isImage}
          <!-- Image Preview -->
          <div class="flex items-center justify-center h-full">
            <img
              src={fileUrl}
              alt={filename}
              class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>
        {:else if isPDF}
          <!-- PDF Preview -->
          <div class="h-full">
            <iframe
              src={fileUrl}
              title={`PDF preview of ${filename}`}
              class="w-full h-full border-0 rounded-lg shadow-lg"
              sandbox="allow-same-origin"
            ></iframe>
          </div>
        {:else}
          <!-- Unsupported file type -->
          <div class="flex items-center justify-center h-full text-center">
            <div class="max-w-md">
              <div class="text-6xl mb-4">📄</div>
              <h3 class="text-xl font-semibold text-gray-900 mb-2">Preview not available</h3>
              <p class="text-gray-600 mb-4">
                This file type cannot be previewed. Please download the file to view it.
              </p>
              {#if onDownload}
                <button
                  type="button"
                  onclick={onDownload}
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Download File
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer (optional, for additional actions) -->
      <div class="modal-footer p-4 border-t border-gray-200 bg-gray-50">
        <div class="flex justify-between items-center text-sm text-gray-500">
          <span>Use arrow keys to navigate, Esc to close</span>
          <span class="text-xs">
            {#if isImage}
              Image preview
            {:else if isPDF}
              PDF preview
            {:else}
              No preview available
            {/if}
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    animation: fadeIn 0.2s ease-in-out;
  }

  .modal-container {
    animation: slideUp 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* Ensure modal content doesn't overflow */
  .modal-content {
    max-height: calc(90vh - 12rem);
  }
</style>
