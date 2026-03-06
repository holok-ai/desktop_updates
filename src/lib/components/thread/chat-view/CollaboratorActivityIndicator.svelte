<script lang="ts">
  /**
   * CollaboratorActivityIndicator — Shows pulsing dots + label for
   * notification events displayed inline in the chat view.
   *
   * Used for both collaborator activity ("someone is working...") and
   * guard events ("Guard passed" / "Guard failed").
   */
  interface Props {
    userId?: string;
    message?: string;
    variant?: 'activity' | 'guard_started' | 'guard_passed' | 'guard_failed';
  }

  let { userId, message, variant = 'activity' }: Props = $props();

  // Derive a short display label from the userId (email or id)
  let displayName = $derived.by(() => {
    if (!userId) return 'A collaborator';
    // If it looks like an email, use the part before @
    if (userId.includes('@')) {
      return userId.split('@')[0] ?? 'A collaborator';
    }
    return 'A collaborator';
  });

  let label = $derived.by(() => {
    if (message) return message;
    if (variant === 'guard_started') return 'Running guards...';
    if (variant === 'guard_passed') return 'Guard passed.';
    if (variant === 'guard_failed') return 'Guard failed.';
    return `${displayName} is working...`;
  });
</script>

<div
  class="collaborator-activity"
  class:guard-started={variant === 'guard_started'}
  class:guard-passed={variant === 'guard_passed'}
  class:guard-failed={variant === 'guard_failed'}
>
  <div class="collaborator-dots">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
  <span class="collaborator-label">{label}</span>
</div>

<style>
  .collaborator-activity {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0.25rem 0;
  }

  .collaborator-dots {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }

  .collaborator-dots .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-tertiary, #999);
    opacity: 0.6;
    animation: collaborator-pulse 1.4s ease-in-out infinite;
  }

  .collaborator-dots .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .collaborator-dots .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .collaborator-dots .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  .collaborator-label {
    font-size: 0.8rem;
    color: var(--text-tertiary, #999);
    font-style: italic;
  }

  .guard-passed .dot {
    background-color: rgba(34, 197, 94, 0.8);
    animation: none;
    opacity: 0.8;
  }

  .guard-passed .collaborator-label {
    color: rgba(34, 197, 94, 0.8);
    font-style: normal;
  }

  .guard-failed .dot {
    background-color: rgba(239, 68, 68, 0.8);
    animation: none;
    opacity: 0.8;
  }

  .guard-failed .collaborator-label {
    color: rgba(239, 68, 68, 0.8);
    font-style: normal;
  }

  @keyframes collaborator-pulse {
    0%,
    60%,
    100% {
      opacity: 0.5;
      transform: scale(1);
    }
    30% {
      opacity: 1;
      transform: scale(1.15);
    }
  }
</style>
