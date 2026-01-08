# Insights Feature Requirements

**Date:** 2025-11-25
**Status:** Requirements Definition
**Purpose:** Define dashboard, activity views, and reporting capabilities

## Executive Summary

The **Insights** feature provides users with visibility into their AI usage, activity patterns, and system status. It includes:

1. **Dashboard** - At-a-glance overview of key metrics
2. **User Activity** - Prompt history, usage trends, model usage
3. **Thread Topics** - Conversation categorization and trends
4. **Project & Workflow Activity** - Collaboration and automation metrics
5. **Desktop Information** - Local system status and resources
6. **Report Writer** - Custom reports from audit data

---

## 1. Dashboard

### 1.1 Purpose

The dashboard provides a single-page overview of the user's AI activity and system status. It serves as the landing page for the Insights section.

### 1.2 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INSIGHTS DASHBOARD                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                   │
│  │    TODAY'S ACTIVITY     │  │    THIS WEEK            │                   │
│  │                         │  │                         │                   │
│  │  Prompts: 47            │  │  Prompts: 312           │                   │
│  │  Threads: 5             │  │  Threads: 23            │                   │
│  │  Tokens: 125,430        │  │  Tokens: 892,150        │                   │
│  └─────────────────────────┘  └─────────────────────────┘                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     ACTIVITY CHART (7 days)                          │    │
│  │     ▄                                                                │    │
│  │     █  ▄     ▄                                                       │    │
│  │  ▄  █  █  ▄  █  ▄                                                    │    │
│  │  █  █  █  █  █  █  ▄                                                 │    │
│  │  Mon Tue Wed Thu Fri Sat Sun                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │  TOP MODELS       │  │  RECENT THREADS   │  │  ACTIVE PROJECTS  │       │
│  │                   │  │                   │  │                   │       │
│  │  Claude Opus  45% │  │  Code Review...   │  │  Q4 Marketing     │       │
│  │  GPT-4        30% │  │  API Design...    │  │  Backend Refactor │       │
│  │  Claude Sonnet 20%│  │  Bug Analysis...  │  │  Research Paper   │       │
│  │  Other         5% │  │                   │  │                   │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  DESKTOP STATUS                                                      │    │
│  │  Cache: 245 MB / 1 GB  |  Memory: 512 MB  |  Version: 2.1.0         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Dashboard Widgets

| Widget | Data Source | Refresh |
|--------|-------------|---------|
| Today's Activity | Moku API (audit) | On load, manual |
| This Week | Moku API (audit) | On load, manual |
| Activity Chart | Moku API (audit) | On load |
| Top Models | Moku API (audit) | On load |
| Recent Threads | Local cache + Moku | On load |
| Active Projects | Local cache + Moku | On load |
| Desktop Status | Local system | Real-time |

### 1.4 Dashboard Data Model

```typescript
interface DashboardData {
  today: ActivitySummary;
  thisWeek: ActivitySummary;
  activityChart: DailyActivity[];
  topModels: ModelUsage[];
  recentThreads: ThreadSummary[];
  activeProjects: ProjectSummary[];
  desktopStatus: DesktopStatus;
}

interface ActivitySummary {
  promptCount: number;
  threadCount: number;
  tokenCount: number;
  totalCost: number;              // USD from llm_responses
  avgLatencyMs: number;           // from llm_responses.total_processing_time
  avgTimeToFirstTokenMs: number;  // from llm_responses.time_to_first_token
  period: 'day' | 'week' | 'month';
}

interface DailyActivity {
  date: string;           // ISO date
  promptCount: number;
  tokenCount: number;
  cost: number;                   // USD from llm_responses
  avgLatencyMs: number;           // from llm_responses.total_processing_time
  avgTimeToFirstTokenMs: number;  // from llm_responses.time_to_first_token
}

interface ModelUsage {
  model: string;
  percentage: number;
  promptCount: number;
  totalCost: number;              // USD from llm_responses
  avgLatencyMs: number;           // from llm_responses.total_processing_time
}

interface ThreadSummary {
  id: string;
  title: string;
  lastActivity: number;
  messageCount: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  threadCount: number;
  memberCount: number;
  lastActivity: number;
}

interface DesktopStatus {
  cacheUsedBytes: number;
  cacheMaxBytes: number;
  memoryUsedBytes: number;
  version: string;
  lastSync: number;
}
```

