# Epic Technical Specification: Insights Dashboard

Date: 2025-11-26
Author: Peter
Epic ID: 6
Status: Draft

---

## Overview

Epic 6 implements a comprehensive analytics dashboard and reporting system for AI usage monitoring within Holokai Desktop. This epic delivers real-time visibility into organizational adoption metrics (active users, workflows created, executions), department-level usage analytics, and administrative governance monitoring. The implementation addresses the enterprise requirement (PRD §3.9) for IT leaders and department heads to measure ROI, track adoption rates, and justify budget investments with concrete data. The dashboard includes overview cards with key metrics, time-series activity charts, desktop-specific statistics (cache, storage), and report export capabilities (CSV, JSON).

## Objectives and Scope

**In Scope:**
- **Insights API endpoints** (E6-S1): Backend analytics endpoints in Moku API returning dashboard metrics (total threads/prompts/tokens, top models, workflow execution stats with total/success/failure counts and average execution time), activity time-series data (prompts/tokens over time with configurable granularity), topic analysis (basic keyword extraction), per-project metrics, and configurable materialized view refresh interval
- **Dashboard view** (E6-S2): Main Insights tab UI with summary cards (Total Threads, Total Prompts, Total Tokens, Top Models Used, Workflow Executions with success rate), recent activity sparkline, responsive layout, and refresh interval configuration
- **Activity charts** (E6-S3): Time-series line charts for prompts/tokens over time (separate charts, not multi-series overlay), date range selector (last 7/30/90 days, custom), granularity selector (hour/day/week/month), and aggregate totals display
- **Desktop info view** (E6-S4): Local statistics including cache stats with per-project breakdown (threads, messages, files by project), storage usage breakdown (cache, database, logs), application version info, and "Clear Cache" functionality
- **Report export** (E6-S5): Export analytics data to CSV, JSON, and PDF formats with metadata (timestamp, date range, granularity), native save dialog integration
- **Performance targets**: Dashboard loads within 2 seconds (PRD §3.9 AC), API queries complete in <500ms P95
- **User personas**: IT Leader (primary - ROI reporting), Department Head (team analytics), Security Officer (governance monitoring)

**Out of Scope:**
- Advanced ML-based topic analysis (basic keyword extraction only in MVP)
- Real-time WebSocket updates (30-second polling only)
- Scheduled report generation (on-demand export only in MVP)
- Multi-language support (English only in MVP)
- Organization-level aggregations (department-level only in MVP)
- Detailed workflow performance profiling (step-by-step timing, resource usage per step - high-level success/failure/duration only in MVP)
- Anomaly detection or predictive analytics
- Mobile dashboard views (desktop-only in MVP)
- Multi-series overlay charts (separate charts for prompts and tokens)

## System Architecture Alignment

This epic aligns with the Holokai Desktop architecture (Architecture §1-4) through the following components and constraints:

**Components Added:**
- **InsightsController (Moku API)** - REST endpoints for analytics queries (Spring Boot controller following existing Moku API patterns)
- **InsightsService (Moku API)** - Business logic for metric aggregation and time-series calculations
- **InsightsView (Desktop Renderer)** - Tabbed UI component (Dashboard, Activity, Desktop Info) built with Svelte 5
- **CacheService extensions (Desktop Main)** - Methods to query local cache statistics (thread count, message count, file size)

**Architectural Constraints:**
- **Multi-process architecture**: Analytics logic split between Moku API (server-side aggregations) and Desktop app (local cache statistics via IPC)
- **IPC communication**: Dashboard component communicates with main process via `electronAPI.insights.*` methods exposed through context bridge (Architecture §3 secure IPC pattern)
- **Local storage**: Cache statistics derived from electron-store data (Architecture §2 storage strategy: `~/.config/holokai-desktop/`)
- **Authentication**: All API calls include JWT token from existing auth service (PRD §4.4 SSO integration)
- **Data sources**: Metrics aggregated from `desktop_threads`, `desktop_messages`, `workflow_executions`, `audit_log` tables (PRD §5.2 Moku schema updates)
- **Performance**: Pre-aggregated materialized views in PostgreSQL for dashboard queries to meet <500ms target (Architecture §4.2 performance considerations)

