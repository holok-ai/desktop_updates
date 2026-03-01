# Desktop Support for Concurrent Multiuser Editing

Multiple desktop clients connected to the same Holokai project must stay in sync in real time — new messages, file changes, member events, and typing indicators should propagate to every watching member without requiring a manual refresh. This document specifies the requirements, message exchange protocol, new Moku API surface, and the rationale for choosing SSE + REST over WebSockets.

**Open Decision**: How Moku API learns of `prompt-created` (llm_request) and `response-created` (llm_response) events is still open. Option (a) Desktop uses new endpoints to call Moku API; option (b) database trigger on request or response insert → RabbitMQ -> Moku API. Both produce the same SSE events but have different ownership and latency trade-offs.

---

## Requirements

- **Desktop Subscribe to Project Changes** — When a user navigates to a project route, the desktop will call a subscribe Moku endpoint (opens a persistent SSE connection to Moku) for the current project and will receive project change events through SSE. Moku will broadcast project change events to users who have subscribed.
- **Desktop Unsubscription** — the Desktop calls `POST /api/v1/projects/{projectId}/unsubscribe` and then closes the SSE connection. Moku marks the subscription as intentionally closed and cleans up the emitter on disconnect. The Desktop calls unsubscribe in any of these situations: the user navigates to a route outside a project, app start (clears any stale subscription from a previous session), app exit, user login, or user logout.
- **Unintentional Disconnect Recovery** — if the SSE connection drops unexpectedly, the Desktop calls a Moku healthcheck endpoint and then reconnects to `/subscribe` with `Last-Event-ID` to replay missed events.
- **Desktop Project Change Events** — The existing `ProjectService` and `ProjectMemberService` in Moku will be extended to call the Moku SSE service as a side-effect of performing CRUD operations/mutations. No separate notification endpoint is needed for project changes (outside of thread changes) from the Desktop: when a project property update, instruction change, file operation, or member join/removal is committed by the relevant service, it calls the Moku API SSE service internally and the appropriate event (`project-changed`, `instructions-changed`, `file-changed`, or `member-changed`) is broadcast to subscribers of that project.
- **Desktop User Entering New Prompt Text Event** -- This event is used to show subscribed users that another user has started typing a new prompt in the thread.  The Desktop will call a Moku API endpoint with the event. Subscribed users see a little bubble in their thread ("Lauren has started typing a new prompt.").
- **Desktop New Prompt and Response Events** — Two distinct events to capture: 1) once a user submits a new prompt, a `prompt-created` event is sent to all subscribed users; 2) once the response is complete, a `response-created` event is sent to all subscribed users. Two design options for how Moku learns of these events:
  - **Option a** — the Desktop explicitly calls a (new) Moku notification endpoint for each event. Moku broadcasts `prompt-created` or `response-created` to any subscribers. 
  - **Option b** — a trigger on the `llm_requests` / `llm_responses` tables detects new rows and sends a RabbitMQ message; the Moku SSE service consumes it and broadcasts the event. No Desktop notification call (as in option a) is needed.
- **Keepalive** — Moku SSE Service sends a `ping` event every 30 seconds to prevent proxies and OS networking stacks from closing idle connections.
- **Reconnection safety** — the desktop passes a `Last-Event-ID` header on reconnect so Moku can send any events missed during a dropped connection, preventing gaps in state.

### Project-scoped SSE Events
Project-scoped SSE Events include the following:
- **Project Properties Change** — when project title, description, type or any future properties are changed, all subscribed desktops receive a `project-changed` event and update their local project view.
- **Instructions Change** — when project instructions are changed, all subscribed desktops receive an `instructions-changed` event and update their local instructions view.
- **Member Change** — when a member joins or is removed from the project, all connected desktops receive a `member-changed` event and update the member list accordingly.
- **File (metadata) Change** — when a file is added, updated, or deleted, all other desktops receive a `file-changed` event carrying only metadata; content is fetched lazily on demand using the stable `virtualFileId`.

---

## Desktop ↔ Moku Message Exchange

> Paths are abbreviated for readability. All endpoints are prefixed `/api/v1/projects/{projectId}`.