---

## 2. User Activity View

### 2.1 Purpose

Detailed view of the user's prompt history, usage trends, and patterns over time.

### 2.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER ACTIVITY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Date Range: [Last 7 days ▼]  [Custom...]     [Export CSV]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USAGE SUMMARY                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Total Prompts│  │ Total Tokens │  │ Avg/Day      │  │ Active Days  │    │
│  │     312      │  │   892,150    │  │     45       │  │    7/7       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  USAGE OVER TIME                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Line chart: prompts and tokens over selected period]               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  MODEL BREAKDOWN                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Model            │ Prompts │ Tokens    │ Avg Tokens │ % of Total  │    │
│  │  ─────────────────┼─────────┼───────────┼────────────┼─────────────│    │
│  │  Claude Opus      │   140   │  450,000  │   3,214    │    45%      │    │
│  │  GPT-4            │    94   │  267,645  │   2,847    │    30%      │    │
│  │  Claude Sonnet    │    62   │  134,505  │   2,169    │    20%      │    │
│  │  Other            │    16   │   40,000  │   2,500    │     5%      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  HOURLY DISTRIBUTION                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Heatmap: activity by hour of day and day of week]                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Activity Data Model

```typescript
interface UserActivityData {
  period: DateRange;
  summary: {
    totalPrompts: number;
    totalTokens: number;
    avgPromptsPerDay: number;
    activeDays: number;
    totalDays: number;
  };
  dailyUsage: DailyActivity[];
  modelBreakdown: ModelUsage[];
  hourlyDistribution: HourlyActivity[];
}

interface DateRange {
  start: string;         // ISO date
  end: string;           // ISO date
}

interface HourlyActivity {
  dayOfWeek: number;     // 0-6
  hour: number;          // 0-23
  promptCount: number;
}
```

---

## 3. Thread Topics View

### 3.1 Purpose

Analyze conversation themes and categorization across threads.

### 3.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            THREAD TOPICS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter: [All Threads ▼]  [All Time ▼]                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TOPIC DISTRIBUTION                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Pie/Donut chart: threads by auto-detected topic]                   │    │
│  │                                                                       │    │
│  │  ● Code/Development  35%    ● Writing/Content  20%                   │    │
│  │  ● Analysis/Research 25%    ● Other            20%                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  TOPIC TRENDS                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Stacked area chart: topic distribution over time]                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  THREADS BY TOPIC                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Code/Development (45 threads)                               [View] │    │
│  │  ├── Code Review Discussion           3 days ago                    │    │
│  │  ├── API Design Patterns              5 days ago                    │    │
│  │  └── Bug Analysis                     1 week ago                    │    │
│  │                                                                       │    │
│  │  Analysis/Research (32 threads)                              [View] │    │
│  │  ├── Q4 Market Analysis               2 days ago                    │    │
│  │  └── Competitor Research              4 days ago                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Topic Detection

Topics are auto-detected from thread titles and first few messages:

```typescript
interface ThreadTopic {
  threadId: string;
  title: string;
  topic: string;           // auto-detected category
  confidence: number;      // 0-1
  keywords: string[];      // extracted keywords
  lastActivity: number;
}

// Topic categories (initial set, expandable)
type TopicCategory =
  | 'code-development'
  | 'writing-content'
  | 'analysis-research'
  | 'design-creative'
  | 'planning-strategy'
  | 'support-troubleshooting'
  | 'learning-education'
  | 'other';
```

### 3.4 Topic Detection Strategy

- Run on thread creation (after auto-title)
- Re-run periodically or on significant thread updates
- Use lightweight model call or keyword-based heuristics
- Store topic in thread metadata

---

## 4. Project & Workflow Activity View

### 4.1 Purpose

Track collaboration activity across projects and workflow execution metrics.

