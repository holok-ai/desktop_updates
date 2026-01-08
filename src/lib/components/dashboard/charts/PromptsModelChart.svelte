<script lang="ts">
  /**
   * PromptsModelChart - Horizontal bar chart showing prompt count by model
   */
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';

  Chart.register(...registerables);

  interface ChatAuditData {
    provider: string;
    model: string;
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
            label: 'Prompts',
            data: [],
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
          },
        ],
      };
    }

    // Count prompts by model
    const modelCounts: Record<string, number> = {};

    data.forEach((log) => {
      const key = `${log.provider}/${log.model}`;
      modelCounts[key] = (modelCounts[key] || 0) + 1;
    });

    // Sort by count and take top 10
    const sortedEntries = Object.entries(modelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    return {
      labels: sortedEntries.map(([model]) => model),
      datasets: [
        {
          label: 'Prompts',
          data: sortedEntries.map(([, count]) => count),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
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
      type: 'bar',
      data: chartData,
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: false },
        },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 } },
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
    // Recreate chart when data changes
    if (auditData) {
      createChart();
    }
  });

  const hasData = $derived(auditData && auditData.length > 0);
</script>

<div class="chart-wrapper">
  <h3 class="chart-title">Prompts by Model</h3>
  {#if hasData}
    <div class="chart-container">
      <canvas bind:this={canvasRef}></canvas>
    </div>
  {:else}
    <div class="empty-chart">
      <i class="pi pi-chart-bar"></i>
      <p>No prompt data available</p>
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
