<script lang="ts">
  /**
   * InvitationsCard - Displays mock project invitations
   * This is mock UI until the backend invitation API is implemented
   */
  import DashboardCard from './DashboardCard.svelte';
  import { toastStore } from '$lib/services/toast.service';
  import type { MockInvitation } from '$lib/types/dashboard.type';

  let { mockInvitations } = $props<{
    mockInvitations: MockInvitation[];
  }>();

  function formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  }

  function handleAccept(invitationId: string) {
    toastStore.show('Project invitations will be available in a future update', {
      variant: 'info',
    });

    // Remove from mock list for demo purposes
    mockInvitations = mockInvitations.filter((inv: { id: string }) => inv.id !== invitationId);
  }

  function handleDecline(invitationId: string) {
    toastStore.show('Invitation declined', { variant: 'success' });
    mockInvitations = mockInvitations.filter((inv: { id: string }) => inv.id !== invitationId);
  }

  const hasInvitations = $derived((mockInvitations?.length || 0) > 0);
</script>

<DashboardCard title="Project Invitations" icon="pi-envelope">
  {#snippet children()}
    {#if hasInvitations}
      <div class="invitations-list">
        {#each mockInvitations as invitation}
          <div class="invitation-item">
            <div class="invitation-header">
              <span class="badge badge-pending">Pending</span>
              <span class="invitation-date">{formatRelativeTime(invitation.invitedAt)}</span>
            </div>
            <div class="invitation-body">
              <h4 class="project-name">{invitation.projectName}</h4>
              <p class="invited-by">
                <i class="pi pi-user"></i>
                {invitation.invitedBy.name} ({invitation.invitedBy.email})
              </p>
              {#if invitation.message}
                <p class="invitation-message">{invitation.message}</p>
              {/if}
            </div>
            <div class="invitation-actions">
              <button class="btn-accept" onclick={() => handleAccept(invitation.id)}>
                <i class="pi pi-check"></i>
                Accept
              </button>
              <button class="btn-decline" onclick={() => handleDecline(invitation.id)}>
                <i class="pi pi-times"></i>
                Decline
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <i class="pi pi-inbox empty-icon"></i>
        <p class="empty-text">No pending invitations</p>
        <p class="empty-hint">You'll be notified when someone invites you to a project</p>
      </div>
    {/if}
  {/snippet}
</DashboardCard>

<style>
  .invitations-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .invitation-item {
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 1rem;
    background: var(--surface-overlay);
    transition: all 0.2s ease;
  }

  .invitation-item:hover {
    border-color: var(--primary-color);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .invitation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .badge-pending {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.35);
    color: #f59e0b;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .invitation-date {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .invitation-body {
    margin-bottom: 0.75rem;
  }

  .project-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .invited-by {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
  }

  .invited-by i {
    font-size: 0.75rem;
  }

  .invitation-message {
    font-size: 0.875rem;
    color: var(--text-primary);
    font-style: italic;
    margin: 0;
    padding: 0.5rem;
    background: var(--surface-card);
    border-left: 3px solid var(--primary-color);
    border-radius: 4px;
  }

  .invitation-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-accept,
  .btn-decline {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-accept {
    background: #10b981;
    border-color: #10b981;
    color: white;
  }

  .btn-accept:hover {
    background: #059669;
    border-color: #059669;
  }

  .btn-decline {
    background: transparent;
    border-color: var(--surface-border);
    color: var(--text-primary);
  }

  .btn-decline:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.05));
    border-color: var(--text-secondary);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    flex: 1;
  }

  .empty-icon {
    font-size: 3rem;
    color: var(--text-secondary);
    opacity: 0.4;
    margin-bottom: 1rem;
  }

  .empty-text {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .empty-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
    max-width: 300px;
  }
</style>
