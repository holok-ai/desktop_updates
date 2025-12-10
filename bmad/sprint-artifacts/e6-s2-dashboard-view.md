# Story 6.2: Dashboard View

Status: ready-for-dev

## Story

As a desktop application user (IT leader, department head),
I want a dashboard with summary cards showing key metrics (threads, prompts, tokens, workflow executions, top models) that loads within 2 seconds,
so that I can quickly assess organizational AI adoption and ROI at a glance.

## Acceptance Criteria

1. Dashboard loads within 2 seconds (P95) as per PRD §3.9 AC
2. Summary cards display: Total Threads, Total Prompts, Total Tokens (formatted with K/M suffix)
3. Workflow Executions card displays total executions, success rate (percentage), average execution time
4. Success rate formatted as percentage with color coding (green >90%, yellow 70-90%, red <70%)
5. Top Models card shows horizontal bar chart with top 5 models by usage count
6. Recent Activity card shows sparkline chart for last 7 days
7. Refresh button re-fetches data and updates cards
8. Refresh interval dropdown in dashboard settings (Hourly/Daily/Weekly) with current selection highlighted
9. Changing refresh interval saves to backend and updates next refresh time display
10. Loading skeleton shown during initial load
11. Responsive layout adapts to window width (grid collapses to single column on narrow windows)

## Tasks / Subtasks

- [ ] **Task 1: Create InsightsView Container (AC: 11)**
  - [ ] Create InsightsView.svelte component with tabbed interface
  - [ ] Add tabs: Dashboard, Activity, Desktop Info
  - [ ] Implement tab routing with Svelte stores
  - [ ] Responsive layout: sidebar collapses on narrow screens

- [ ] **Task 2: Implement DashboardTab with Summary Cards (AC: 2-5)**
  - [ ] Create DashboardTab.svelte component
  - [ ] Fetch data via `insightsService.getDashboard(30)`
  - [ ] Create SummaryCard component (reusable for all metrics)
  - [ ] Total Threads card: display count
  - [ ] Total Prompts card: display count
  - [ ] Total Tokens card: format with K/M suffix (e.g., "1.2M")
  - [ ] Workflow Executions card: total, success rate (%), avg time (ms)
  - [ ] Success rate color coding: green (>90%), yellow (70-90%), red (<70%)
  - [ ] Top Models card: horizontal bar chart (Chart.js)

- [ ] **Task 3: Implement Recent Activity Sparkline (AC: 6)**
  - [ ] Fetch last 7 days activity data
  - [ ] Create sparkline component (tiny line chart)
  - [ ] Display in Recent Activity card
  - [ ] Click navigates to Activity tab

- [ ] **Task 4: Implement Refresh Functionality (AC: 7-9)**
  - [ ] Add refresh button in dashboard toolbar
  - [ ] On click: re-fetch data, update all cards
  - [ ] Show loading indicator during refresh
  - [ ] Add refresh interval dropdown (Hourly/Daily/Weekly)
  - [ ] Fetch current config from `/api/insights/refresh-config`
  - [ ] On change: PUT `/api/insights/refresh-config`, update UI
  - [ ] Display "Next refresh: {timestamp}" below dropdown

- [ ] **Task 5: Implement Loading States (AC: 10)**
  - [ ] Create loading skeleton for summary cards
  - [ ] Show skeleton during initial data fetch
  - [ ] Replace skeleton with actual cards when data loaded
  - [ ] Handle errors with retry button

- [ ] **Task 6: Performance Optimization (AC: 1)**
  - [ ] Benchmark dashboard load time (target: <2s P95)
  - [ ] Lazy load Chart.js library
  - [ ] Cache API responses in component state
  - [ ] Debounce refresh button (prevent spam clicks)

- [ ] **Task 7: Testing**
  - [ ] Unit test: Card rendering with mock data
  - [ ] E2E test: Full dashboard load flow
  - [ ] Performance test: Measure load time
  - [ ] Visual test: Responsive layout on various screen sizes

## Dev Notes

### Dashboard Layout

