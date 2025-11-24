<script lang="ts">
  import type { ResponseComment } from '../../../src-shared/types/attachment.types';

  interface Props {
    comment: ResponseComment;
    onedit?: () => void;
    ondelete?: () => void;
  }

  let { comment, onedit, ondelete }: Props = $props();

  const createdDate = $derived(new Date(comment.createdAt).toLocaleString());
  const editedDate = $derived(
    comment.editedAt && comment.editedAt !== comment.createdAt
      ? new Date(comment.editedAt).toLocaleString()
      : null,
  );

  const tooltipText = $derived(
    `Comment: ${comment.content}${editedDate ? `\nEdited: ${editedDate}` : `\nCreated: ${createdDate}`}`,
  );

  function handleClick(e: MouseEvent) {
    // Don't trigger edit if clicking delete button
    if ((e.target as HTMLElement).closest('.delete-btn')) {
      return;
    }
    if (onedit) {
      onedit();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onedit) {
        onedit();
      }
    }
  }
</script>

<div
  class="comment-display"
  title={tooltipText}
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-label="Click to edit comment"
>
  <div class="comment-header">
    <i class="pi pi-comment"></i>
    <span class="comment-label">Comment</span>
  </div>
  <div class="comment-content">
    {comment.content}
  </div>
  <div class="comment-footer">
    <div class="comment-meta">
      <span class="created">Created: {createdDate}</span>
      {#if editedDate}
        <span class="edited">Edited: {editedDate}</span>
      {/if}
    </div>
    <div class="comment-actions">
      {#if ondelete}
        <button
          class="action-btn delete-btn"
          onclick={(e) => {
            e.stopPropagation();
            ondelete();
          }}
          aria-label="Delete comment"
          title="Delete comment"
        >
          <i class="pi pi-trash"></i>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .comment-display {
    /* Light blue background - visible in both dark and light modes */
    background: rgba(var(--comment-blue), 0.12);
    border: 1px solid rgba(var(--comment-blue), 0.35);
    border-radius: 6px;
    padding: 0.75rem;
    margin-top: 1rem;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }

  @media (prefers-color-scheme: dark) {
    .comment-display {
      /* Slightly brighter for dark mode visibility */
      background: rgba(var(--comment-blue), 0.15);
      border-color: rgba(var(--comment-blue), 0.4);
    }
  }

  .comment-display:hover {
    background: rgba(var(--comment-blue), 0.18);
    border-color: rgba(var(--comment-blue), 0.45);
  }

  .comment-display:focus {
    outline: none;
    background: rgba(var(--comment-blue), 0.18);
    border-color: rgba(var(--comment-blue), 0.6);
    box-shadow: 0 0 0 2px rgba(var(--comment-blue), 0.2);
  }

  @media (prefers-color-scheme: dark) {
    .comment-display:hover {
      background: rgba(var(--comment-blue), 0.2);
      border-color: rgba(var(--comment-blue), 0.5);
    }

    .comment-display:focus {
      background: rgba(var(--comment-blue), 0.2);
      border-color: rgba(var(--comment-blue), 0.7);
    }
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .comment-header i {
    color: rgba(var(--comment-blue), 0.8);
    font-size: 0.875rem;
  }

  .comment-label {
    font-weight: 600;
    font-size: 0.75rem;
    color: rgba(var(--comment-blue), 0.9);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .comment-content {
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    margin-bottom: 0.75rem;
    cursor: text;
  }

  .comment-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .comment-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.7rem;
    color: var(--text-secondary, #888);
  }

  .comment-meta .edited {
    font-style: italic;
  }

  .comment-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: var(--error-color, #ef4444);
    padding: 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .action-btn:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .action-btn i {
    font-size: 0.875rem;
  }
</style>
