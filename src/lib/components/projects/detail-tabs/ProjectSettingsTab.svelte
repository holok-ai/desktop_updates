<script lang="ts">
  import { PROJECT_ICON_SVGS } from '$lib/constants/project-icons';
  import type { Project } from '$lib/types/project.type';

  let { project }: { project: Project } = $props();
</script>

<div class="settings-section">
  <div class="settings-header">
    <h2 class="settings-title">Project Settings</h2>
  </div>

  <div class="settings-group">
    <h3 class="group-title">Details</h3>
    <div class="settings-grid">
      <div class="setting-item">
        <div class="setting-label">Project Title</div>
        <div class="setting-value">{project.title}</div>
      </div>

      <div class="setting-item full-width">
        <div class="setting-label">Description</div>
        <div class="setting-value">{project.description || 'No description provided'}</div>
      </div>

      <div class="setting-item">
        <div class="setting-label">Type</div>
        <div class="setting-value">
          <span class="type-badge type-{project.type}">
            {project.type === 'shared' ? 'Shared' : 'Personal'}
          </span>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">Status</div>
        <div class="setting-value">
          <span class="status-badge status-{project.active ? 'active' : 'inactive'}">
            {project.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">Created</div>
        <div class="setting-value">
          {new Date(project.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">Last Updated</div>
        <div class="setting-value">
          {new Date(project.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>
    </div>
  </div>

  {#if project.metadata}
    <div class="settings-group">
      <h3 class="group-title">Appearance</h3>
      <div class="settings-grid">
        {#if typeof project.metadata.color === 'string'}
          <div class="setting-item">
            <div class="setting-label">Color</div>
            <div class="setting-value">
              <div class="color-indicator" style="background-color: {project.metadata.color}"></div>
            </div>
          </div>
        {/if}

        {#if typeof project.metadata.icon === 'string'}
          <div class="setting-item">
            <div class="setting-label">Icon</div>
            <div class="setting-value">
              {#if PROJECT_ICON_SVGS[project.metadata.icon]}
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d={PROJECT_ICON_SVGS[project.metadata.icon]} fill="currentColor" />
                </svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d={PROJECT_ICON_SVGS['folder']} fill="currentColor" />
                </svg>
              {/if}
              <span class="icon-name">{project.metadata.icon}</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .settings-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .settings-group {
    padding: 24px;
    border-radius: 8px;
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
  }

  .group-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 20px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }

  .setting-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-item.full-width {
    grid-column: 1 / -1;
  }

  .setting-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .setting-value {
    font-size: 15px;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .setting-value .icon-name {
    font-size: 13px;
    color: var(--text-secondary);
    opacity: 0.8;
    font-family: monospace;
  }

  .setting-value svg {
    flex-shrink: 0;
  }

  .type-badge,
  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .type-badge.type-shared {
    background: var(--primary-background);
    color: var(--primary-text);
  }

  .type-badge.type-personal {
    background: var(--info-background);
    color: var(--info-text);
  }

  .status-badge.status-active {
    background: var(--success-background);
    color: var(--success-text);
  }

  .status-badge.status-inactive {
    background: var(--error-background);
    color: var(--error-text);
  }

  .color-indicator {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }
</style>


