<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BaseModal from './BaseModal.svelte';
  import { threadService } from '$lib/services/thread.service';
  import { projectService } from '$lib/services/project.service';
  import { projects } from '$lib/stores/project.store';
  import { toastStore } from '$lib/services/toast.service';
  import { formatCopyError } from '$lib/constants/thread-copy-errors';
  import type { Thread } from '../../../../src-electron/preload';
  import type { GUID } from '$lib/types/app.type';

  let {
    show = $bindable(false),
    thread = $bindable<Thread | null>(null),
  }: { show: boolean; thread: Thread | null } = $props();

  const dispatch = createEventDispatcher();

  let selectedProjectId = $state<GUID | null>(null);
  let isProcessing = $state(false);
  let error = $state('');
  let showLargeFileConfirmation = $state(false);
  let largeFileInfo = $state<{
    totalSize: number;
    fileCount: number;
    estimatedTransferTime?: number;
  } | null>(null);
  let showDuplicateWarning = $state(false);
  let duplicateInfo = $state<{
    previousCopyDate: number;
    previousThreadId: string;
  } | null>(null);

  const modalTitle = 'Copy Thread';
  const actionVerb = 'Copy';
  const actionVerbPast = 'Copying';

  // Filter projects by write permissions (owner or editor)
  const writableProjects = $derived(
    $projects
      .filter((p) => p.userRole === 'owner' || p.userRole === 'editor')
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  // Check if user has write permissions to any projects
  const hasWritePermissions = $derived(writableProjects.length > 0);

  const submitLabel = $derived(
    isProcessing
      ? `${actionVerbPast}...`
      : showLargeFileConfirmation
          ? 'Confirm Transfer'
          : showDuplicateWarning
            ? 'Create Another Copy'
            : `${actionVerb} Thread`,
  );

  $effect(() => {
    if (show && thread) {
      // Initialize selected project to current project or default to General History
      const current = thread.metadata?.projectId as GUID | null;
      selectedProjectId = current;
      // Load projects if not already loaded
      if ($projects.length === 0) {
        void projectService.loadProjects();
      }

      // Check for large files and duplicates
      void checkLargeFiles();
    }
  });

  async function checkLargeFiles() {
    if (!thread) return;

    try {
      const result = await threadService.checkLargeFiles(thread.id);
      if (result.needsConfirmation) {
        largeFileInfo = {
          totalSize: result.totalSize,
          fileCount: result.fileCount,
          estimatedTransferTime: result.estimatedTransferTime,
        };
      }
    } catch (err) {
      console.error('Failed to check large files:', err);
    }
  }

  async function checkDuplicate() {
    if (!thread || !selectedProjectId) return;

    try {
      const result = await threadService.checkDuplicate(thread.id, selectedProjectId);
      if (result.isDuplicate && result.previousCopyDate && result.previousThreadId) {
        duplicateInfo = {
          previousCopyDate: result.previousCopyDate,
          previousThreadId: result.previousThreadId,
        };
        showDuplicateWarning = true;
        return true;
      }
    } catch (err) {
      console.error('Failed to check duplicate:', err);
    }
    return false;
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  async function handleConfirm() {
    if (!thread) return;

    const targetProjectId = selectedProjectId;

    // Check for large files confirmation
    if (largeFileInfo && !showLargeFileConfirmation) {
      showLargeFileConfirmation = true;
      return;
    }

    // Check for duplicates
    if (!showDuplicateWarning) {
      const isDuplicate = await checkDuplicate();
      if (isDuplicate) {
        return; // Show duplicate warning
      }
    }

    isProcessing = true;
    error = '';

    try {
      // Show start notification
      toastStore.info(`Copying thread...`);

      // Copy operation
      const options = {
        allowDuplicate: showDuplicateWarning, // If we're showing warning, user confirmed
      };
      const newThread = await threadService.copyThread(thread.id, targetProjectId, options);
      show = false;

      // Get target project name for notification
      const targetProject = targetProjectId
        ? writableProjects.find((p) => p.id === targetProjectId)
        : null;
      const destinationName = targetProject ? targetProject.title : 'General History';

      console.log({
        newThread
      })

      dispatch('copied', {
        threadId: newThread.id, // Return the NEW thread ID
        projectId: targetProjectId,
        destinationName,
      });

      // Reset confirmation states
      showLargeFileConfirmation = false;
      showDuplicateWarning = false;
    } catch (err) {
      const errorMessage = formatCopyError(err);
      error = errorMessage;

      // Show error toast with specific message
      toastStore.error(errorMessage, 6000);
    } finally {
      isProcessing = false;
    }
  }

  function handleCancel() {
    const currentProjectId = thread?.metadata?.projectId as GUID | undefined;
    selectedProjectId = currentProjectId ?? null;
    error = '';
    showLargeFileConfirmation = false;
    showDuplicateWarning = false;
    largeFileInfo = null;
    duplicateInfo = null;
    show = false;
  }
</script>

{#if thread}
  <BaseModal
    bind:show
    title={modalTitle}
    {error}
    isSubmitting={isProcessing}
    {submitLabel}
    oncancel={handleCancel}
    onsubmit={handleConfirm}
  >
    {#snippet content()}
      {#if showDuplicateWarning && duplicateInfo}
        <div class="warning-box">
          <div class="warning-icon">⚠️</div>
          <h3>Duplicate Copy Detected</h3>
          <p>
            This thread was previously copied to this destination on
            <strong>{formatDate(duplicateInfo.previousCopyDate)}</strong>.
          </p>
          <p>Would you like to create another copy?</p>
        </div>
      {:else if showLargeFileConfirmation && largeFileInfo}
        <div class="warning-box">
          <div class="warning-icon">📦</div>
          <h3>Large File Transfer</h3>
          <p>
            This thread contains <strong>{largeFileInfo.fileCount}</strong> file(s) totaling
            <strong>{formatBytes(largeFileInfo.totalSize)}</strong>.
          </p>
          {#if largeFileInfo.estimatedTransferTime}
            <p>
              Estimated transfer time: <strong
                >{Math.ceil(largeFileInfo.estimatedTransferTime / 60)} minutes</strong
              >
            </p>
          {/if}
          <p>Do you want to proceed with the transfer?</p>
        </div>
      {:else}
        <p class="info-text">
          {actionVerb}
          <strong>{thread.title || 'Untitled Thread'}</strong>
          to a different location.
        </p>

        <div class="form-group">
          <label for="project-select">Destination</label>
          <select
            id="project-select"
            bind:value={selectedProjectId}
            disabled={isProcessing}
            class="project-select"
          >
            <option value="">General History (Unscoped)</option>
            {#each writableProjects as project}
              <option value={project.id}>
                {project.title}
              </option>
            {/each}
          </select>
        </div>

        {#if !hasWritePermissions}
          <div class="info-box warning">
            <p>
              You don't have write permissions to any projects. You can only copy to General
              History.
            </p>
          </div>
        {/if}

        <div class="info-box">
          <p>
            Copying will create an independent duplicate of this thread. Changes to one will not
            affect the other.
          </p>
        </div>
      {/if}
    {/snippet}
  </BaseModal>
{/if}

<style>
  /* Component-specific styles only - modal infrastructure handled by BaseModal */

  h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .info-text {
    margin-bottom: 20px;
    font-size: 14px;
    color: var(--text-primary);
  }

  .info-text strong {
    color: var(--primary-color);
  }

  .form-group {
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .project-select,
  select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    font-size: 14px;
    background: var(--surface-overlay);
    color: var(--text-primary);
    transition: border-color 0.2s;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .info-box {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .info-box.warning {
    border-color: var(--warning-color);
    background: var(--surface-overlay);
  }

  .info-box p {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .info-box.warning p {
    color: var(--warning-color);
  }

  .warning-box {
    background: var(--surface-overlay);
    border: 1px solid var(--warning-color);
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .warning-box .warning-icon {
    font-size: 32px;
    text-align: center;
    margin-bottom: 12px;
  }

  .warning-box h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .warning-box p {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--text-primary);
  }

  .warning-box p:last-child {
    margin-bottom: 0;
  }

  .warning-box strong {
    color: var(--warning-color);
  }

  .warning-icon {
    font-size: 32px;
    color: var(--warning-color);
    text-align: center;
    margin-bottom: 12px;
  }
</style>
