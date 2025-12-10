# Story 6.1: Insights API Endpoints

Status: ready-for-dev

## Story

As a Moku API backend developer,
I want analytics REST endpoints with materialized view optimization and configurable refresh intervals,
so that Holokai Desktop can query dashboard metrics, activity time-series, and project statistics within performance targets (<500ms P95).

## Acceptance Criteria

1. `GET /api/insights/dashboard` returns summary metrics (total threads, prompts, tokens, top 5 models, workflow execution stats)
2. Dashboard response includes `workflowExecutions` object with total, successful, failed, successRate, averageExecutionTimeMs
3. Workflow execution metrics aggregated from `workflow_executions` table in materialized view
4. `GET /api/insights/activity` returns time-series data with configurable granularity (hour, day, week, month)
5. `GET /api/insights/topics` returns top 10 topics (basic keyword extraction from thread titles)
6. `GET /api/insights/projects` returns per-project metrics filtered by user's accessible projects
7. All queries complete in <500ms (P95) for 90-day dataset
8. Materialized view refresh interval configurable (hourly/daily/weekly), default daily at 2 AM UTC
9. Refresh interval configuration stored in refresh_config table
10. API responses include period metadata (startDate, endDate) and refresh configuration

## Tasks / Subtasks

- [ ] **Task 1: Create Database Schema (Materialized View + Config)**
  - [ ] Create `insights_dashboard_summary` materialized view (aggregates threads, messages, tokens, models, workflow stats)
  - [ ] Add indexes: `idx_dashboard_summary_date`, `idx_dashboard_summary_model`
  - [ ] Create `refresh_config` table (interval, last_refreshed_at, next_refresh_at, refresh_in_progress)
  - [ ] Insert default config: interval='daily', next_refresh_at= tomorrow 2AM UTC
  - [ ] Create materialized view refresh function (scheduled via cron or pg_cron extension)

- [ ] **Task 2: Implement InsightsController (Spring Boot)**
  - [ ] Create `InsightsController` class with `@RestController` annotation
  - [ ] Implement `GET /api/insights/dashboard` endpoint
  - [ ] Implement `GET /api/insights/activity` endpoint
  - [ ] Implement `GET /api/insights/topics` endpoint
  - [ ] Implement `GET /api/insights/projects` endpoint
  - [ ] Add JWT authentication requirement (`@Secured` annotation)
  - [ ] Add request validation (date ranges, granularity enum)

- [ ] **Task 3: Implement InsightsService (Business Logic)**
  - [ ] Create `InsightsService` class with `@Service` annotation
  - [ ] Implement `getDashboardSummary(period)` method
    - Query materialized view for totals
    - Aggregate top 5 models by count
    - Calculate workflow execution metrics (total, success rate, avg time)
    - Return `DashboardSummary` response
  - [ ] Implement `getActivityTimeSeries(startDate, endDate, granularity)` method
    - Query `desktop_messages` with `date_trunc(granularity, created_at)`
    - Group by date, aggregate prompts and tokens
    - Fill gaps with zero values for continuous date range
    - Limit to 1,000 data points max
  - [ ] Implement `getTopics(limit)` method
    - Extract keywords from thread titles (basic tokenization)
    - Filter stop words ("new", "chat", "thread")
    - Return top N topics by frequency
  - [ ] Implement `getProjectMetrics(startDate, endDate, userId)` method
    - Query user's accessible projects (RBAC check via ProjectService)
    - Aggregate thread/prompt counts per project
    - Return `ProjectMetrics` response

- [ ] **Task 4: Implement Materialized View Refresh Logic**
  - [ ] Create `MaterializedViewRefreshService` class
  - [ ] Implement `refreshDashboardSummary()` method
    - Execute `REFRESH MATERIALIZED VIEW CONCURRENTLY insights_dashboard_summary`
    - Update `refresh_config` table (last_refreshed_at, next_refresh_at)
    - Log refresh duration and row count
  - [ ] Implement `getRefreshConfig()` method: returns current config
  - [ ] Implement `updateRefreshConfig(interval)` method: updates config, recalculates next_refresh_at
  - [ ] Add scheduled job (Spring `@Scheduled`) to trigger refresh based on config interval

