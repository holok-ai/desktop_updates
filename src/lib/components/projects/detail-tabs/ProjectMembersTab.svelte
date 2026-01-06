<script lang="ts">
  import type { Project } from '$lib/types/project.type';

  let { project }: { project: Project } = $props();
</script>

{#if !project?.members || project.members.length === 0}
  <div class="empty-state">
    <i class="pi pi-users"></i>
    <h3>You're the only member</h3>
    <p>Invite team members to collaborate on this project</p>
  </div>
{:else}
  <div class="members-section">
    <div class="members-header">
      <h2 class="members-title">Members ({project.members.length})</h2>
    </div>

    <div class="members-list">
      {#each project.members as member (member.id)}
        <div class="member-card">
          <div class="member-avatar">
            <i class="pi pi-user"></i>
          </div>
          <div class="member-info">
            <div class="member-name">{member.userName}</div>
            <div class="member-email">{member.email}</div>
          </div>
          <div class="member-role">
            <span class="role-badge role-{member.memberRole.toLowerCase()}">{member.memberRole}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="pending-invitations">
      <h3 class="section-title">Pending Invitations</h3>
      <div class="empty-invitations">
        <i class="pi pi-envelope"></i>
        <p>No pending invitations</p>
      </div>
    </div>

    <div class="info-banner">
      <i class="pi pi-info-circle"></i>
      <span>To invite members or manage roles, use the Settings tab or project actions menu.</span>
    </div>
  </div>
{/if}

<style>
  .members-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .members-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .members-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .member-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--background-secondary);
    transition: all 0.2s;
  }

  .member-card:hover {
    border-color: var(--border-color-hover);
    background: var(--background-hover);
  }

  .member-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--primary-color);
    color: var(--text-on-primary);
    font-size: 20px;
    flex-shrink: 0;
  }

  .member-info {
    flex: 1;
    min-width: 0;
  }

  .member-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-email {
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-role {
    flex-shrink: 0;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .role-badge.role-owner {
    background: var(--error-background);
    color: var(--error-text);
  }

  .role-badge.role-editor {
    background: var(--warning-background);
    color: var(--warning-text);
  }

  .role-badge.role-viewer {
    background: var(--info-background);
    color: var(--info-text);
  }

  .pending-invitations {
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px 0;
  }

  .empty-invitations {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px;
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-invitations i {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.3;
  }

  .empty-invitations p {
    font-size: 14px;
    margin: 0;
  }

  .info-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--info-background);
    border: 1px solid var(--info-border);
    color: var(--info-text);
    font-size: 14px;
    line-height: 1.5;
  }

  .info-banner i {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: var(--text-secondary);
    text-align: center;
    padding: 40px;
  }

  .empty-state i {
    font-size: 24px;
    opacity: 0.3;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 14px;
    margin: 0 0 24px 0;
    max-width: 4000px;
  }
</style>


