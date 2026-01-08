<script lang="ts">
  /**
   * DashboardCard - Base reusable card wrapper for dashboard sections
   */
  const { title, icon, children } = $props<{
    title: string;
    icon?: string;
    children: any;
  }>();
</script>

<div class="dashboard-card">
  <div class="card-header">
    {#if icon}
      <i class="card-icon pi {icon}"></i>
    {/if}
    <h2 class="card-title">{title}</h2>
  </div>
  <div class="card-content">
    {@render children()}
  </div>
</div>

<style>
  .dashboard-card {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.2s ease;
    display: flex;
    flex-direction: column;
    min-height: 300px;
  }

  .dashboard-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .card-icon {
    color: var(--primary-color);
    font-size: 1.25rem;
  }

  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
