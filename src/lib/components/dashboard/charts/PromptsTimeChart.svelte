<script lang="ts">
  /**
   * PromptsTimeChart - Line chart showing prompts by time of day (8AM-6PM)
   */
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';

  Chart.register(...registerables);

  interface ChatAuditData {
    requestTimestamp: number;
    [key: string]: unknown;
  }

  const { auditData } = $props<{
    auditData: ChatAuditData[];
  }>();

  let canvasRef: HTMLCanvasElement;
  let chartInstance: Chart | null = null;

  function transformData(data: ChatAuditData[]) {
    const hourCounts = new Array(11).fill(0); // 8AM-6PM = 11 hours
    const hourLabels = [
      '8AM',
      '9AM',
      '10AM',
      '11AM',
      '12PM',
      '1PM',
      '2PM',
      '3PM',
      '4PM',
      '5PM',
      '6PM',
    ];

    if (!data || data.length === 0) {
      return {
        labels: hourLabels,
        datasets: [
          {
            label: 'Prompts',
            data: hourCounts,
            borderColor: 'rgba(34, 197, 94, 1)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      };
    }

    // Count prompts by hour (8AM-6PM only)
    data.forEach((log) => {
      const date = new Date(log.requestTimestamp);
      const hour = date.getHours();
      if (hour >= 8 && hour <= 18) {
        hourCounts[hour - 8]++;
      }
    });

    return {
      labels: hourLabels,
      datasets: [
        {
          label: 'Prompts',
          data: hourCounts,
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
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
          legend: { display: false },
          title: { display: false },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
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
  <h3 class="chart-title">Prompts by Time of Day (8AM-6PM)</h3>
  {#if hasData}
    <div class="chart-container">
      <canvas bind:this={canvasRef}></canvas>
    </div>
  {:else}
    <div class="empty-chart">
      <i class="pi pi-chart-line"></i>
      <p>No time data available</p>
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