```
┌─────────────────────────────────────────────┐
│ Insights                        [Refresh]   │
├─────────────────────────────────────────────┤
│ [Dashboard] [Activity] [Desktop Info]       │
├─────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Threads  │ │ Prompts  │ │ Tokens   │    │
│ │  1,234   │ │  5,678   │ │  1.2M    │    │
│ └──────────┘ └──────────┘ └──────────┘    │
│ ┌──────────┐ ┌───────────────────────┐    │
│ │ Workflow │ │ Top Models            │    │
│ │ Total:42 │ │ Claude 3: ███████ 150 │    │
│ │ ✓ 95%    │ │ GPT-4:    ████ 80     │    │
│ │ ⌀ 3.2s   │ │ Ollama:   ██ 40       │    │
│ └──────────┘ └───────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Svelte Component Structure

```typescript
// InsightsView.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import DashboardTab from './DashboardTab.svelte';
  import ActivityTab from './ActivityTab.svelte';
  import DesktopInfoTab from './DesktopInfoTab.svelte';

  let activeTab = 'dashboard';
</script>

<div class="insights-view">
  <header>
    <h1>Insights</h1>
    <button on:click={handleRefresh}>Refresh</button>
  </header>

  <nav class="tabs">
    <button class:active={activeTab === 'dashboard'} on:click={() => activeTab = 'dashboard'}>
      Dashboard
    </button>
    <button class:active={activeTab === 'activity'} on:click={() => activeTab = 'activity'}>
      Activity
    </button>
    <button class:active={activeTab === 'desktop-info'} on:click={() => activeTab = 'desktop-info'}>
      Desktop Info
    </button>
  </nav>

  <main>
    {#if activeTab === 'dashboard'}
      <DashboardTab />
    {:else if activeTab === 'activity'}
      <ActivityTab />
    {:else}
      <DesktopInfoTab />
    {/if}
  </main>
</div>
```

### DashboardTab Implementation

```typescript
// DashboardTab.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { insightsService } from '$lib/services/insights';
  import SummaryCard from './SummaryCard.svelte';

  let loading = true;
  let dashboardData: DashboardSummary | null = null;

  onMount(async () => {
    await loadDashboard();
  });

  async function loadDashboard() {
    loading = true;
    try {
      dashboardData = await insightsService.getDashboard(30);
    } catch (error) {
      console.error('Failed to load dashboard', error);
    } finally {
      loading = false;
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    } else if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function getSuccessRateColor(rate: number): string {
    if (rate > 90) return 'green';
    if (rate >= 70) return 'yellow';
    return 'red';
  }
</script>

{#if loading}
  <div class="loading-skeleton">
    <!-- Skeleton cards -->
  </div>
{:else if dashboardData}
  <div class="dashboard-grid">
    <SummaryCard title="Total Threads" value={dashboardData.totalThreads} />
    <SummaryCard title="Total Prompts" value={dashboardData.totalPrompts} />
    <SummaryCard title="Total Tokens" value={formatNumber(dashboardData.totalTokens)} />

    <SummaryCard title="Workflow Executions">
      <div class="workflow-stats">
        <div>Total: {dashboardData.workflowExecutions.total}</div>
        <div class="success-rate" style="color: {getSuccessRateColor(dashboardData.workflowExecutions.successRate)}">
          ✓ {dashboardData.workflowExecutions.successRate.toFixed(1)}%
        </div>
        <div>⌀ {(dashboardData.workflowExecutions.averageExecutionTimeMs / 1000).toFixed(1)}s</div>
      </div>
    </SummaryCard>

    <SummaryCard title="Top Models">
      <TopModelsChart models={dashboardData.topModels} />
    </SummaryCard>
  </div>
{/if}
```

### Performance Targets (Tech Spec §6.1)

- **Dashboard Load**: <2s P95 (PRD requirement)
- **Dashboard Load (Cached)**: <500ms P95
- **Card Render**: <100ms per card

### Dependencies

- **Requires: E6-S1 (Insights API Endpoints)** - Backend endpoints for data
- **Framework: Svelte 5** - Component framework
- **Charts: Chart.js 4.x** - Horizontal bar charts for top models

### References

- [Tech Spec: Epic 6 Insights Dashboard](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md)
- [Tech Spec §4.1: Services (DashboardTab)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#services-and-modules)
- [Tech Spec §4.4: Workflows (Dashboard Load Flow)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#workflows-and-sequencing)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e6-s2-dashboard-view.context.xml

- docs/sprint-artifacts/e6-s2-dashboard-view.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