### 4.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROJECT & WORKFLOW ACTIVITY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Projects]  [Workflows]                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROJECT ACTIVITY (Last 30 days)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Project          │ Threads │ Prompts │ Members │ Last Activity     │    │
│  │  ─────────────────┼─────────┼─────────┼─────────┼───────────────────│    │
│  │  Q4 Marketing     │   12    │   156   │    4    │  2 hours ago      │    │
│  │  Backend Refactor │    8    │    89   │    3    │  1 day ago        │    │
│  │  Research Paper   │    5    │    45   │    2    │  3 days ago       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  PROJECT COMPARISON                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Bar chart: prompts per project]                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  MEMBER CONTRIBUTIONS                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Project: [Q4 Marketing ▼]                                           │    │
│  │                                                                       │    │
│  │  Member       │ Prompts │ Threads Created │ Files Uploaded │         │    │
│  │  ─────────────┼─────────┼─────────────────┼────────────────│         │    │
│  │  Alice        │    67   │        5        │       12       │         │    │
│  │  Bob          │    52   │        4        │        8       │         │    │
│  │  Charlie      │    37   │        3        │        5       │         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  [Projects]  [Workflows]  ← selected                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WORKFLOW EXECUTIONS (Last 30 days)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Workflow           │ Runs │ Success │ Failed │ Avg Duration        │    │
│  │  ───────────────────┼──────┼─────────┼────────┼─────────────────────│    │
│  │  Code Review        │  45  │   43    │   2    │  2m 15s             │    │
│  │  Report Generator   │  23  │   21    │   2    │  4m 30s             │    │
│  │  Data Analysis      │  12  │   12    │   0    │  1m 45s             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  EXECUTION TRENDS                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Line chart: workflow executions over time]                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  WORKFLOW DETAILS                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Workflow: [Code Review ▼]                                           │    │
│  │                                                                       │    │
│  │  Recent Executions:                                                   │    │
│  │  ─────────────────────────────────────────────────────────────────   │    │
│  │  ✓ PR #142 review    │ 2m 10s │ 2 hours ago  │ [View Log]           │    │
│  │  ✓ PR #141 review    │ 2m 22s │ 5 hours ago  │ [View Log]           │    │
│  │  ✗ PR #140 review    │ 0m 45s │ 1 day ago    │ [View Log]           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Activity Data Models

```typescript
interface ProjectActivityData {
  projects: ProjectActivity[];
  comparison: ProjectComparison[];
}

interface ProjectActivity {
  projectId: string;
  name: string;
  threadCount: number;
  promptCount: number;
  memberCount: number;
  lastActivity: number;
  memberContributions: MemberContribution[];
}

interface MemberContribution {
  userId: string;
  name: string;
  promptCount: number;
  threadsCreated: number;
  filesUploaded: number;
}

interface WorkflowActivityData {
  workflows: WorkflowActivity[];
  executionTrends: DailyWorkflowExecutions[];
}

interface WorkflowActivity {
  workflowId: string;
  name: string;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  avgDurationMs: number;
  recentExecutions: WorkflowExecution[];
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'success' | 'failed' | 'running';
  durationMs: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
}
```

---

## 5. Desktop Information View

### 5.1 Purpose

Display local system status, resource usage, and application information.

### 5.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DESKTOP INFORMATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APPLICATION                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Version:        2.1.0                                               │    │
│  │  Build:          2025.11.25-abc123                                   │    │
│  │  Electron:       39.0.0                                              │    │
│  │  Node:           20.x                                                │    │
│  │  Platform:       Windows 11 (x64)                                    │    │
│  │  Last Updated:   2025-11-20                                          │    │
│  │                                                      [Check Updates] │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  MEMORY USAGE                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Current:        512 MB                                              │    │
│  │  Peak:           780 MB                                              │    │
│  │  ████████████████████░░░░░░░░░░░░░░░░░░░░  512 MB / 2 GB limit      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  FILE CACHE                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Used:           245 MB                                              │    │
│  │  Limit:          1 GB                                                │    │
│  │  Files:          156                                                 │    │
│  │  Oldest:         12 days ago                                         │    │
│  │  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  245 MB / 1 GB            │    │
│  │                                                      [Clear Cache]  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  LOCAL STORAGE                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Thread Database:    45 MB  (312 threads, 2,456 messages)           │    │
│  │  Workflow Database:  12 MB  (45 workflows)                           │    │
│  │  Personal Files:     320 MB (89 files)                               │    │
│  │  Settings:           < 1 MB                                          │    │
│  │  ──────────────────────────────────────────────────────────────────  │    │
│  │  Total Local:        377 MB                                          │    │
│  │                                            [Open Data Folder]        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  CONNECTION STATUS                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Holo API:       ● Connected     (latency: 45ms)                    │    │
│  │  Moku API:       ● Connected     (latency: 52ms)                    │    │
│  │  Storage:        ● Connected     (latency: 38ms)                    │    │
│  │  Last Sync:      2 minutes ago                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  LOGS                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Log Level: [Info ▼]                              [Open Log File]   │    │
│  │  ──────────────────────────────────────────────────────────────────  │    │
│  │  12:45:32 INFO  Thread cache refreshed (23 threads)                 │    │
│  │  12:45:30 INFO  Prompt submitted to Holo API                        │    │
│  │  12:45:28 DEBUG Message encrypted and stored                        │    │
│  │  12:44:15 WARN  Cache eviction triggered (LRU)                      │    │
│  │  12:43:00 INFO  Project sync completed                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Desktop Data Model

