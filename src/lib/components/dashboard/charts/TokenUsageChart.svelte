<script lang="ts">
  /**
   * TokenUsageChart - Line chart showing token usage over time
   */
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';

  Chart.register(...registerables);

  interface ChatAuditData {
    requestTimestamp: number;
    totalTokenCount?: number;
    [key: string]: unknown;
  }

  const { auditData } = $props<{
    auditData: ChatAuditData[];
  }>();

  let canvasRef: HTMLCanvasElement;
  let chartInstance: Chart | null = null;

  function transformData(data: ChatAuditData[]) {
    if (!data || data.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            label: 'Total Tokens',
            data: [],
            borderColor: 'rgba(168, 85, 247, 1)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      };
    }

    // Group by day and sum tokens
    const tokensByDay: Record<string, number> = {};

    data.forEach((log) => {
      const date = new Date(log.requestTimestamp);
      const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!tokensByDay[dayKey]) {
        tokensByDay[dayKey] = 0;
      }

      tokensByDay[dayKey] += log.totalTokenCount || 0;
    });

    // Sort by date and take last 14 days
    const sortedDays = Object.keys(tokensByDay)
      .sort((a, b) => {
        const dateA = new Date(a + ', 2024').getTime();
        const dateB = new Date(b + ', 2024').getTime();
        return dateA - dateB;
      })
      .slice(-14);

    return {
      labels: sortedDays,
      datasets: [
        {
          label: 'Total Tokens',
          data: sortedDays.map((day) => tokensByDay[day]),
          borderColor: 'rgba(168, 85, 247, 1)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }

  function createChart() {
    if (!canvasRef) return;

    const chartData = transformData(auditData);

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(canvasRef, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          title: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => (value as number).toLocaleString(),
            },
          },
        },
      },
    });
  }

  onMount(() => {
    createChart();

    return () => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    };
  });

  $effect(() => {
    if (auditData) {
      createChart();
    }
  });

  const hasData = $derived(auditData && auditData.length > 0);
</script>

<div class="chart-wrapper">
  <h3 class="chart-title">Token Usage Over Time</h3>
  {#if hasData}
    <div class="chart-container">
      <canvas bind:this={canvasRef}></canvas>
    </div>
  {:else}
    <div class="empty-chart">
      <i class="pi pi-chart-line"></i>
      <p>No token usage data available</p>
    </div>
  {/if}
</div>

<style>
  .chart-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .chart-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  .chart-container {
    flex: 1;
    min-height: 250px;
  }

  .empty-chart {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .empty-chart i {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .empty-chart p {
    font-size: 0.875rem;
    margin: 0;
  }
</style>
