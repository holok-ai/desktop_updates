<script lang="ts"></script>

<div class="placeholder-future">
  <div class="placeholder-icon">
    <i class="pi pi-folder"></i>
  </div>
  <h3 class="placeholder-title">File Management</h3>
  <p class="placeholder-description">
    File management for project collaboration will be available in a future update.
  </p>
  <div class="placeholder-features">
    <h4>Coming Soon:</h4>
    <ul>
      <li>
        <i class="pi pi-check"></i>
        <span>Upload and share files with team members</span>
      </li>
      <li>
        <i class="pi pi-check"></i>
        <span>Version control and file history</span>
      </li>
      <li>
        <i class="pi pi-check"></i>
        <span>File preview and inline comments</span>
      </li>
      <li>
        <i class="pi pi-check"></i>
        <span>Integration with Storage Service (S3/Azure)</span>
      </li>
    </ul>
  </div>
  <div class="placeholder-note">
    <i class="pi pi-info-circle"></i>
    <span>This feature is planned for Phase 3 (Epic 9: File Attachments)</span>
  </div>
</div>

<style>
  .placeholder-future {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 600px;
    margin: 0 auto;
    padding: 60px 40px;
    text-align: center;
  }

  .placeholder-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--background-secondary);
    border: 2px solid var(--border-color);
    margin-bottom: 24px;
  }

  .placeholder-icon i {
    font-size: 40px;
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .placeholder-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 12px 0;
  }

  .placeholder-description {
    font-size: 15px;
    color: var(--text-secondary);
    margin: 0 0 32px 0;
    line-height: 1.6;
  }

  .placeholder-features {
    width: 100%;
    text-align: left;
    padding: 24px;
    border-radius: 8px;
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
  }

  .placeholder-features h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px 0;
    text-align: center;
  }

  .placeholder-features ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .placeholder-features li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .placeholder-features li i {
    font-size: 16px;
    color: var(--success-text);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .placeholder-note {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
    padding: 12px 16px;
    border-radius: 6px;
    background: var(--info-background);
    border: 1px solid var(--info-border);
    color: var(--info-text);
    font-size: 13px;
  }

  .placeholder-note i {
    font-size: 16px;
    flex-shrink: 0;
  }
</style>


