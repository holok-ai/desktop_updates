# Story 6.3: Activity Charts

Status: ready-for-dev

## Story

As a desktop application user,
I want time-series line charts showing prompts and tokens over time with date range and granularity controls,
so that I can analyze AI usage trends and patterns over different time periods.

## Acceptance Criteria

1. Two separate line charts rendered vertically: Prompts over time (top), Tokens over time (bottom)
2. Charts use separate Y-axis scales appropriate for data magnitude (prompts ~100s, tokens ~100,000s)
3. No multi-series overlay (separate charts for clarity)
4. Date range selector with presets: Last 7 days, Last 30 days, Last 90 days, Custom
5. Granularity selector (Hour, Day, Week, Month) with appropriate enablement (e.g., Hour disabled for >7 day range)
6. Both charts update when date range or granularity changed
7. Hover shows data point tooltip with exact date, prompts (or tokens depending on chart)
8. Totals summary displays total prompts, total tokens, average prompts/day for selected range
9. Each chart renders in <1s for 90-day dataset at daily granularity

## Tasks / Subtasks

- [ ] **Task 1: Create ActivityTab Component (AC: 1-3)**
  - [ ] Create ActivityTab.svelte component
  - [ ] Create two separate Chart.js line charts (prompts chart, tokens chart)
  - [ ] Configure Y-axis scales independently for each chart
  - [ ] Stack charts vertically in layout

- [ ] **Task 2: Implement Date Range Selector (AC: 4)**
  - [ ] Add preset buttons: Last 7 days, Last 30 days, Last 90 days
  - [ ] Add custom date range picker (startDate, endDate inputs)
  - [ ] Highlight active preset
  - [ ] Fetch data when range changes: `insightsService.getActivity(startDate, endDate, granularity)`

- [ ] **Task 3: Implement Granularity Selector (AC: 5-6)**
  - [ ] Add granularity dropdown: Hour, Day, Week, Month
  - [ ] Disable Hour for ranges >7 days (performance constraint)
  - [ ] Update both charts when granularity changed
  - [ ] Debounce selection changes (500ms)

- [ ] **Task 4: Implement Chart Interactions (AC: 7)**
  - [ ] Configure Chart.js tooltips with custom formatting
  - [ ] Show date + value on hover
  - [ ] Separate tooltips for each chart

- [ ] **Task 5: Implement Totals Summary (AC: 8)**
  - [ ] Calculate totals from fetched data
  - [ ] Display: Total Prompts, Total Tokens, Avg Prompts/Day
  - [ ] Update when date range changes

- [ ] **Task 6: Performance Optimization (AC: 9)**
  - [ ] Lazy load Chart.js library (load only when Activity tab opened)
  - [ ] Benchmark render time for 90-day dataset (target: <1s)
  - [ ] Optimize chart options for performance

- [ ] **Task 7: Testing**
  - [ ] Unit test: Date range/granularity logic
  - [ ] E2E test: Full chart interaction flow
  - [ ] Performance test: Chart render time

## Dev Notes

See tech spec for implementation details. Key points:
- Use Chart.js 4.x for line charts
- Separate charts for prompts and tokens (no overlay)
- Smart granularity defaults (auto-disable Hour for long ranges)
- Debounce date range changes to avoid excessive API calls

### References

- [Tech Spec §4.1: Activity Charts](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#services-and-modules)
- [Tech Spec §4.4: Activity Chart Load Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#workflows-and-sequencing)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e6-s3-activity-charts.context.xml

- docs/sprint-artifacts/e6-s3-activity-charts.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