> **Two broadcast patterns:**
> - **Prompt / response events** — shown below as option (a): the Desktop explicitly calls a Moku notification endpoint. Option (b) (database trigger → RabbitMQ) is an alternative; the SSE events emitted are the same either way.
> - **Project change events** — `ProjectService` or `ProjectMemberService` broadcasts the SSE event internally as part of processing the normal REST call; the Desktop does nothing extra.

```
Desktop A                          Moku                         Desktop B
    │                                │                               │
    │── GET /subscribe ─────────────►│◄─────────── GET /subscribe ───│
    │   Authorization: Bearer {jwt}  │    Authorization: Bearer {jwt}│
    │                                │                               │
    │◄────────── event: ping ────────│──────────── event: ping ──────│  (every 30 seconds)
    │                                │                               │
    │  ── Message events (Desktop notifies Moku explicitly) ─────────────────────────────────
    │                                │                               │
    │  Desktop A notifies: new prompt [option a]:                    │
    │── POST /threads/{threadId}/messages ──────────────────────────►│
    │◄── 204 No Content ─────────────│                               │
    │                                │──── event: prompt-created ────────►│
    │                                │    { userId, threadId,        │
    │                                │      branchId, content }      │
    │                                │                               │
    │  Desktop A notifies: new response [option a]:                  │
    │── POST /threads/{threadId}/messages ──────────────────────────►│
    │◄── 204 No Content ─────────────│                               │
    │                                │──── event: response-created ──────►│
    │                                │    { userId, threadId,        │
    │                                │      branchId, content }      │
    │                                │                               │
    │  ── Project change events (ProjectService / ProjectMemberService broadcasts SSE internally) ─────
    │                                │                               │
    │  Desktop A updates project properties:                         │
    │── PATCH /projects/{projectId} ─►│  [ProjectService]             │
    │◄── 200 OK ─────────────────────│                               │
    │                                │──── event: project-changed ───────►│
    │                                │    { userId, projectId }      │
    │                                │                               │
    │  Desktop A adds or removes a member:                           │
    │── POST /members/{userId} ───────►│  [ProjectMemberService]       │
    │◄── 201 Created ────────────────│                               │
    │                                │──── event: member-changed ────────►│
    │                                │    { userId, projectId }      │
    │                                │                               │
    │  Desktop A updates a file:      │                               │
    │── POST /files ─────────────────►│  [ProjectService]             │
    │◄── 201 Created ────────────────│                               │
    │                                │──── event: file-changed ──────────►│
    │                                │    { userId, projectId }      │
    │                                │                               │
    │  Desktop A changes instructions:│                               │
    │── PUT /instructions ───────────►│  [ProjectService]             │
    │◄── 200 OK ─────────────────────│                               │
    │                                │──── event: instructions-changed───►│
    │                                │    { userId, projectId }      │
    │                                │                               │
    │  [STRETCH] Desktop A typing:    │                               │
    │── POST /threads/{threadId}/typing ────────────────────────────►│
    │◄── 204 No Content ─────────────│                               │
    │                                │──── event: member-typing ─────────►│
    │                                │    { userId, threadId,        │
    │                                │      branchId }               │
    │                                │                               │
    │  Desktop navigates away / app exit / login / logout:           │
    │── POST /unsubscribe ────────────►│                               │
    │◄── 204 No Content ─────────────│                               │
    │   [Desktop closes SSE connection]│  [Moku cleans up emitter]    │
    │                                │                               │
    │  Unintentional connection drop and recovery:                    │
    │── GET /health ────────────────►│                               │
    │◄── 200 OK ─────────────────────│                               │
    │── GET /subscribe ──────────────►│                               │
    │   Last-Event-ID: {lastEventId} │                               │
    │◄── replayed missed events ──────│                               │
    │                                │                               │
```

---

## Desktop Multiuser Features

- **Subscription lifecycle** — when a user navigates to a project page, the Desktop opens an SSE connection via `GET /subscribe`. To unsubscribe, the Desktop calls `POST /unsubscribe` and then closes the SSE connection; the Moku API manages the connection state so the Desktop can close immediately after unsubscribing. Unsubscribe keeps the subscriber list in the Moku SSE service as compact as practical. The Desktop unsubscribes in any of these situations: navigating to a non-project route, app start (clears any stale subscription from a previous session), app exit, user login, or user logout. An unintentional connection drop is handled differently — the Desktop calls a Moku healthcheck endpoint and then reconnects with a `Last-Event-ID` header so Moku can replay missed events.

