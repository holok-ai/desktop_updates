<script lang="ts">
  /**
   * ThreadTitleEditor Component
   * Inline title editor with validation, save/cancel, and full accessibility
   */

  interface Props {
    threadId: string;
    currentTitle: string;
    onSave?: (newTitle: string) => Promise<void>;
    onCancel?: () => void;
    maxLength?: number;
    autoFocus?: boolean;
  }

  let { currentTitle, onSave, onCancel, maxLength = 200, autoFocus = true }: Props = $props();

  // State
  let editedTitle = $state('');
  let isSaving = $state(false);
  let errorMessage = $state('');
  let inputRef: HTMLInputElement | undefined = $state();

  // Sync editedTitle when currentTitle changes
  $effect(() => {
    editedTitle = currentTitle;
  });

  // Focus input on mount if autoFocus is true
  $effect(() => {
    if (autoFocus && inputRef) {
      inputRef.focus();
      // Select all text for easy replacement
      inputRef.select();
    }
  });

  // Character count for display
  const remainingChars = $derived(maxLength - editedTitle.length);
  const isOverLimit = $derived(editedTitle.length > maxLength);
  const isModified = $derived(editedTitle.trim() !== currentTitle.trim());

  /**
   * Validate title locally before attempting save
   */
  function validateTitle(title: string): string | null {
    const trimmed = title.trim();

    if (trimmed.length === 0) {
      return 'Title cannot be empty';
    }

    if (trimmed.length > maxLength) {
      return `Title cannot exceed ${maxLength} characters`;
    }

    return null;
  }

  /**
   * Handle save action
   */
  async function handleSave() {
    const validationError = validateTitle(editedTitle);
    if (validationError) {
      errorMessage = validationError;
      return;
    }

    if (!isModified) {
      // No changes, just cancel
      handleCancel();
      return;
    }

    try {
      isSaving = true;
      errorMessage = '';

      // Call parent's save handler
      if (onSave) {
        await onSave(editedTitle.trim());
      }
    } catch (error) {
      // Handle error from backend
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else {
        errorMessage = 'Failed to rename thread';
      }
      console.error('Failed to save title:', error);
    } finally {
      isSaving = false;
    }
  }

  /**
   * Handle cancel action
   */
  function handleCancel() {
    editedTitle = currentTitle;
    errorMessage = '';
    if (onCancel) {
      onCancel();
    }
  }

  /**
   * Handle keyboard events
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }

  /**
   * Handle input change
   */
  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    editedTitle = input.value;

    // Clear error when user starts typing
    if (errorMessage) {
      errorMessage = '';
    }
  }
</script>

<div
  class="thread-title-editor"
  role="group"
  aria-label="Edit thread title"
  data-testid="thread-title-editor"
>
  <div class="editor-container">
    <input
      bind:this={inputRef}
      type="text"
      value={editedTitle}
      oninput={handleInput}
      onkeydown={handleKeyDown}
      placeholder="Enter thread title..."
      maxlength={maxLength}
      disabled={isSaving}
      class="title-input"
      class:error={!!errorMessage || isOverLimit}
      aria-label="Thread title"
      aria-invalid={!!errorMessage || isOverLimit}
      aria-describedby={errorMessage ? 'title-error' : 'char-counter'}
      data-testid="title-input"
    />

    <div class="actions">
      <button
        type="button"
        onclick={handleSave}
        disabled={isSaving || isOverLimit || !isModified}
        class="btn btn-save"
        aria-label="Save title"
        data-testid="save-button"
      >
        {#if isSaving}
          <span class="spinner" aria-hidden="true"></span>
          Saving...
        {:else}
          ✓ Save
        {/if}
      </button>

      <button
        type="button"
        onclick={handleCancel}
        disabled={isSaving}
        class="btn btn-cancel"
        aria-label="Cancel editing"
        data-testid="cancel-button"
      >
        ✕ Cancel
      </button>
    </div>
  </div>

  <div class="metadata">
    {#if errorMessage}
      <div
        id="title-error"
        class="error-message"
        role="alert"
        aria-live="polite"
        data-testid="error-message"
      >
        {errorMessage}
      </div>
    {/if}

    <div
      id="char-counter"
      class="char-counter"
      class:warning={remainingChars < 20}
      class:error={isOverLimit}
      aria-live="polite"
      data-testid="char-counter"
    >
      {remainingChars} characters remaining
    </div>
  </div>

  <div class="hint" role="status" aria-live="polite">
    <kbd>Enter</kbd> to save • <kbd>Esc</kbd> to cancel
  </div>
</div>

<style>
  .thread-title-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--surface-1, #ffffff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .editor-container {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .title-input {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.25rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .title-input:focus {
    border-color: var(--primary-color, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
  }

  .title-input.error {
    border-color: var(--error-color, #ef4444);
  }

  .title-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--surface-2, #f5f5f5);
  }

  .actions {
    display: flex;
    gap: 0.25rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-save {
    background: var(--primary-color, #2563eb);
    color: white;
  }

  .btn-save:hover:not(:disabled) {
    background: var(--primary-hover, #1d4ed8);
  }

  .btn-cancel {
    background: var(--surface-2, #f5f5f5);
    color: var(--text-color, #333);
  }

  .btn-cancel:hover:not(:disabled) {
    background: var(--surface-3, #e5e5e5);
  }

  .spinner {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .metadata {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .error-message {
    flex: 1;
    color: var(--error-color, #ef4444);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .char-counter {
    font-size: 0.75rem;
    color: var(--text-muted, #6b7280);
    white-space: nowrap;
  }

  .char-counter.warning {
    color: var(--warning-color, #f59e0b);
    font-weight: 500;
  }

  .char-counter.error {
    color: var(--error-color, #ef4444);
    font-weight: 600;
  }

  .hint {
    font-size: 0.625rem;
    color: var(--text-muted, #6b7280);
    text-align: center;
  }

  .hint kbd {
    display: inline-block;
    padding: 0.125rem 0.25rem;
    font-family: monospace;
    font-size: 0.625rem;
    background: var(--surface-2, #f5f5f5);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.25rem;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .thread-title-editor {
      background: var(--surface-1-dark, #1f2937);
      border-color: var(--border-color-dark, #374151);
    }

    .title-input {
      background: var(--surface-2-dark, #111827);
      color: var(--text-color-dark, #f3f4f6);
      border-color: var(--border-color-dark, #374151);
    }

    .title-input:focus {
      border-color: var(--primary-color, #3b82f6);
    }

    .btn-cancel {
      background: var(--surface-3-dark, #374151);
      color: var(--text-color-dark, #f3f4f6);
    }

    .btn-cancel:hover:not(:disabled) {
      background: var(--surface-4-dark, #4b5563);
    }

    .hint kbd {
      background: var(--surface-3-dark, #374151);
      border-color: var(--border-color-dark, #4b5563);
      color: var(--text-color-dark, #f3f4f6);
    }
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .editor-container {
      flex-direction: column;
    }

    .actions {
      width: 100%;
      justify-content: flex-end;
    }

    .metadata {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .title-input:focus {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .btn {
      border: 1px solid currentColor;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .title-input,
    .btn,
    .spinner {
      transition: none;
      animation: none;
    }
  }
</style>