```typescript
interface DesktopInfo {
  application: AppInfo;
  memory: MemoryInfo;
  fileCache: FileCacheInfo;
  localStorage: LocalStorageInfo;
  connections: ConnectionStatus[];
  logs: LogEntry[];
}

interface AppInfo {
  version: string;
  build: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
  lastUpdated: string;
}

interface MemoryInfo {
  currentBytes: number;
  peakBytes: number;
  limitBytes: number;
}

interface FileCacheInfo {
  usedBytes: number;
  limitBytes: number;
  fileCount: number;
  oldestFileAge: number;    // days
}

interface LocalStorageInfo {
  threadDbBytes: number;
  threadCount: number;
  messageCount: number;
  workflowDbBytes: number;
  workflowCount: number;
  personalFilesBytes: number;
  personalFileCount: number;
  settingsBytes: number;
  totalBytes: number;
}

interface ConnectionStatus {
  service: 'holo' | 'moku' | 'storage';
  status: 'connected' | 'disconnected' | 'error';
  latencyMs?: number;
  lastCheck: number;
}

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
```

---

## 6. Report Writer

### 6.1 Purpose

Allow users to create custom reports from audit data with filtering, grouping, and export capabilities.

### 6.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REPORT WRITER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  [New Report]  [Saved Reports ▼]                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REPORT CONFIGURATION                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Report Name: [Monthly Usage Summary                            ]   │    │
│  │                                                                       │    │
│  │  Data Source: [Audit Events ▼]                                       │    │
│  │                                                                       │    │
│  │  Date Range:  [Last 30 days ▼]  or  [2025-11-01] to [2025-11-25]    │    │
│  │                                                                       │    │
│  │  Filters:                                                             │    │
│  │  ┌─────────────────────────────────────────────────────────────┐     │    │
│  │  │  + Add Filter                                                │     │    │
│  │  │  ────────────────────────────────────────────────────────── │     │    │
│  │  │  Event Type  [equals ▼]     [prompt ▼]              [✕]    │     │    │
│  │  │  Project     [in     ▼]     [Q4 Marketing, Backend] [✕]    │     │    │
│  │  └─────────────────────────────────────────────────────────────┘     │    │
│  │                                                                       │    │
│  │  Group By:    [Model ▼]  [Day ▼]  [+ Add Grouping]                  │    │
│  │                                                                       │    │
│  │  Columns:     [✓] Date  [✓] User  [✓] Model  [✓] Tokens  [ ] Cost  │    │
│  │                                                                       │    │
│  │                              [Preview]  [Run Report]  [Save]         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  REPORT PREVIEW                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                         [Export ▼]  │    │
│  │  Monthly Usage Summary                                               │    │
│  │  Period: Nov 1 - Nov 25, 2025                                       │    │
│  │  ──────────────────────────────────────────────────────────────────  │    │
│  │                                                                       │    │
│  │  By Model:                                                            │    │
│  │  ─────────────────────────────────────────────────────────────────   │    │
│  │  Model          │ Prompts │ Tokens    │ Avg Tokens │                 │    │
│  │  ────────────────┼─────────┼───────────┼────────────│                 │    │
│  │  Claude Opus    │   245   │  789,000  │   3,220    │                 │    │
│  │  GPT-4          │   156   │  445,000  │   2,853    │                 │    │
│  │  Claude Sonnet  │    89   │  198,000  │   2,224    │                 │    │
│  │  ──────────────────────────────────────────────────────────────────  │    │
│  │  Total          │   490   │ 1,432,000 │   2,922    │                 │    │
│  │                                                                       │    │
│  │  By Day:                                                              │    │
│  │  [Table showing daily breakdown...]                                  │    │
│  │                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Report Configuration Model

