<script lang="ts">
  interface Props {
    initialValue?: string;
    placeholder?: string;
    onsave: (value: string) => void;
    oncancel: () => void;
    ondelete?: () => void;
  }

  let {
    initialValue = '',
    placeholder = 'Enter your comment...',
    onsave,
    oncancel,
    ondelete,
  }: Props = $props();

  let commentText = $state(initialValue);
  let isFocused = $state(false);

  // Sync commentText when initialValue changes (e.g., when switching from display to edit)
  $effect(() => {
    commentText = initialValue;
  });

  // Focus textarea when it becomes available
  let textareaRef: HTMLTextAreaElement | undefined = $state();
  $effect(() => {
    if (textareaRef) {
      textareaRef.focus();
      // Move cursor to end of text
      const length = textareaRef.value.length;
      textareaRef.setSelectionRange(length, length);
    }
  });

  function handleSave() {
    const trimmed = commentText.trim();
    if (!trimmed) {
      // Empty comment - treat as delete
      if (ondelete) {
        ondelete();
      } else {
        oncancel();
      }
      return;
    }
    onsave(trimmed);
  }

  function handleCancel() {
    commentText = initialValue;
    oncancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }
</script>

<div class="comment-editor">
  <div class="comment-header">
    <i class="pi pi-comment"></i>
    <span class="comment-label">Comment</span>
  </div>
  <textarea
    bind:this={textareaRef}
    bind:value={commentText}
    class="comment-input"
    class:focused={isFocused}
    {placeholder}
    maxlength="500"
    rows="3"
    onfocus={() => (isFocused = true)}
    onblur={() => (isFocused = false)}
    onkeydown={handleKeydown}
  ></textarea>
  <div class="comment-editor-footer">
    <div class="char-count">{commentText.length}/500</div>
    <div class="editor-actions">
      {#if initialValue && ondelete}
        <button
          class="action-btn delete-btn"
          onclick={ondelete}
          aria-label="Delete comment"
          title="Delete"
        >
          <i class="pi pi-trash"></i>
        </button>
      {/if}
      <button class="action-btn cancel-btn" onclick={handleCancel} aria-label="Cancel">
        Cancel
      </button>
      <button
        class="action-btn save-btn"
        onclick={handleSave}
        disabled={!commentText.trim()}
        aria-label="Save comment"
      >
        Save
      </button>
    </div>
  </div>
</div>

<style>
  .comment-editor {
    /* Light blue background - visible in both dark and light modes */
    background: rgba(147, 197, 253, 0.12);
    border: 1px solid rgba(147, 197, 253, 0.35);
    border-radius: 6px;
    padding: 0.75rem;
    margin-top: 1rem;
  }

  @media (prefers-color-scheme: dark) {
    .comment-editor {
      /* Slightly brighter for dark mode visibility */
      background: rgba(147, 197, 253, 0.15);
      border-color: rgba(147, 197, 253, 0.4);
    }
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .comment-header i {
    color: rgba(59, 130, 246, 0.8);
    font-size: 0.875rem;
  }

  .comment-label {
    font-weight: 600;
    font-size: 0.75rem;
    color: rgba(59, 130, 246, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .comment-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.875rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 60px;
    background: var(--surface-card, rgba(255, 255, 255, 0.05));
    color: var(--text-primary);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .comment-input:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .comment-input.focused {
    border-color: rgba(59, 130, 246, 0.6);
  }

  .comment-editor-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .char-count {
    font-size: 0.7rem;
    color: var(--text-secondary, #888);
  }

  .editor-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-btn {
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .cancel-btn {
    background: transparent;
    color: var(--text-secondary);
    border-color: rgba(148, 163, 184, 0.3);
  }

  .cancel-btn:hover {
    background: rgba(148, 163, 184, 0.1);
    border-color: rgba(148, 163, 184, 0.5);
    color: var(--text-primary);
  }

  .save-btn {
    background: rgba(59, 130, 246, 0.9);
    color: white;
    border-color: rgba(59, 130, 246, 0.9);
  }

  .save-btn:hover:not(:disabled) {
    background: rgba(59, 130, 246, 1);
    border-color: rgba(59, 130, 246, 1);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .delete-btn {
    background: transparent;
    border: none;
    color: var(--error-color, #ef4444);
    padding: 0.25rem;
    border-radius: 0.25rem;
  }

  .delete-btn:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .delete-btn i {
    font-size: 0.875rem;
  }
</style>