**Data Flow:**
User opens Insights tab → InsightsView.svelte mounts → Fetches dashboard data via `electronAPI.insights.getDashboard()` → Main process IPC handler forwards to Moku API `/api/insights/dashboard` → InsightsService queries materialized view → Returns aggregated metrics → Main process caches response → Renderer displays summary cards

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **InsightsController** (Moku API) | REST endpoints for analytics queries | HTTP requests (GET /api/insights/*) | JSON responses (metrics, time-series data) | E6-S1 |
| **InsightsService** (Moku API) | Metric aggregation, time-series calculations, caching | Query parameters (date range, granularity, projectId) | Aggregated metrics (dashboard summary, activity time-series, project stats) | E6-S1 |
| **InsightsView** (Desktop Renderer) | Tabbed UI container, tab routing | User interactions (tab clicks) | Dashboard/Activity/DesktopInfo tab components | E6-S2 |
| **DashboardTab** (Desktop Renderer) | Summary cards layout and data fetching | Dashboard metrics from API | Rendered summary cards (threads, prompts, tokens, models) | E6-S2 |
| **ActivityTab** (Desktop Renderer) | Time-series charts, date range controls | Activity time-series data from API | Line charts, totals summary | E6-S3 |
| **DesktopInfoTab** (Desktop Renderer) | Local cache and storage statistics | Cache stats from main process | Cache stats cards, storage usage, version info | E6-S4 |
| **CacheService extensions** (Desktop Main) | Query local cache statistics | IPC requests from renderer | Cache counts (threads, messages, files), storage sizes | E6-S4 |
| **ExportService** (Desktop Renderer) | Export data to CSV/JSON/PDF | Chart data arrays, export format selection | Downloaded file via native save dialog | E6-S5 |

### Data Models and Contracts

**Dashboard Summary Response:**

```typescript
interface DashboardSummary {
  totalThreads: number;
  totalPrompts: number;
  totalTokens: number;
  topModels: Array<{
    modelName: string;
    count: number;
  }>;
  workflowExecutions: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;  // Percentage (0-100)
    averageExecutionTimeMs: number;
  };
  period: {
    startDate: string;  // ISO 8601
    endDate: string;    // ISO 8601
  };
}
```

**Activity Time-Series Response:**

```typescript
interface ActivityTimeSeries {
  data: Array<{
    date: string;      // ISO 8601
    prompts: number;
    tokens: number;
  }>;
  granularity: 'hour' | 'day' | 'week' | 'month';
  totals: {
    prompts: number;
    tokens: number;
    averagePromptsPerDay: number;
  };
}
```

**Project Metrics Response:**

```typescript
interface ProjectMetrics {
  projects: Array<{
    projectId: string;
    projectName: string;
    threadCount: number;
    promptCount: number;
  }>;
}
```

**Desktop Cache Stats:**

```typescript
interface CacheStats {
  threads: {
    count: number;
    sizeBytes: number;
  };
  messages: {
    count: number;
    sizeBytes: number;
  };
  files: {
    count: number;
    sizeBytes: number;
  };
  totalSizeBytes: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    threads: number;
    messages: number;
    files: number;
    sizeBytes: number;
  }>;
  personalCache: {
    threads: number;
    messages: number;
    files: number;
    sizeBytes: number;
  };
}
```

**Storage Usage:**

```typescript
interface StorageUsage {
  cache: number;       // bytes
  database: number;    // bytes
  logs: number;        // bytes
  total: number;       // bytes
  available: number;   // bytes (from OS)
}
```

**Refresh Interval Configuration:**

```typescript
interface RefreshConfig {
  interval: 'hourly' | 'daily' | 'weekly';  // Default: daily
  lastRefreshedAt: string;  // ISO 8601
  nextRefreshAt: string;    // ISO 8601
  refreshInProgress: boolean;
}
```

**Database Schema (Materialized View for Performance):**

```sql
-- Materialized view for dashboard summary (refreshed based on configurable interval)
-- Default: daily at 2 AM UTC, configurable via refresh_config table
CREATE MATERIALIZED VIEW insights_dashboard_summary AS
SELECT
  -- Thread and message metrics
  COUNT(DISTINCT dt.id) AS total_threads,
  COUNT(dm.id) AS total_prompts,
  SUM(dm.token_count) AS total_tokens,
  dm.model_name,
  COUNT(dm.id) AS model_count,

  -- Workflow execution metrics
  COUNT(we.id) AS workflow_executions_total,
  COUNT(CASE WHEN we.status = 'completed' THEN 1 END) AS workflow_executions_successful,
  COUNT(CASE WHEN we.status = 'failed' THEN 1 END) AS workflow_executions_failed,
  ROUND(
    (COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::DECIMAL / NULLIF(COUNT(we.id), 0)) * 100,
    2
  ) AS workflow_success_rate,
  AVG(we.duration_ms) AS workflow_avg_execution_time_ms,

  DATE_TRUNC('day', dm.created_at) AS date
FROM desktop_threads dt
JOIN desktop_messages dm ON dt.id = dm.thread_id
LEFT JOIN workflow_executions we ON we.created_at >= CURRENT_DATE - INTERVAL '90 days'
WHERE dm.role = 'user'
  AND dm.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY dm.model_name, DATE_TRUNC('day', dm.created_at);

CREATE INDEX idx_dashboard_summary_date ON insights_dashboard_summary(date);
CREATE INDEX idx_dashboard_summary_model ON insights_dashboard_summary(model_name);

-- Refresh interval configuration table
CREATE TABLE refresh_config (
  id SERIAL PRIMARY KEY,
  interval VARCHAR(20) NOT NULL CHECK (interval IN ('hourly', 'daily', 'weekly')),
  last_refreshed_at TIMESTAMP,
  next_refresh_at TIMESTAMP,
  refresh_in_progress BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO refresh_config (interval, next_refresh_at)
VALUES ('daily', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '2 hours');

-- Refresh schedule: Configurable (default daily at 2 AM UTC)
```

### APIs and Interfaces

**Moku API Endpoints:**

```
GET /api/insights/dashboard
  - Query Params: period=30 (days, default: 30)
  - Response: DashboardSummary
  - Aggregates metrics from materialized view
  - Returns totals and top 5 models

GET /api/insights/activity
  - Query Params: startDate (ISO 8601), endDate (ISO 8601), granularity ('hour'|'day'|'week'|'month')
  - Response: ActivityTimeSeries
  - Uses date_trunc for aggregation grouping
  - Limits result set to 1,000 data points maximum

GET /api/insights/topics
  - Query Params: limit=10 (default: 10)
  - Response: { topics: Array<{ topic: string; count: number }> }
  - Basic keyword extraction (placeholder for ML - extracts from thread titles)
  - Returns top N topics by frequency

GET /api/insights/projects
  - Query Params: startDate, endDate
  - Response: ProjectMetrics
  - Filters by user's accessible projects (RBAC check)
  - Returns per-project thread/prompt counts
```

**Desktop IPC Handlers:**

```typescript
// preload.ts - Exposed to renderer via context bridge
interface InsightsAPI {
  getDashboard(period: number): Promise<DashboardSummary>;
  getActivity(startDate: string, endDate: string, granularity: string): Promise<ActivityTimeSeries>;
  getTopics(limit: number): Promise<{ topics: Array<{ topic: string; count: number }> }>;
  getProjects(startDate: string, endDate: string): Promise<ProjectMetrics>;
  getCacheStats(): Promise<CacheStats>;
  getStorageUsage(): Promise<StorageUsage>;
  clearCache(): Promise<void>;
}

// IPC channel naming convention
'insights:getDashboard'       → GET /api/insights/dashboard
'insights:getActivity'        → GET /api/insights/activity
'insights:getTopics'          → GET /api/insights/topics
'insights:getProjects'        → GET /api/insights/projects
'insights:getCacheStats'      → Local cache query (no API call)
'insights:getStorageUsage'    → Local filesystem query (no API call)
'insights:clearCache'         → Local cache clear operation
```

**Frontend Service (IPC Wrapper):**

```typescript
// src/lib/services/insights.ts (Renderer)
export const insightsService = {
  async getDashboard(period: number = 30): Promise<DashboardSummary> {
    return window.electronAPI.insights.getDashboard(period);
  },

  async getActivity(startDate: string, endDate: string, granularity: string): Promise<ActivityTimeSeries> {
    return window.electronAPI.insights.getActivity(startDate, endDate, granularity);
  },

  async getCacheStats(): Promise<CacheStats> {
    return window.electronAPI.insights.getCacheStats();
  },

  async exportToCSV(data: any[], filename: string): Promise<void> {
    const csv = convertToCSV(data);
    return window.electronAPI.saveFile(filename, csv, 'csv');
  },

  async exportToJSON(data: any[], filename: string): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    return window.electronAPI.saveFile(filename, json, 'json');
  }
};
```

### Workflows and Sequencing

**Dashboard Load Flow:**

1. User clicks "Insights" in primary sidebar
2. Router navigates to `/insights` route
3. InsightsView.svelte mounts, defaults to Dashboard tab
4. DashboardTab.svelte onMount lifecycle:
   - Sets loading state to true
   - Calls `insightsService.getDashboard(30)`
5. Renderer → Main IPC: `ipcRenderer.invoke('insights:getDashboard', 30)`
6. Main process IPC handler:
   - Checks local cache (5-minute TTL)
   - If cache miss: Calls Moku API `GET /api/insights/dashboard?period=30` with JWT token
   - Caches response
   - Returns data to renderer
7. DashboardTab receives response:
   - Sets loading state to false
   - Updates component state with metrics
8. Svelte reactivity renders summary cards:
   - Total Threads card displays `dashboardData.totalThreads`
   - Total Prompts card displays `dashboardData.totalPrompts`
   - Total Tokens card displays formatted `dashboardData.totalTokens` (e.g., "1.2M")
   - Top Models card renders horizontal bar chart from `dashboardData.topModels`
9. User sees dashboard within 2 seconds (PRD §3.9 AC)

**Activity Chart Load Flow:**

1. User clicks "Activity" tab in InsightsView
2. ActivityTab.svelte mounts with default date range (last 30 days)
3. Component calls `insightsService.getActivity(startDate, endDate, 'day')`
4. IPC request to main process: `ipcRenderer.invoke('insights:getActivity', startDate, endDate, 'day')`
5. Main process calls Moku API `GET /api/insights/activity?startDate=...&endDate=...&granularity=day`
6. InsightsService (Moku API):
   - Queries `desktop_messages` table with date_trunc('day', created_at)
   - Groups by date, aggregates prompts and tokens
   - Returns time-series array
7. ActivityTab receives data:
   - Initializes Chart.js line chart with data points
   - Renders date range selector with current range highlighted
   - Displays totals summary (total prompts, total tokens, avg prompts/day)
8. User changes date range to "Last 7 days":
   - Re-fetches data with new date range
   - Chart updates reactively
9. User changes granularity to "hour":
   - Re-fetches data with `granularity='hour'`
   - Chart updates x-axis labels and data points

**Cache Clear Flow:**

1. User opens Desktop Info tab
2. DesktopInfoTab.svelte displays cache statistics
3. User clicks "Clear Cache" button in CacheStatsCard
4. Confirmation dialog appears: "Are you sure? This will clear all cached threads, messages, and files."
5. User confirms
6. Component calls `insightsService.clearCache()`
7. IPC request: `ipcRenderer.invoke('insights:clearCache')`
8. Main process CacheService:
   - Deletes all electron-store data (threads, messages, project cache)
   - Deletes files in `~/.config/holokai-desktop/files/`
   - Returns success
9. DesktopInfoTab:
   - Shows success toast: "Cache cleared successfully"
   - Re-fetches cache stats (all zeros)
   - Updates UI

**Report Export Flow:**

1. User views Activity chart with 30 days of data
2. User clicks "Export" dropdown in chart toolbar
3. User selects format: "Export as CSV", "Export as JSON", or "Export as PDF"

**CSV Export:**
4a. ExportService:
   - Converts `activityData.data` array to CSV format
   - Adds header row: "Date,Prompts,Tokens"
   - Adds metadata rows: "Exported: 2025-11-26 14:30", "Date Range: 2025-10-27 to 2025-11-26", "Granularity: day"
5a. IPC call: `ipcRenderer.invoke('dialog:showSaveDialog', { defaultPath: 'activity-export-2025-11-26.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] })`
6a. Native save dialog opens (OS-specific)
7a. User selects save location: "~/Documents/holokai-activity.csv"
8a. Main process writes file to selected path
9a. Success toast: "Report exported to ~/Documents/holokai-activity.csv"
10a. User opens file in Excel/Google Sheets to analyze data

**PDF Export:**
4b. ExportService:
   - Captures chart as image (Chart.js `.toBase64Image()`)
   - Initializes jsPDF document (A4 portrait)
   - Adds header: "Holokai Activity Report | Exported: 2025-11-26 14:30"
   - Embeds chart image
   - Adds summary table: Total Prompts, Total Tokens, Avg Prompts/Day
   - Adds metadata footer: Date range, granularity, generated by Holokai Desktop v1.0
5b. IPC call: `ipcRenderer.invoke('dialog:showSaveDialog', { defaultPath: 'activity-export-2025-11-26.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] })`
6b. Native save dialog opens
7b. User selects save location: "~/Documents/holokai-activity.pdf"
8b. Main process writes PDF buffer to selected path
9b. Success toast: "Report exported to ~/Documents/holokai-activity.pdf"
10b. User opens PDF in viewer to present to executives

## Non-Functional Requirements

### Performance

**Response Time Targets:**
- Dashboard load (initial): <2s P95 (PRD §3.9 AC)
- Dashboard load (cached): <500ms P95
- Activity chart render: <1s for 90-day dataset (≤2,700 data points at daily granularity)
- API query execution: <500ms P95 for dashboard endpoint, <1s P95 for activity endpoint
- Cache stats query: <100ms (local filesystem operation)
- Export generation: <2s for 10,000 rows to CSV
- Chart interactions (hover, zoom): <16ms (60 FPS)

**Query Optimization:**
- Use materialized view for dashboard summary (refresh daily at 2 AM UTC)
- Index on `desktop_messages(created_at, model_name)` for activity queries
- Limit activity result set to 1,000 data points maximum (pagination if exceeded)
- Cache Moku API responses in main process for 5 minutes (TTL-based invalidation)

**UI Performance:**
- Virtual scrolling for long data tables (not in MVP scope)
- Lazy load chart library (Chart.js) only when Activity tab opened
- Debounce date range selector (500ms delay before re-fetching)
- Show loading skeletons during data fetch (perceived performance)

### Security

**Authorization:**
- All Moku API calls include JWT token from existing auth service (PRD §4.4 SSO)
- RBAC enforcement: Users can only view metrics for projects they have access to (checked in InsightsService.getProjects)
- Department heads can view team-specific metrics via project filtering (PRD §3.9 department dashboards)
- Admins can view organization-wide metrics (all projects)

**Data Privacy:**
- Activity data aggregated by day (no per-user granularity in MVP to protect individual usage privacy)
- Topic analysis extracts keywords from thread titles only (message content not exposed)
- Audit logs (PRD §3.4 governance) capture dashboard access events: "User viewed insights dashboard", "User exported activity report"

**Export Security:**
- Exported files saved to user-selected directory (native OS save dialog - no server upload)
- No sensitive data included in exports (aggregate metrics only, no message content)
- Export metadata includes timestamp and user context for audit trail

### Reliability/Availability

**Cache Resilience:**
- If Moku API unavailable, show cached dashboard data (up to 5 minutes old) with "Last updated: X minutes ago" indicator
- Graceful degradation: If materialized view not refreshed, fall back to live query (slower, but functional)
- Error handling: Network errors show user-friendly message "Unable to load dashboard. Check network connection." with retry button

**Data Integrity:**
- Materialized view refresh validated with row count check (if refresh fails, alert admin via monitoring)
- Activity time-series validated for continuous date ranges (fill gaps with zero values if data missing)
- Cache stats validated for consistency (if cache count mismatch, trigger cache repair)

**Polling vs Real-Time:**
- MVP uses 30-second polling for dashboard updates (no WebSocket - PRD §6.2 out of scope)
- Auto-refresh disabled when user inactive (tab hidden) to conserve resources
- Manual refresh button always available

### Observability

**Metrics:**
- `insights.dashboard.load_time` - P50/P95/P99 dashboard load latency
- `insights.api.query_duration` - API query execution time by endpoint
- `insights.cache.hit_rate` - Percentage of cache hits for dashboard queries
- `insights.export.success_rate` - Percentage of successful exports
- `insights.materialize_view.refresh_duration` - Time to refresh materialized view
- `insights.api.error_rate` - Percentage of failed API calls (4xx, 5xx)

**Logging:**
- **INFO:** Dashboard loaded (userId, loadTime, dataPoints)
- **INFO:** Activity chart rendered (userId, dateRange, granularity, dataPoints)
- **INFO:** Report exported (userId, format: CSV/JSON/PDF, rowCount, filePath)
- **INFO:** Cache cleared (userId, threadsDeleted, messagesDeleted, filesDeleted, bytesFreed)
- **WARN:** Materialized view refresh slow (refreshDuration > 10s)
- **WARN:** API cache stale (age > 5 minutes, API unavailable)
- **ERROR:** Dashboard load failed (userId, error: "Network timeout", endpoint)
- **ERROR:** Export failed (userId, error: "Write permission denied", filePath)

**Tracing:**
- Distributed trace for dashboard load: UI → IPC → Main → Moku API → Database → Response
- Trace activity chart: UI → IPC → Main → Moku API → date_trunc aggregation → Response
- Trace export: UI → ExportService → CSV generation → IPC → Save dialog → File write

**Alerting:**
- Alert if dashboard P95 load time > 5s (performance degradation)
- Alert if materialized view refresh fails (data staleness risk)
- Alert if cache hit rate < 50% (caching ineffective)
- Alert if export error rate > 10% (user frustration indicator)

## Dependencies and Integrations

**Internal Dependencies (BLOCKERS):**
- **E1-S1: Database Schema Migration** - MUST be complete before E6-S1 can query `desktop_threads`, `desktop_messages` tables
  - Insights API endpoints depend on thread/message schema
  - **Mitigation:** E6-S1 can implement endpoints with mocked data, swap to real queries when E1 complete
- **E1-S2: Thread API Updates** - NEEDED for thread metadata (model_name, token_count columns)
  - Activity charts require token_count field in desktop_messages
  - **Mitigation:** E6-S3 can launch without token tracking, add later when E1-S2 complete

**External Dependencies:**
- **Moku API (Backend)** - Requires Spring Boot controller/service implementation for insights endpoints
  - Version: Moku API v1.0+ required
  - Endpoints: GET /api/insights/dashboard, GET /api/insights/activity, GET /api/insights/projects
- **PostgreSQL 14+** - Database for thread/message storage and materialized views
  - Must support materialized views, date_trunc function, tsvector for topic extraction
- **Chart.js 4.x** - JavaScript charting library for activity charts
  - Frontend dependency, bundled with Vite build
- **jsPDF 2.x** - PDF generation library for report exports
  - Frontend dependency, bundled with Vite build
  - Used for generating formatted PDF reports with embedded chart images

**Integration Points:**

**1. Moku API Integration:**
- InsightsController wraps all analytics endpoints
- JWT token passed in Authorization header for RBAC enforcement (from existing auth service)
- 5-minute cache in main process reduces API load

**2. Thread/Message Integration:**
- Metrics aggregated from `desktop_threads`, `desktop_messages` tables
- Joins on `thread_id` foreign key
- Filters by `created_at` for date range queries

**3. Project Service Integration:**
- `GET /api/insights/projects` filters by user's accessible projects
- Calls existing ProjectService.getUserProjects() for RBAC check
- Returns per-project metrics for department heads (PRD §3.9)

**4. File System Integration (Desktop):**
- Cache stats query local electron-store data
- Storage usage scans `~/.config/holokai-desktop/` directory
- Clear cache deletes files via Node.js `fs` module

**5. Auth Service Integration:**
- All API calls include JWT token from existing auth service (PRD §4.4 SSO)
- User context extracted from token for RBAC filtering

## Acceptance Criteria (Authoritative)

**AC-1: Insights API Endpoints - E6-S1**
- [ ] `GET /api/insights/dashboard` returns summary metrics (total threads, prompts, tokens, top 5 models, workflow execution stats)
- [ ] Dashboard response includes `workflowExecutions` object with total, successful, failed, successRate, averageExecutionTimeMs
- [ ] Workflow execution metrics aggregated from `workflow_executions` table in materialized view
- [ ] `GET /api/insights/activity` returns time-series data with configurable granularity (hour, day, week, month)
- [ ] `GET /api/insights/topics` returns top 10 topics (basic keyword extraction from thread titles)
- [ ] `GET /api/insights/projects` returns per-project metrics filtered by user's accessible projects
- [ ] All queries complete in <500ms (P95) for 90-day dataset
- [ ] Materialized view refresh interval configurable (hourly/daily/weekly), default daily at 2 AM UTC
- [ ] Refresh interval configuration stored in refresh_config table
- [ ] API responses include period metadata (startDate, endDate) and refresh configuration

**AC-2: Dashboard View - E6-S2**
- [ ] Dashboard loads within 2 seconds (P95) as per PRD §3.9 AC
- [ ] Summary cards display: Total Threads, Total Prompts, Total Tokens (formatted with K/M suffix)
- [ ] Workflow Executions card displays total executions, success rate (percentage), average execution time
- [ ] Success rate formatted as percentage with color coding (green >90%, yellow 70-90%, red <70%)
- [ ] Top Models card shows horizontal bar chart with top 5 models by usage count
- [ ] Recent Activity card shows sparkline chart for last 7 days
- [ ] Refresh button re-fetches data and updates cards
- [ ] Refresh interval dropdown in dashboard settings (Hourly/Daily/Weekly) with current selection highlighted
- [ ] Changing refresh interval saves to backend and updates next refresh time display
- [ ] Loading skeleton shown during initial load
- [ ] Responsive layout adapts to window width (grid collapses to single column on narrow windows)

**AC-3: Activity Charts - E6-S3**
- [ ] Two separate line charts rendered vertically: Prompts over time (top), Tokens over time (bottom)
- [ ] Charts use separate Y-axis scales appropriate for data magnitude (prompts ~100s, tokens ~100,000s)
- [ ] No multi-series overlay (separate charts for clarity)
- [ ] Date range selector with presets: Last 7 days, Last 30 days, Last 90 days, Custom
- [ ] Granularity selector (Hour, Day, Week, Month) with appropriate enablement (e.g., Hour disabled for >7 day range)
- [ ] Both charts update when date range or granularity changed
- [ ] Hover shows data point tooltip with exact date, prompts (or tokens depending on chart)
- [ ] Totals summary displays total prompts, total tokens, average prompts/day for selected range
- [ ] Each chart renders in <1s for 90-day dataset at daily granularity

**AC-4: Desktop Info View - E6-S4**
- [ ] Cache stats display: cached thread count, cached message count, cached file count and size (overall totals)
- [ ] Per-project breakdown table shows: project name, threads, messages, files, size for each project
- [ ] Personal cache row shows personal (non-project) threads, messages, files, size separately
- [ ] Projects sorted by storage size descending (largest projects first)
- [ ] Storage usage display: breakdown by cache, database, logs with total and available disk space
- [ ] Application version display: app version (from package.json), Electron version, OS/platform
- [ ] "Clear Cache" button shows confirmation dialog before clearing
- [ ] Optional: "Clear Cache for Project" button in per-project row for targeted cleanup
- [ ] Cache clear operation completes and shows success toast
- [ ] Stats refresh after cache clear (all counts reset to zero or project removed from list)
- [ ] "Check for Updates" button triggers Electron auto-updater check

**AC-5: Report Export - E6-S5**
- [ ] Export dropdown in Activity chart toolbar with "Export as CSV", "Export as JSON", and "Export as PDF" options
- [ ] CSV export includes header row and data rows (Date, Prompts, Tokens)
- [ ] JSON export is valid JSON with pretty-print indentation
- [ ] PDF export includes: formatted header, embedded chart images (both prompts and tokens charts), summary table, metadata footer
- [ ] PDF chart images captured via Chart.js `.toBase64Image()` method
- [ ] PDF generated using jsPDF library (A4 portrait format)
- [ ] Export metadata included in all formats: export timestamp, date range, granularity
- [ ] Native save dialog allows user to choose save location and filename
- [ ] Default filenames include date: "activity-export-2025-11-26.csv" / ".json" / ".pdf"
- [ ] Exported CSV opens correctly in Excel/Google Sheets
- [ ] Exported PDF displays correctly in PDF viewers (Adobe Reader, Preview, Chrome)
- [ ] Success toast shows after export completes with file path

## Traceability Mapping

| AC ID | PRD Reference | Spec Section | Component/API | Test Approach |
|-------|---------------|--------------|---------------|---------------|
| AC-1 | PRD §3.9 (Admin Dashboard) | APIs §4.3, Data Models §4.2 | InsightsController, InsightsService | Unit: API endpoint responses, query logic<br>Integration: Materialized view refresh, date_trunc aggregation<br>Performance: Query latency measurement |
| AC-2 | PRD §3.9 (Adoption Metrics) | Services §4.1, Workflows §4.4 | DashboardTab, SummaryCard components | E2E: Dashboard load flow, card rendering<br>Visual: Loading skeletons, responsive layout<br>Performance: 2-second load time validation |
| AC-3 | PRD §3.9 (Charts) | Services §4.1, Data Models §4.2 | ActivityTab, LineChart components | E2E: Date range/granularity changes, chart updates<br>Integration: Chart.js integration<br>Performance: Chart render time for large datasets |
| AC-4 | Architecture §2 (Local Storage) | APIs §4.3, Workflows §4.4 | DesktopInfoTab, CacheService | Unit: Cache stats calculation, storage usage scan<br>Integration: Clear cache operation<br>E2E: Stats display, cache clear confirmation |
| AC-5 | PRD §3.9 (Reports) | Services §4.1, Workflows §4.4 | ExportService | Unit: CSV/JSON/PDF generation logic<br>Integration: Native save dialog, jsPDF library<br>E2E: Full export flow (all formats), file validation |

## Risks, Assumptions, Open Questions

**Risks:**

1. **RISK:** Materialized view refresh could fail during high database load, causing stale dashboard data
   - **Impact:** High - users see outdated metrics, ROI reports inaccurate
   - **Mitigation:** Set up database monitoring alerts for failed refreshes; implement fallback to live query (slower but accurate); schedule refreshes during low-traffic periods (2 AM UTC)

2. **RISK:** Large date ranges (e.g., 1 year) with hourly granularity could exceed 1,000 data point limit, causing truncated charts
   - **Impact:** Medium - users unable to view full historical data at fine granularity
   - **Mitigation:** Enforce smart granularity defaults (e.g., auto-switch to daily granularity if range >30 days); show warning message if data truncated; consider pagination for future releases

3. **RISK:** Topic extraction based on thread titles could produce low-quality results (generic keywords like "new chat", "thread 1")
   - **Impact:** Low - topic feature not critical in MVP, advanced ML deferred to post-MVP
   - **Mitigation:** Clearly label as "beta" feature; filter out common stop words; consider hiding topic feature if quality too low

4. **RISK:** Cache stats could become inaccurate if electron-store data corrupted or manually modified
   - **Impact:** Low - cache stats informational only, not business-critical
   - **Mitigation:** Implement cache repair logic (validate counts on app startup); add "Repair Cache" button if discrepancies detected

**Assumptions:**

1. **ASSUMPTION:** 5-minute cache TTL in main process sufficient to balance freshness vs API load
   - **Validation:** Monitor cache hit rate and user feedback; adjust TTL if users report stale data

2. **ASSUMPTION:** Department heads access team metrics via project filtering (no separate department entity in MVP)
   - **Validation:** Confirm with product team that project-based filtering meets department head persona needs (PRD §2.2)

3. **ASSUMPTION:** Basic keyword extraction from thread titles acceptable for MVP topic analysis (ML-based topic modeling deferred)
   - **Validation:** Review topic quality with beta users; document as known limitation if unsatisfactory

4. **ASSUMPTION:** Chart.js library sufficient for activity charts (no need for more advanced charting libraries like D3.js)
   - **Validation:** Prototype activity chart with Chart.js to confirm feature requirements met

**Open Questions:**

~~1. **QUESTION:** Should dashboard metrics include workflow execution stats (execution count, success/failure rate)?~~
   - **DECISION:** YES - Include workflow execution total, success count, failure count, success rate, and average execution time
   - **Decided by:** Product review (2025-11-27)
   - **Rationale:** IT leaders need workflow ROI metrics to justify automation investments; success rate critical for identifying problematic workflows
   - **Implementation:** Add `workflowExecutions` object to DashboardSummary with total/successful/failed/successRate/averageExecutionTimeMs; query `workflow_executions` table in materialized view

~~2. **QUESTION:** Should materialized view refresh be configurable (e.g., hourly for high-activity orgs vs daily for low-activity)?~~
   - **DECISION:** YES - Configurable with default interval, changeable on dashboard
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** High-activity orgs need hourly refreshes for real-time dashboards; low-activity orgs can use daily/weekly to reduce database load
   - **Implementation:** Add RefreshConfig interface; default daily at 2 AM UTC; add dropdown in dashboard settings to change interval (hourly/daily/weekly); store in refresh_config table

~~3. **QUESTION:** Should Desktop Info tab show detailed breakdown by project for local cache (e.g., "Project Alpha: 50 threads, 500 messages")?~~
   - **DECISION:** YES - Show per-project breakdown
   - **Decided by:** UX review (2025-11-27)
   - **Rationale:** Users need to understand which projects consume most local storage; enables targeted cache cleanup (e.g., clear cache for completed projects only)
   - **Implementation:** Add `byProject` array and `personalCache` object to CacheStats interface; group cache items by project_id and aggregate counts/sizes

~~4. **QUESTION:** Should export functionality support PDF format in addition to CSV/JSON?~~
   - **DECISION:** YES - Add PDF export
   - **Decided by:** Product review (2025-11-27)
   - **Rationale:** IT leaders present ROI reports to executives using PDFs (professional format for presentations); CSV/JSON for data analysis, PDF for reporting
   - **Implementation:** Use jsPDF library to generate formatted PDF with charts (chart images embedded), summary tables, metadata; add "Export as PDF" option to export dropdown

~~5. **QUESTION:** Should activity charts support multiple series (e.g., overlay prompts + tokens on same chart vs separate charts)?~~
   - **DECISION:** NO - Separate charts only (no multi-series overlay)
   - **Decided by:** UX review (2025-11-27)
   - **Rationale:** Prompts and tokens have different scales (prompts ~100s, tokens ~100,000s); overlaying causes readability issues; separate charts clearer
   - **Implementation:** Render two separate Chart.js line charts: one for prompts over time, one for tokens over time, stacked vertically

## Test Strategy Summary

**Test Levels:**

**1. Unit Tests (Target: 85% coverage)**
- **InsightsService (Moku API):**
  - Dashboard aggregation logic (total threads, prompts, tokens calculation)
  - Activity time-series grouping (date_trunc logic, granularity handling)
  - Topic extraction (keyword parsing from thread titles)
  - Project filtering (RBAC check, accessible projects only)
- **ExportService (Desktop Renderer):**
  - CSV generation (header row, data rows, special character escaping)
  - JSON generation (valid JSON, pretty-print, metadata inclusion)
  - PDF generation (formatted tables, embedded chart images, metadata header/footer using jsPDF)
- **CacheService (Desktop Main):**
  - Cache stats calculation (count threads, messages, files)
  - Storage usage calculation (directory scanning, size aggregation)
  - Cache clear operation (delete files, clear electron-store)

**2. Integration Tests**
- **Dashboard load flow:** UI → IPC → Main → Moku API → Materialized view query → Response → UI update
- **Activity chart flow:** UI → IPC → Main → Moku API → date_trunc aggregation → Chart.js rendering
- **Cache clear flow:** UI → IPC → Main → electron-store clear → File deletion → Stats refresh
- **Export flow:** UI → ExportService → CSV generation → IPC → Native save dialog → File write
- **Materialized view refresh:** Database trigger (2 AM UTC) → Refresh logic → Validation → Success/failure

**3. E2E Tests (Playwright)**
- **Happy path:** User opens Insights tab → Dashboard loads within 2s → Summary cards display correct metrics → User switches to Activity tab → Chart renders → User exports to CSV → File saved
- **Date range change:** User selects "Last 7 days" → Chart updates → Totals recalculated
- **Granularity change:** User switches from Day to Hour → Chart updates with new data points
- **Cache clear:** User opens Desktop Info → Clicks "Clear Cache" → Confirms dialog → Success toast → Stats reset to zero
- **Error handling:** Moku API unavailable → Dashboard shows cached data with "Last updated: X minutes ago" → User clicks refresh → Error message with retry button

**4. Performance Tests**
- **Dashboard load latency:** Measure P50/P95/P99 for initial load (target: <2s P95) and cached load (target: <500ms P95)
- **API query latency:** Measure query execution time for dashboard, activity, projects endpoints (target: <500ms P95)
- **Chart render time:** Measure time to render activity chart with 90-day dataset (2,700 data points) - target: <1s
- **Export performance:** Measure CSV generation time for 10,000 rows (target: <2s)
- **Materialized view refresh:** Measure refresh duration for 90 days of data (target: <60s)

**5. Security Tests**
- **RBAC enforcement:** Attempt to access `/api/insights/projects` for unauthorized project → Verify 403 Forbidden response
- **JWT token validation:** Call insights endpoints without token → Verify 401 Unauthorized response
- **Project filtering:** Department head user fetches projects → Verify only accessible projects returned (not all org projects)
- **Export security:** Exported CSV contains no message content → Verify only aggregate metrics included

**Test Frameworks & Tools:**
- **Vitest** - Unit and integration tests (Moku API services, Desktop main process)
- **Playwright** - E2E tests (full dashboard workflow)
- **Postman/Newman** - API endpoint testing (Moku insights endpoints)
- **Chart.js Test Utils** - Chart rendering validation

**Edge Cases to Test:**

1. **Empty state:** New organization with zero threads/messages → Dashboard displays "No data yet" state with helpful onboarding message
2. **Large dataset:** 1,000,000 messages in database → Materialized view refresh completes in <5 minutes → Dashboard still loads in <2s
3. **Date range edge cases:** Custom date range with startDate > endDate → Show validation error → Swap dates automatically
4. **Granularity limits:** User selects 365-day range with hourly granularity (8,760 data points) → Auto-switch to daily granularity → Show warning message
5. **Cache corruption:** electron-store data manually edited with invalid JSON → Cache stats show error → "Repair Cache" button triggers rebuild
6. **Materialized view stale:** View not refreshed for 7 days (failure scenario) → Dashboard falls back to live query → Performance degraded but functional
7. **Export filename conflicts:** User exports to existing file → Save dialog prompts to overwrite or rename
8. **Network interruption:** API call in progress, network disconnected → Show cached data → Retry button available

**Test Data Strategy:**
- **Seed data:** Generate 10,000 synthetic threads and 100,000 messages with realistic timestamps (last 90 days), varied model names (Claude, GPT-4, Ollama)
- **User personas:** Create test users with different roles (admin, department head, standard user) to validate RBAC
- **Project variations:** Create personal threads, project threads, multi-project threads to validate filtering
- **Edge data:** Create threads with special characters in titles (for topic extraction testing), very long thread histories (1,000+ messages)

**Continuous Integration:**
- All unit/integration tests run on every PR
- E2E tests run on staging before production deploy
- Performance tests run nightly, alert on >10% regression
- Security tests (RBAC, JWT validation) run on every commit

**Definition of Done for Epic 6:**
- All unit tests pass (85%+ coverage)
- All integration tests pass (Moku API + Desktop IPC)
- All E2E tests pass in Chrome/Firefox/Safari
- Performance benchmarks met (dashboard <2s, API <500ms)
- Security tests pass (RBAC, JWT validation)
- Materialized view refresh tested and monitored
- Export functionality validated (CSV/JSON open correctly)
- No P0/P1 bugs open
- Documentation updated (API docs, user guide for Insights dashboard)