- **Prompt authoring flow** — when a project member begins entering a new prompt, the Desktop sends a "Started Typing" notification to Moku. When the member submits the prompt, Moku broadcasts a `prompt-created` event to all other watching members. When the response is complete, Moku broadcasts a `response-created` event. How Moku learns of these two events is an open design choice (option a: Desktop notification call; option b: database trigger → RabbitMQ). Moku does not persist messages — persistence is handled by Holo.

- **Project change events — internal broadcast** — `project-changed`, `instructions-changed`, `file-changed`, and `member-changed` are not triggered by a separate Desktop notification call. Instead, the existing `ProjectService` and `ProjectMemberService` broadcast the relevant SSE event internally as a side-effect of processing each mutation (property update, instruction update, file operation, member add/remove). The Desktop simply makes its normal REST call and receives the standard HTTP response; the SSE broadcast happens automatically server-side.

- **Watching member — thread view** — watching members receive the authoring sequence in order: a "Typing…" indicator appears first, followed by the new prompt, followed by the new response. All three are displayed inline within the current Thread View, whether that view is Chat, Prompt, or Graphic mode.

- **Watching member — project-level updates** — watching members see a visual notification and then live updates when any of the following change: project properties (title, description), the member list, project instructions, or files.

---

## New Moku Endpoints — `DesktopMultiuserController`

All endpoints require `Authorization: Bearer {jwt}` and validate that the authenticated user is a member of the specified project.

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| `GET` | `/api/v1/projects/{projectId}/subscribe` | `text/event-stream` 200 | Opens a persistent SSE stream scoped to the project. Supports `Last-Event-ID` request header to replay events missed since the given ID. Connection held open until client disconnects. |
| `POST` | `/api/v1/projects/{projectId}/unsubscribe` | `204 No Content` | Marks the subscription as intentionally closed and signals Moku to clean up the emitter. The Desktop calls this before closing the SSE connection on navigate-away, app start, app exit, user login, and user logout. |
| `GET` | `/api/v1/projects/{projectId}/members/active` | `application/json` 200 | Returns the list of members with an active SSE subscription at the time of the call. Used by the desktop on project open to populate the presence indicator. |
| `POST` | `/api/v1/projects/{projectId}/threads/{threadId}/typing` | `204 No Content` | **[STRETCH]** Signals that the authenticated user is actively typing in `threadId`. Body: `{ "branchId": "1.0" }`. Fire-and-forget — Moku broadcasts `member-typing` to all other subscribers and returns immediately. No persistence. |

### Internal SSE Broadcasting

`project-changed`, `instructions-changed`, `file-changed`, and `member-changed` are **not** triggered by a dedicated Desktop notification endpoint. They are broadcast by the existing `ProjectService` and `ProjectMemberService` as a side-effect of processing their normal mutations. The controller methods that handle `PATCH /projects/{projectId}`, `PUT /instructions`, `POST /files`, `POST /members/{userId}`, and `DELETE /members/{userId}` call the SSE service internally after committing the change.

`member-typing` is sent from Desktop using a new endpoint in Moku API. 

`prompt-created` and `response-created` are the exception: because Holo owns message persistence, the mechanism by which Moku learns of these events is an open design choice (option a: Desktop notification call; option b: database trigger → RabbitMQ). The SSE event names are the same regardless of which option is chosen.

### SSE Event Reference

| Event name | Broadcast trigger | Excludes author | Notes |
|---|---|---|---|
| `prompt-created` | New user prompt submitted (option a: Desktop notification; option b: DB trigger) | Yes | |
| `response-created` | Assistant response complete (option a: Desktop notification; option b: DB trigger) | Yes | |
| `file-changed` | Project file added, updated, or deleted | Yes | |
| `instructions-changed` | Project instructions updated | Yes | |
| `project-changed` | Project title, description, or other properties updated | Yes | |
| `member-changed` | Member added to or removed from project | No | |
| `ping` | Every 30 seconds keepalive | N/A | |
| `member-typing` | Member typing signal received | Yes | |

