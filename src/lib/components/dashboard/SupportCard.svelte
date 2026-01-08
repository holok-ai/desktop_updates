<script lang="ts">
  /**
   * SupportCard - Displays support contact information
   */
  import DashboardCard from './DashboardCard.svelte';

  const SUPPORT_CONTACTS = {
    email: 'support@holokai.com',
    discord: 'discord.gg/holokai',
    phone: '+1-555-0100',
  };
</script>

<DashboardCard title="Support Center" icon="pi-question-circle">
  {#snippet children()}
    <div class="support-list">
      <a href="mailto:{SUPPORT_CONTACTS.email}" class="support-item">
        <div class="support-icon-wrapper email">
          <i class="pi pi-envelope support-icon"></i>
        </div>
        <div class="support-info">
          <span class="support-label">Email Support</span>
          <span class="support-value">{SUPPORT_CONTACTS.email}</span>
        </div>
        <i class="pi pi-external-link external-icon"></i>
      </a>

      <a
        href="https://{SUPPORT_CONTACTS.discord}"
        target="_blank"
        rel="noopener noreferrer"
        class="support-item"
      >
        <div class="support-icon-wrapper discord">
          <i class="pi pi-discord support-icon"></i>
        </div>
        <div class="support-info">
          <span class="support-label">Discord Community</span>
          <span class="support-value">{SUPPORT_CONTACTS.discord}</span>
        </div>
        <i class="pi pi-external-link external-icon"></i>
      </a>

      <a href="tel:{SUPPORT_CONTACTS.phone}" class="support-item">
        <div class="support-icon-wrapper phone">
          <i class="pi pi-phone support-icon"></i>
        </div>
        <div class="support-info">
          <span class="support-label">Phone Support</span>
          <span class="support-value">{SUPPORT_CONTACTS.phone}</span>
        </div>
        <i class="pi pi-external-link external-icon"></i>
      </a>
    </div>

    <div class="support-note">
      <i class="pi pi-info-circle"></i>
      <span>Support available Monday-Friday, 9AM-5PM EST</span>
    </div>
  {/snippet}
</DashboardCard>

<style>
  .support-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .support-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .support-item:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.05));
    border-color: var(--primary-color);
    transform: translateX(2px);
  }

  .support-icon-wrapper {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .support-icon-wrapper.email {
    background: rgba(59, 130, 246, 0.1);
  }

  .support-icon-wrapper.discord {
    background: rgba(88, 101, 242, 0.1);
  }

  .support-icon-wrapper.phone {
    background: rgba(16, 185, 129, 0.1);
  }

  .support-icon {
    font-size: 1.25rem;
  }

  .support-icon-wrapper.email .support-icon {
    color: #3b82f6;
  }

  .support-icon-wrapper.discord .support-icon {
    color: #5865f2;
  }

  .support-icon-wrapper.phone .support-icon {
    color: #10b981;
  }

  .support-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .support-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .support-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .external-icon {
    font-size: 0.875rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .support-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: auto;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .support-note i {
    color: var(--primary-color);
    flex-shrink: 0;
  }
</style>
