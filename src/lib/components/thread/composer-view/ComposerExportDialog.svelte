<script lang="ts">
  /**
   * ComposerExportDialog — modal for exporting the composer document.
   *
   * Supports Markdown export (active) and DOCX (coming soon).
   */
  import { artifactFrontendService } from '$lib/services/artifact-frontend.service';

  interface Props {
    threadId: string;
    filename: string;
    onClose: () => void;
  }

  let { threadId, filename, onClose }: Props = $props();

  let withMarkup = $state(false);
  let isExporting = $state(false);
  let exportError = $state('');

  /** Derive a clean filename stem for the download */
  const filenameStem = $derived(filename.replace(/\.[^.]+$/, '') || 'document');

  async function handleExport(): Promise<void> {
    isExporting = true;
    exportError = '';

    const result = await artifactFrontendService.exportDocument(threadId, withMarkup);

    if (result.success && result.content != null) {
      // Trigger browser download
      const blob = new Blob([result.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameStem}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } else {
      exportError = result.error ?? 'Export failed';
    }

    isExporting = false;
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="export-overlay" role="presentation" onclick={handleBackdropClick}>
  <div class="export-dialog" role="dialog" aria-label="Export Document">
    <div class="dialog-header">
      <h3>Export Document</h3>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <i class="pi pi-times"></i>
      </button>
    </div>

    <div class="dialog-body">
      <div class="option-row">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={withMarkup} />
          <span>Include change markup</span>
        </label>
      </div>

      <div class="option-row">
        <span class="option-label">Format</span>
        <div class="format-options">
          <span class="format-active">Markdown (.md)</span>
          <span class="format-disabled" title="Coming soon">DOCX (.docx)</span>
        </div>
      </div>

      {#if exportError}
        <div class="export-error">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{exportError}</span>
        </div>
      {/if}
    </div>

    <div class="dialog-footer">
      <button class="btn btn-secondary" onclick={onClose}>Cancel</button>
      <button class="btn btn-primary" onclick={handleExport} disabled={isExporting}>
        {#if isExporting}
          Exporting...
        {:else}
          Export
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .export-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .export-dialog {
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 12px;
    width: 380px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary, #111);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary, #666);
    cursor: pointer;
    font-size: 0.75rem;
  }

  .close-btn:hover {
    background: var(--surface-hover, #f0f0f0);
  }

  .dialog-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-primary, #111);
    cursor: pointer;
  }

  .checkbox-label input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: var(--primary-color, #646cff);
  }

  .option-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary, #666);
  }

  .format-options {
    display: flex;
    gap: 0.5rem;
  }

  .format-active {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--primary-color, #646cff) 12%, transparent);
    color: var(--primary-color, #646cff);
    border: 1px solid color-mix(in srgb, var(--primary-color, #646cff) 25%, transparent);
    border-radius: 6px;
    font-weight: 500;
  }

  .format-disabled {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-secondary, #999);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    cursor: not-allowed;
  }

  .export-error {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    color: rgb(220, 38, 38);
    background: color-mix(in srgb, rgb(239, 68, 68) 6%, transparent);
    border: 1px solid color-mix(in srgb, rgb(239, 68, 68) 20%, transparent);
    border-radius: 6px;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--surface-border, #e0e0e0);
  }

  .btn {
    padding: 0.4rem 0.875rem;
    font-size: 0.8125rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    font-weight: 500;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    color: var(--text-primary, #111);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover, #f0f0f0);
  }

  .btn-primary {
    background: var(--primary-color, #646cff);
    border: 1px solid var(--primary-color, #646cff);
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }
</style>
