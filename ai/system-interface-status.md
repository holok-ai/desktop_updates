# Interface Reliability & Status Monitoring

The desktop application depends on three external interfaces: Moku API (REST), Holo API (Chat), and Holo Notifications (SSE). This document describes the backend reliability monitoring system that tracks the availability and health of these interfaces. The backend collects status data, runs escalating health checks when an interface becomes unavailable, and pushes status change events to the renderer via IPC. A companion UI Reliability Requirements and Design section will follow to describe how the frontend consumes this data.

---

## Backend Reliability Requirements and Design

### Requirements

| # | Requirement |
|---|-------------|
| 1 | Each external interface shall have an independently tracked status of `unknown`, `available`, `not-available`, or `down`. |
| 2 | The system shall record per-interface metrics: last use time, message count, error count, last error message, and time first available. |
| 3 | Moku API calls shall be transparently monitored by replacing `fetch` with a drop-in `mokuFetch` wrapper across all Moku service classes. |
| 4 | Holo API (chat) calls shall record success/failure at the `DesktopChatService` boundary since the chat component is an opaque npm package. |
| 5 | Holo Notifications (SSE) shall record connection success, incoming events, and connection errors via the `NotificationService`. |
| 6 | An `ErrorClassifier` per interface shall distinguish interface-down errors (5xx, network) from request-level errors (4xx) so that a bad request does not falsely mark the interface as down. |
| 7 | When an interface becomes `not-available`, an escalating non-blocking health check schedule shall run: every 2 seconds for 10 seconds, then every 5 seconds for 30 seconds, then declare `down`. |
| 8 | A successful health check or successful call at any point shall immediately restore the interface to `available` and cancel remaining health checks. |
| 9 | All interface status data shall be accessible from the renderer at any time via IPC request-response handlers (`invoke`/`handle`). |
| 10 | The system shall push an `InterfaceStatusChangeEvent` to the renderer via IPC whenever any interface transitions between statuses. |
| 11 | All monitors shall reset to `unknown` on user logout. |
| 12 | All reliability recording shall be defensive (try/catch, `hasMonitor` guards) so that failures in monitoring never break the monitored service. |

### Reliability Classes

| Class / Module | File | Description |
|---|---|---|
| `InterfaceMonitor` | `src-electron/services/reliability/interface-monitor.ts` | Core per-interface monitor. Tracks status and metrics, runs escalating health checks via `setTimeout` chains, and fires `StatusChangeCallback` listeners through a centralized `setStatus()` method. |
| `InterfaceStatusRegistry` | `src-electron/services/reliability/interface-status-registry.ts` | Singleton registry holding all `InterfaceMonitor` instances. Provides aggregate queries (`getAllStatuses`), coordinated lifecycle management (`resetAll`, `disposeAll`), and a factory function `initializeReliabilityMonitors()`. |
| `mokuFetch` | `src-electron/services/reliability/moku-fetch.ts` | Drop-in replacement for `fetch()` that records success/failure to the `moku-api` monitor. Falls through to native `fetch` if the registry is not yet initialized. |
| `reliability-handler` | `src-electron/ipc-handlers/reliability-handler.ts` | IPC handlers for request-response queries and a `subscribeToStatusChanges()` function that broadcasts push events to all renderer windows. |
| `reliability.types` | `src-electron/types/reliability.types.ts` | Shared TypeScript types: `InterfaceStatus`, `InterfaceName`, `InterfaceStatusSnapshot`, `AllInterfaceStatuses`, `ErrorClassifier`, `HealthCheckFn`, `InterfaceStatusChangeEvent`, `StatusChangeCallback`. |

### Monitored Interfaces

| Interface | `InterfaceName` | Monitoring Approach | Error Classifier | Health Check |
|---|---|---|---|---|
| Moku API | `moku-api` | `mokuFetch` wrapper replaces `fetch` in all 5 Moku service classes (`thread-api`, `project-api`, `project-member-api`, `user-api`, `moku.service`) | `mokuErrorClassifier` - 500/502/503/504 and network errors (`-1`) indicate down; other status codes are request errors | `GET /api/health` on Moku API URL with 5s timeout |
| Holo API | `holo-api` | `DesktopChatService.chat()` wrapped with try/catch to call `recordSuccess()` / `recordError()` | `holoErrorClassifier` - 500/502/503/504 and network errors indicate down; 4xx errors are chat-level failures (Holo still up) | `GET /api/health` on Holo API URL with 5s timeout |
| Holo Notifications | `holo-notifications` | `NotificationService` calls `recordReliability()` on SSE connect, disconnect, and each incoming event | `notificationsErrorClassifier` - any connection failure indicates down (SSE has no HTTP status granularity) | `GET /api/health` on Holo API URL with 5s timeout |

### Interface Status Transition Events

The `InterfaceStatusChangeEvent` is pushed to the renderer via `reliability:statusChanged` IPC channel on every status transition. The following table shows all possible transitions:

| Previous Status | New Status | Trigger |
|---|---|---|
| `unknown` | `available` | First successful call or health check |
| `unknown` | `not-available` | First call fails with an interface-down error (5xx / network) |
| `available` | `not-available` | A call fails with an interface-down error |
| `not-available` | `available` | A successful call or a passing health check |
| `not-available` | `down` | All escalating health checks exhausted (2s x 5, then 5s x 6) |
| `down` | `available` | A successful call or a manual health check passes |
| any | `unknown` | Monitor reset (e.g., user logout) |

### IPC API (Preload)

The renderer accesses reliability data through `window.electronAPI.reliability`:

| Method | IPC Pattern | Description |
|---|---|---|
| `getAllStatuses()` | `invoke` / `handle` | Returns `AllInterfaceStatuses` snapshot of all three interfaces |
| `getStatus(name)` | `invoke` / `handle` | Returns `InterfaceStatusSnapshot` for a single interface |
| `healthcheck(name)` | `invoke` / `handle` | Triggers a manual health check and returns the updated snapshot |
| `reset(name)` | `invoke` / `handle` | Resets a single interface's metrics and returns the snapshot |
| `onStatusChange(callback)` | `on` (push) | Subscribes to `InterfaceStatusChangeEvent` push notifications; returns an unsubscribe function |
