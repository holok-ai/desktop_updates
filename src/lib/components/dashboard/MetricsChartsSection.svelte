<script lang="ts">
  /**
   * MetricsChartsSection - Container for all metrics charts
   */
  import DashboardCard from './DashboardCard.svelte';
  import PromptsModelChart from './charts/PromptsModelChart.svelte';
  import PromptsTimeChart from './charts/PromptsTimeChart.svelte';
  import TokenUsageChart from './charts/TokenUsageChart.svelte';

  interface ChatAuditData {
    requestTimestamp: number;
    provider: string;
    model: string;
    totalTokenCount?: number;
    [key: string]: unknown;
  }

  const { auditData } = $props<{
    auditData: ChatAuditData[];
  }>();
</script>

<DashboardCard title="Usage Metrics" icon="pi-chart-line">
  {#snippet children()}
    <div class="metrics-charts-grid">
      <div class="chart-card">
        <PromptsModelChart {auditData} />
      </div>

      <div class="chart-card">
        <PromptsTimeChart {auditData} />
      </div>

      <div class="chart-card">
        <TokenUsageChart {auditData} />
      </div>
    </div>
  {/snippet}
</DashboardCard>

<style>
  .metrics-charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .chart-card {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 1.5rem;
    min-height: 300px;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 768px) {
    .metrics-charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