```typescript
interface ReportConfig {
  id: string;
  name: string;
  dataSource: 'audit' | 'threads' | 'workflows' | 'projects';
  dateRange: DateRange | PresetRange;
  filters: ReportFilter[];
  groupBy: string[];
  columns: string[];
  sortBy?: { column: string; direction: 'asc' | 'desc' };
  createdAt: number;
  updatedAt: number;
}

type PresetRange = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth';

interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | string[] | number;
}

interface ReportResult {
  config: ReportConfig;
  generatedAt: number;
  rowCount: number;
  data: ReportRow[];
  summary?: ReportSummary;
}

interface ReportRow {
  [column: string]: string | number | null;
}

interface ReportSummary {
  totals: Record<string, number>;
  averages: Record<string, number>;
}
```

### 6.4 Available Data Sources

| Source | Available Fields |
|--------|------------------|
| **Audit Events** | timestamp, userId, eventType, model, provider, tokens, threadId, projectId, workflowId, duration |
| **Threads** | id, title, type, projectId, createdBy, createdAt, messageCount, topic |
| **Workflows** | id, name, scope, projectId, isTemplate, executionCount, lastRun, avgDuration |
| **Projects** | id, name, createdBy, memberCount, threadCount, workflowCount, storageUsed |

### 6.5 Export Formats

- **CSV** - Standard comma-separated values
- **JSON** - Structured data format
- **PDF** - Formatted report document (future)

---

## 7. API Endpoints

### 7.1 Dashboard

```
GET /api/insights/dashboard
  Returns all dashboard widgets data

Headers:
  Authorization: Bearer <jwt>

Response 200:
{
  "today": { "promptCount": 47, "threadCount": 5, "tokenCount": 125430 },
  "thisWeek": { "promptCount": 312, "threadCount": 23, "tokenCount": 892150 },
  "activityChart": [...],
  "topModels": [...],
  "recentThreads": [...],
  "activeProjects": [...]
}
```

### 7.2 User Activity

```
GET /api/insights/activity
  Query params:
    start: ISO date (required)
    end: ISO date (required)

Response 200:
{
  "summary": { ... },
  "dailyUsage": [...],
  "modelBreakdown": [...],
  "hourlyDistribution": [...]
}
```

### 7.3 Thread Topics

```
GET /api/insights/topics
  Query params:
    projectId: UUID (optional, filter by project)
    start: ISO date (optional)
    end: ISO date (optional)

Response 200:
{
  "distribution": [...],
  "trends": [...],
  "threadsByTopic": [...]
}
```

### 7.4 Project Activity

```
GET /api/insights/projects
  Query params:
    start: ISO date (optional)
    end: ISO date (optional)

Response 200:
{
  "projects": [...],
  "comparison": [...]
}

GET /api/insights/projects/{projectId}/contributions
  Returns member contribution breakdown
```

### 7.5 Workflow Activity

```
GET /api/insights/workflows
  Query params:
    projectId: UUID (optional)
    start: ISO date (optional)
    end: ISO date (optional)

Response 200:
{
  "workflows": [...],
  "executionTrends": [...]
}
```

### 7.6 Reports

```
POST /api/insights/reports/run
  Run a report with given configuration
  Body: ReportConfig

GET /api/insights/reports
  List saved report configurations

POST /api/insights/reports
  Save report configuration

DELETE /api/insights/reports/{reportId}
  Delete saved report
```

---

## 8. Desktop Architecture

### 8.1 Insights Service