### SSE Event Payloads

| Event | Payload fields |
|---|---|
| `prompt-created` | `userId`, `threadId`, `branchId`, `content` |
| `response-created` | `userId`, `threadId`, `branchId`, `content` |
| `member-typing` | `userId`, `threadId`, `branchId` |
| `project-changed` | `userId`, `projectId` |
| `member-changed` | `userId`, `projectId` |
| `file-changed` | `userId`, `projectId` |
| `instructions-changed` | `userId`, `projectId` |
| `ping` | _(none)_ |

Notes:
- `userId` always identifies the member who triggered the event.
- `prompt-created` and `response-created` carry `content` directly so watching members can display the text without a round-trip fetch.
- For all project change events (`project-changed`, `member-changed`, `file-changed`, `instructions-changed`), the payload is intentionally minimal: the Desktop re-fetches the affected resource on receipt rather than relying on embedded data that could be stale.

### Spring Boot Controller Skeleton

```java
@RestController
@RequestMapping("/api/v1/projects/{projectId}")
public class DesktopMultiuserController {

    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(
            @PathVariable String projectId,
            @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId,
            @AuthenticationPrincipal UserDetails user) {
        // register emitter, replay missed events, return SseEmitter
    }

    @PostMapping("/unsubscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(
            @PathVariable String projectId,
            @AuthenticationPrincipal UserDetails user) {
        // mark subscription as intentionally closed, clean up emitter
    }

    @GetMapping("/members/active")
    public ResponseEntity<List<ActiveMemberDto>> getActiveMembers(
            @PathVariable String projectId,
            @AuthenticationPrincipal UserDetails user) {
        // return currently subscribed members
    }

    @PostMapping("/threads/{threadId}/typing")   // STRETCH
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sendTyping(
            @PathVariable String projectId,
            @PathVariable String threadId,
            @RequestBody TypingSignalDto body,
            @AuthenticationPrincipal UserDetails user) {
        // broadcast member-typing to other subscribers, return immediately
    }
}
```

---

## SSE + REST vs WebSockets

### Communication Pattern

Our data flow is inherently asymmetric:

- **Moku → Desktop**: continuous event stream (server push)
- **Desktop → Moku**: discrete action calls (create message, update file, send typing signal)

This asymmetry is the primary input to the decision.

### Comparison

| Dimension | SSE + REST | WebSockets |
|---|---|---|
| **Fit for our pattern** | Exact — server push + separate action calls | Adds bidirectional capability we don't need |
| **Proxy / firewall compatibility** | Works everywhere plain HTTPS works | Some corporate proxies block the `Upgrade: websocket` header |
| **Authentication** | `Authorization: Bearer` header on initial GET | Headers not allowed on WS upgrade; token must go in query param or first message — both have security trade-offs |
| **Reconnection** | Built-in via `Last-Event-ID` — no code required | Must be implemented manually or via a library |
| **Debugging** | `curl -N https://moku/subscribe` dumps the live stream | Requires `wscat` or browser devtools; not inspectable with standard tools |
| **Server implementation** | Spring `SseEmitter` — straightforward | Requires Spring WebSocket + STOMP or raw WS handler |
| **Request / response semantics** | Native HTTP — status codes, error bodies, headers | Must layer a correlation ID scheme over the socket |
| **Per-message overhead** | HTTP chunked framing (slightly heavier at scale) | Lighter WS frames once connected |
| **Binary payloads** | Text (UTF-8) only | Binary or text — not relevant here (all events are JSON) |

### Verdict

**SSE + REST** is the correct choice for this design. Every action the desktop takes is a discrete, stateless HTTP call; the only server-push requirement is a one-way event stream. WebSockets would add meaningful implementation complexity — manual reconnection, authentication workarounds, request/response correlation — with no functional benefit.

WebSockets should be reconsidered only if a future requirement introduces truly bidirectional high-frequency communication such as collaborative cursor tracking or live shared document co-editing. Neither is in scope.

### Typing Signal Nuance

The one case where WebSockets offer a marginal advantage is the `[STRETCH]` typing signal — reusing the existing socket would save one TCP round-trip per signal. At the 1500 ms debounce interval, this saving is imperceptible to the user and does not justify changing the architecture.