- [ ] **Task 5: Add RBAC and Authorization**
  - [ ] Enforce JWT token authentication on all endpoints
  - [ ] Extract userId from JWT claims
  - [ ] In `getProjectMetrics()`: filter by user's accessible projects only
  - [ ] Return 403 Forbidden if user attempts to access unauthorized project data

- [ ] **Task 6: Implement Caching Layer**
  - [ ] Add 5-minute TTL cache for dashboard queries (Spring Cache or Redis)
  - [ ] Cache key: `dashboard:{userId}:{period}`
  - [ ] Cache invalidation on materialized view refresh
  - [ ] Log cache hits/misses for monitoring

- [ ] **Task 7: Testing and Performance**
  - [ ] Unit test: InsightsService methods with mocked repository
  - [ ] Integration test: Full API endpoints with test database
  - [ ] Performance test: Query latency for 90-day dataset (target: <500ms P95)
  - [ ] E2E test: Dashboard load flow (Desktop → API → Response)
  - [ ] Load test: 100 concurrent requests (verify <500ms P95)

## Dev Notes

### Materialized View Schema (Tech Spec §4.2)

```sql
-- Materialized view for dashboard summary
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

-- Insert default configuration (daily at 2 AM UTC)
INSERT INTO refresh_config (interval, next_refresh_at)
VALUES ('daily', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '2 hours');
```

### InsightsController Implementation

```java
@RestController
@RequestMapping("/api/insights")
@Secured("ROLE_USER")
public class InsightsController {

    @Autowired
    private InsightsService insightsService;

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardSummary> getDashboard(
        @RequestParam(defaultValue = "30") int period,
        @AuthenticationPrincipal User user
    ) {
        DashboardSummary summary = insightsService.getDashboardSummary(period, user.getId());
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/activity")
    public ResponseEntity<ActivityTimeSeries> getActivity(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        @RequestParam(defaultValue = "day") String granularity,
        @AuthenticationPrincipal User user
    ) {
        ActivityTimeSeries timeSeries = insightsService.getActivityTimeSeries(
            startDate, endDate, granularity, user.getId()
        );
        return ResponseEntity.ok(timeSeries);
    }

    @GetMapping("/topics")
    public ResponseEntity<TopicsResponse> getTopics(
        @RequestParam(defaultValue = "10") int limit,
        @AuthenticationPrincipal User user
    ) {
        TopicsResponse topics = insightsService.getTopics(limit, user.getId());
        return ResponseEntity.ok(topics);
    }

    @GetMapping("/projects")
    public ResponseEntity<ProjectMetrics> getProjects(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        @AuthenticationPrincipal User user
    ) {
        ProjectMetrics metrics = insightsService.getProjectMetrics(
            startDate, endDate, user.getId()
        );
        return ResponseEntity.ok(metrics);
    }

    @GetMapping("/refresh-config")
    public ResponseEntity<RefreshConfig> getRefreshConfig() {
        RefreshConfig config = insightsService.getRefreshConfig();
        return ResponseEntity.ok(config);
    }

    @PutMapping("/refresh-config")
    public ResponseEntity<RefreshConfig> updateRefreshConfig(
        @RequestBody RefreshConfig config,
        @AuthenticationPrincipal User user
    ) {
        // RBAC: Only admins can update refresh config
        if (!user.hasRole("ROLE_ADMIN")) {
            return ResponseEntity.status(403).build();
        }
        RefreshConfig updated = insightsService.updateRefreshConfig(config);
        return ResponseEntity.ok(updated);
    }
}
```

### InsightsService Implementation

