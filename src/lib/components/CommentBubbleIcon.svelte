<script lang="ts">
  import type { ResponseComment } from '../../../src-shared/types/attachment.types';

  interface Props {
    comment?: ResponseComment;
    onclick?: () => void;
  }

  let { comment, onclick }: Props = $props();

  const hasComment = $derived(comment && comment.content.trim().length > 0);
  const tooltipText = $derived(
    hasComment
      ? `Comment: ${comment!.content}${comment!.editedAt ? `\nEdited: ${new Date(comment!.editedAt).toLocaleString()}` : ''}`
      : 'Add comment',
  );
</script>

<button
  class="comment-bubble-icon"
  class:has-comment={hasComment}
  title={tooltipText}
  {onclick}
  aria-label={hasComment ? 'Edit comment' : 'Add comment'}
  type="button"
>
  <i class="pi pi-comment"></i>
</button>

<style>
  .comment-bubble-icon {
    position: relative;
    background: transparent;
    /* Blue when no comment */
    border: 1px solid rgba(var(--comment-blue), 0.4);
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    color: rgb(var(--comment-blue));
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease;
  }

  .comment-bubble-icon:hover {
    background: rgba(var(--comment-blue), 0.1);
    border-color: rgba(var(--comment-blue), 0.6);
    color: rgba(var(--comment-blue), 0.9);
  }

  .comment-bubble-icon:focus {
    outline: none;
    border-color: rgba(var(--comment-blue), 0.6);
    box-shadow: 0 0 0 3px rgba(var(--comment-blue), 0.1);
  }

  /* Green when comment exists */
  .comment-bubble-icon.has-comment {
    background: rgba(var(--comment-green), 0.15);
    border-color: rgba(var(--comment-green), 0.5);
    color: rgb(var(--comment-green));
  }

  .comment-bubble-icon.has-comment:hover {
    background: rgba(var(--comment-green), 0.2);
    border-color: rgba(var(--comment-green), 0.7);
    color: rgba(var(--comment-green), 0.9);
  }

  .comment-bubble-icon i {
    font-size: 0.875rem;
  }
</style>