```typescript
class InsightsService {
  // Dashboard
  async getDashboard(): Promise<DashboardData>;

  // Activity
  async getUserActivity(range: DateRange): Promise<UserActivityData>;

  // Topics
  async getThreadTopics(filter?: TopicFilter): Promise<ThreadTopicsData>;

  // Project & Workflow
  async getProjectActivity(range?: DateRange): Promise<ProjectActivityData>;
  async getWorkflowActivity(filter?: WorkflowFilter): Promise<WorkflowActivityData>;

  // Desktop Info (local)
  getDesktopInfo(): DesktopInfo;
  getMemoryUsage(): MemoryInfo;
  getFileCacheInfo(): FileCacheInfo;
  getLocalStorageInfo(): LocalStorageInfo;
  getConnectionStatus(): ConnectionStatus[];
  getLogs(level?: LogLevel, limit?: number): LogEntry[];

  // Reports
  async runReport(config: ReportConfig): Promise<ReportResult>;
  async saveReport(config: ReportConfig): Promise<void>;
  async listReports(): Promise<ReportConfig[]>;
  async deleteReport(reportId: string): Promise<void>;
  exportReport(result: ReportResult, format: 'csv' | 'json'): Buffer;
}
```

### 8.2 Desktop Info Collection

```typescript
class DesktopInfoCollector {
  // Runs in main process
  getAppInfo(): AppInfo {
    return {
      version: app.getVersion(),
      build: process.env.BUILD_ID,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      lastUpdated: this.getLastUpdateDate()
    };
  }

  getMemoryUsage(): MemoryInfo {
    const usage = process.memoryUsage();
    return {
      currentBytes: usage.heapUsed,
      peakBytes: this.peakMemory,
      limitBytes: this.memoryLimit
    };
  }

  async getFileCacheInfo(): Promise<FileCacheInfo> {
    const cacheDir = path.join(app.getPath('userData'), 'file-cache');
    const stats = await this.calculateDirStats(cacheDir);
    return {
      usedBytes: stats.totalSize,
      limitBytes: this.cacheLimit,
      fileCount: stats.fileCount,
      oldestFileAge: stats.oldestFileDays
    };
  }

  async getLocalStorageInfo(): Promise<LocalStorageInfo> {
    // Calculate sizes of cached data and files
  }

  async checkConnections(): Promise<ConnectionStatus[]> {
    // Ping each service and measure latency
  }
}
```

---

## 9. Implementation Checklist

### 9.1 Moku API

- [ ] Create insights endpoints for dashboard
- [ ] Create insights endpoints for user activity
- [ ] Create insights endpoints for thread topics
- [ ] Create insights endpoints for project activity
- [ ] Create insights endpoints for workflow activity
- [ ] Create report execution endpoint
- [ ] Create saved reports CRUD endpoints

### 9.2 Desktop

- [ ] Implement InsightsService
- [ ] Implement DesktopInfoCollector
- [ ] Create Dashboard view
- [ ] Create User Activity view
- [ ] Create Thread Topics view
- [ ] Create Project & Workflow Activity view
- [ ] Create Desktop Information view
- [ ] Create Report Writer view
- [ ] Implement CSV/JSON export
- [ ] Add topic detection to thread creation

### 9.3 UI Components

- [ ] Activity summary cards
- [ ] Line/bar charts (activity over time)
- [ ] Pie/donut charts (distributions)
- [ ] Heatmap (hourly distribution)
- [ ] Data tables with sorting
- [ ] Progress bars (cache/memory usage)
- [ ] Log viewer with filtering
- [ ] Report configuration builder
- [ ] Export dropdown

---

## 10. Key Decisions Summary

| Decision | Value |
|----------|-------|
| Dashboard refresh | On load + manual refresh |
| Activity data source | Moku API (audit data) |
| Desktop info source | Local (main process) |
| Topic detection | Auto on thread creation |
| Topic categories | 8 initial categories |
| Report data sources | Audit, threads, workflows, projects |
| Export formats | CSV, JSON (PDF future) |
| Log retention | Last 1000 entries in memory |
| Cache stats | Real-time from filesystem |
| Connection check | Ping with latency measurement |

---

_Insights feature requirements defined - 2025-11-25_