```java
@Service
public class InsightsService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ProjectService projectService;

    @Cacheable(value = "dashboard", key = "#userId + ':' + #period")
    public DashboardSummary getDashboardSummary(int period, String userId) {
        LocalDate startDate = LocalDate.now().minusDays(period);
        LocalDate endDate = LocalDate.now();

        // Query materialized view for aggregated metrics
        String sql = """
            SELECT
                SUM(total_threads) as total_threads,
                SUM(total_prompts) as total_prompts,
                SUM(total_tokens) as total_tokens,
                SUM(workflow_executions_total) as workflow_total,
                SUM(workflow_executions_successful) as workflow_successful,
                SUM(workflow_executions_failed) as workflow_failed,
                AVG(workflow_success_rate) as workflow_success_rate,
                AVG(workflow_avg_execution_time_ms) as workflow_avg_time
            FROM insights_dashboard_summary
            WHERE date >= ? AND date <= ?
        """;

        DashboardSummary summary = jdbcTemplate.queryForObject(sql,
            new Object[]{startDate, endDate},
            (rs, rowNum) -> DashboardSummary.builder()
                .totalThreads(rs.getLong("total_threads"))
                .totalPrompts(rs.getLong("total_prompts"))
                .totalTokens(rs.getLong("total_tokens"))
                .workflowExecutions(WorkflowExecutions.builder()
                    .total(rs.getInt("workflow_total"))
                    .successful(rs.getInt("workflow_successful"))
                    .failed(rs.getInt("workflow_failed"))
                    .successRate(rs.getDouble("workflow_success_rate"))
                    .averageExecutionTimeMs(rs.getDouble("workflow_avg_time"))
                    .build())
                .period(Period.builder()
                    .startDate(startDate.toString())
                    .endDate(endDate.toString())
                    .build())
                .build()
        );

        // Query top 5 models
        String topModelsSql = """
            SELECT model_name, SUM(model_count) as count
            FROM insights_dashboard_summary
            WHERE date >= ? AND date <= ?
            GROUP BY model_name
            ORDER BY count DESC
            LIMIT 5
        """;

        List<TopModel> topModels = jdbcTemplate.query(topModelsSql,
            new Object[]{startDate, endDate},
            (rs, rowNum) -> TopModel.builder()
                .modelName(rs.getString("model_name"))
                .count(rs.getInt("count"))
                .build()
        );

        summary.setTopModels(topModels);

        return summary;
    }

    public ActivityTimeSeries getActivityTimeSeries(
        LocalDate startDate, LocalDate endDate, String granularity, String userId
    ) {
        // Validate granularity
        if (!List.of("hour", "day", "week", "month").contains(granularity)) {
            throw new IllegalArgumentException("Invalid granularity: " + granularity);
        }

        String sql = """
            SELECT
                DATE_TRUNC(?, created_at) as date,
                COUNT(*) as prompts,
                SUM(token_count) as tokens
            FROM desktop_messages
            WHERE role = 'user'
              AND created_at >= ?
              AND created_at <= ?
            GROUP BY DATE_TRUNC(?, created_at)
            ORDER BY date
            LIMIT 1000
        """;

        List<ActivityDataPoint> dataPoints = jdbcTemplate.query(sql,
            new Object[]{granularity, startDate, endDate, granularity},
            (rs, rowNum) -> ActivityDataPoint.builder()
                .date(rs.getTimestamp("date").toInstant().toString())
                .prompts(rs.getInt("prompts"))
                .tokens(rs.getLong("tokens"))
                .build()
        );

        // Fill gaps with zero values for continuous date range
        List<ActivityDataPoint> filledData = fillDateGaps(dataPoints, startDate, endDate, granularity);

        // Calculate totals
        long totalPrompts = filledData.stream().mapToLong(ActivityDataPoint::getPrompts).sum();
        long totalTokens = filledData.stream().mapToLong(ActivityDataPoint::getTokens).sum();
        long daysDiff = ChronoUnit.DAYS.between(startDate, endDate);
        double avgPromptsPerDay = daysDiff > 0 ? (double) totalPrompts / daysDiff : 0;

        return ActivityTimeSeries.builder()
            .data(filledData)
            .granularity(granularity)
            .totals(Totals.builder()
                .prompts(totalPrompts)
                .tokens(totalTokens)
                .averagePromptsPerDay(avgPromptsPerDay)
                .build())
            .build();
    }

    public TopicsResponse getTopics(int limit, String userId) {
        String sql = """
            SELECT title, COUNT(*) as count
            FROM desktop_threads
            WHERE title IS NOT NULL
              AND title NOT IN ('New Chat', 'Untitled Thread')
            GROUP BY title
            ORDER BY count DESC
            LIMIT ?
        """;

        List<Topic> topics = jdbcTemplate.query(sql, new Object[]{limit},
            (rs, rowNum) -> Topic.builder()
                .topic(rs.getString("title"))
                .count(rs.getInt("count"))
                .build()
        );

        return TopicsResponse.builder().topics(topics).build();
    }
}
```

