<script lang="ts">
  import { threadService } from '$lib/services/thread.service';
  import { onMount, onDestroy } from 'svelte';

  let {
    operationId,
    onComplete,
    onError,
  }: {
    operationId: string;
    onComplete?: () => void;
    onError?: (error: string) => void;
  } = $props();

  // Reactive state using Svelte 5 Runes
  let progress = $state<{
    phase: string;
    filesTotal: number;
    filesCompleted: number;
    bytesTotal: number;
    bytesTransferred: number;
    currentFile?: string;
    estimatedTimeRemaining?: number;
  } | null>(null);

  let isComplete = $state(false);
  let hasError = $state(false);
  let errorMessage = $state('');
  let isCancelling = $state(false);

  // Computed values
  const percentage = $derived(
    progress && progress.bytesTotal > 0
      ? Math.round((progress.bytesTransferred / progress.bytesTotal) * 100)
      : 0,
  );

  const phaseLabel = $derived(
    progress?.phase === 'validating'
      ? 'Validating...'
      : progress?.phase === 'migrating'
        ? 'Transferring files...'
        : progress?.phase === 'creating'
          ? 'Creating thread...'
          : progress?.phase === 'complete'
            ? 'Complete'
            : 'Processing...',
  );

  const showEstimatedTime = $derived(
    progress?.estimatedTimeRemaining !== undefined && progress.estimatedTimeRemaining > 0,
  );

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    // Start polling for progress updates
    pollInterval = setInterval(async () => {
      try {
        const currentProgress = await threadService.getCopyProgress(operationId);

        if (currentProgress) {
          progress = currentProgress;

          // Check if operation is complete
          if (currentProgress.phase === 'complete') {
            isComplete = true;
            stopPolling();
            onComplete?.();
          }
        } else {
          // Operation not found - might be complete or error
          stopPolling();
        }
      } catch (error) {
        hasError = true;
        errorMessage = error instanceof Error ? error.message : 'Failed to get progress';
        stopPolling();
        onError?.(errorMessage);
      }
    }, 500); // Poll every 500ms
  });

  onDestroy(() => {
    stopPolling();
  });

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function handleCancel() {
    if (isCancelling) return;

    isCancelling = true;

    try {
      await threadService.cancelCopy(operationId);
      stopPolling();
      onError?.('Operation cancelled by user');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to cancel operation';
      hasError = true;
      onError?.(errorMessage);
    } finally {
      isCancelling = false;
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
</script>

<div class="progress-indicator" class:complete={isComplete} class:error={hasError}>
  <div class="progress-header">
    <div class="progress-info">
      <span class="phase-label">{phaseLabel}</span>
      {#if progress?.currentFile}
        <span class="current-file">{progress.currentFile}</span>
      {/if}
    </div>

    {#if !isComplete && !hasError}
      <button
        class="cancel-button"
        onclick={handleCancel}
        disabled={isCancelling}
        aria-label="Cancel copy operation"
      >
        {isCancelling ? '...' : '✕'}
      </button>
    {/if}
  </div>

  {#if hasError}
    <div class="error-message">
      <span class="error-icon">⚠️</span>
      <span>{errorMessage}</span>
    </div>
  {:else if isComplete}
    <div class="complete-message">
      <span class="complete-icon">✓</span>
      <span>Copy completed successfully</span>
    </div>
  {:else if progress}
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: {percentage}%"></div>
    </div>

    <div class="progress-details">
      <span class="progress-percentage">{percentage}%</span>

      {#if progress.filesTotal > 0}
        <span class="file-progress">
          {progress.filesCompleted} / {progress.filesTotal} files
        </span>
      {/if}

      {#if progress.bytesTotal > 0}
        <span class="bytes-progress">
          {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.bytesTotal)}
        </span>
      {/if}

      {#if showEstimatedTime}
        <span class="time-remaining">
          ~{formatTime(progress.estimatedTimeRemaining!)} remaining
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .progress-indicator {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 12px 16px;
    margin: 8px 0;
    transition: all 0.3s ease;
  }

  .progress-indicator.complete {
    border-color: var(--success-color);
    background: var(--surface-overlay);
  }

  .progress-indicator.error {
    border-color: var(--error-color);
    background: var(--surface-overlay);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .phase-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .current-file {
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cancel-button {
    background: transparent;
    border: 1px solid var(--surface-border);
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 14px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .cancel-button:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--error-color);
    color: var(--error-color);
  }

  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .progress-bar-container {
    width: 100%;
    height: 6px;
    background: var(--surface-base);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-bar {
    height: 100%;
    background: var(--primary-color);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-details {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .progress-percentage {
    font-weight: 600;
    color: var(--text-primary);
  }

  .error-message,
  .complete-message {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .error-message {
    color: var(--error-color);
  }

  .complete-message {
    color: var(--success-color);
  }

  .error-icon,
  .complete-icon {
    font-size: 16px;
  }

  .time-remaining {
    color: var(--primary-color);
    font-weight: 500;
  }
</style>