### Materialized View Refresh Service

```java
@Service
public class MaterializedViewRefreshService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 0 2 * * *")  // Daily at 2 AM UTC
    public void refreshDashboardSummaryScheduled() {
        RefreshConfig config = getRefreshConfig();

        // Check if refresh is due
        if (LocalDateTime.now().isAfter(config.getNextRefreshAt())) {
            refreshDashboardSummary();
        }
    }

    public void refreshDashboardSummary() {
        try {
            jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY insights_dashboard_summary");

            // Update refresh config
            jdbcTemplate.update("""
                UPDATE refresh_config
                SET last_refreshed_at = NOW(),
                    next_refresh_at = NOW() + INTERVAL '1 day'
                WHERE id = 1
            """);

            logger.info("Materialized view refreshed successfully");
        } catch (Exception e) {
            logger.error("Materialized view refresh failed", e);
        }
    }

    public RefreshConfig getRefreshConfig() {
        return jdbcTemplate.queryForObject(
            "SELECT * FROM refresh_config WHERE id = 1",
            (rs, rowNum) -> RefreshConfig.builder()
                .interval(rs.getString("interval"))
                .lastRefreshedAt(rs.getTimestamp("last_refreshed_at").toLocalDateTime())
                .nextRefreshAt(rs.getTimestamp("next_refresh_at").toLocalDateTime())
                .refreshInProgress(rs.getBoolean("refresh_in_progress"))
                .build()
        );
    }

    public RefreshConfig updateRefreshConfig(RefreshConfig config) {
        jdbcTemplate.update("""
            UPDATE refresh_config
            SET interval = ?,
                next_refresh_at = NOW() + CASE
                    WHEN ? = 'hourly' THEN INTERVAL '1 hour'
                    WHEN ? = 'daily' THEN INTERVAL '1 day'
                    WHEN ? = 'weekly' THEN INTERVAL '7 days'
                END,
                updated_at = NOW()
            WHERE id = 1
        """, config.getInterval(), config.getInterval(), config.getInterval(), config.getInterval());

        return getRefreshConfig();
    }
}
```

### Performance Targets (Tech Spec §6.1)

- **Dashboard Query**: <500ms P95
- **Activity Query**: <1s P95 for 90-day dataset
- **Topics Query**: <200ms P95
- **Projects Query**: <500ms P95
- **Materialized View Refresh**: <60s for 90 days of data

### Testing Strategy

- **Unit Tests**: Service methods with mocked JDBC template
- **Integration Tests**: Full API endpoints with test PostgreSQL database
- **Performance Tests**: Query latency measurement with 100K messages
- **Load Tests**: 100 concurrent requests (verify <500ms P95)

### Dependencies

- **BLOCKER: E1-S1 (Database Schema Migration)** - Requires desktop_threads, desktop_messages tables
- **Requires: Spring Boot** - REST controller framework
- **Requires: PostgreSQL 14+** - Materialized views support
- **Used by: E6-S2 (Dashboard View)** - Desktop queries these endpoints

### References

- [Tech Spec: Epic 6 Insights Dashboard](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md)
- [Tech Spec §4.2: Data Models (Materialized View Schema)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#data-models-and-contracts)
- [Tech Spec §4.3: APIs (Moku API Endpoints)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#apis-and-interfaces)
- [Tech Spec §6: Non-Functional Requirements](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#non-functional-requirements)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e6-s1-insights-api-endpoints.context.xml

- docs/sprint-artifacts/e6-s1-insights-api-endpoints.context.xml



### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
