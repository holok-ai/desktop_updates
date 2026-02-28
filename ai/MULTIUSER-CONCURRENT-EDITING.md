# Desktop Support for Concurrent Multiuser Editing

Multiple desktop clients connected to the same Holokai project must stay in sync in real time — new messages, file changes, member events, and typing indicators should propagate to every observer without requiring a manual refresh. This document specifies the requirements, message exchange protocol, new Moku API surface, and the rationale for choosing SSE + REST over WebSockets.

---

## Requirements

- **Project subscription** — on opening a project, the desktop opens a persistent SSE connection to Moku and receives all events scoped to that project for as long as the connection is held.
- **Message sync** — when any member's prompt or the resulting assistant response is saved, all other connected desktops receive a `message-created` event and render it in the appropriate thread and branch.
- **File sync (metadata)** — when a file is added, updated, or deleted, all other desktops receive a `file-changed` event carrying only metadata; content is fetched lazily on demand using the stable `virtualFileId`.
- **Instructions sync** — when project instructions are changed, all other desktops receive an `instructions-changed` event and update their local instructions view.
- **Member presence** — when a member joins or is removed from the project, all connected desktops receive a `member-changed` event and update the member list accordingly.
- **Reconnection safety** — the desktop passes a `Last-Event-ID` header on reconnect so Moku can replay any events missed during a dropped connection, preventing gaps in state.
- **Keepalive** — Moku sends a `ping` event every 30 seconds to prevent proxies and OS networking stacks from closing idle connections.
- **[STRETCH] Typing indicator** — when a member begins composing a prompt, all other desktops receive a `member-typing` event and display "X is typing…" in the relevant thread; the indicator auto-clears 3 seconds after the last signal or immediately when the member's `message-created` event arrives.

---

## Desktop ↔ Moku Message Exchange

```
Desktop A                          Moku                         Desktop B
    │                                │                               │
    │── GET /projects/{id}/subscribe ►│◄── GET /projects/{id}/subscribe──│
    │   Authorization: Bearer {jwt}   │    Authorization: Bearer {jwt}   │
    │                                │                               │
    │◄────────── event: ping ─────────│─────────── event: ping ──────────│  (every 30s)
    │                                │                               │
    │                                │                               │
    │  Desktop A sends prompt:        │                               │
    │── POST /threads/{t}/messages ──►│                               │
    │◄── 201 Created ────────────────│                               │
    │                                │──── event: message-created ───────►│
    │                                │    { threadId, branchId,      │
    │                                │      role: "user", content }  │
    │                                │                               │
    │                                │  (assistant response saved)   │
    │                                │──── event: message-created ───────►│
    │                                │    { role: "assistant", ... } │
    │                                │                               │
    │  Desktop A updates a file:      │                               │
    │── POST /projects/{id}/files ───►│                               │
    │◄── 201 Created ────────────────│                               │
    │                                │──── event: file-changed ──────────►│
    │                                │    { virtualFileId, fileName, │
    │                                │      changeType: "added" }    │
    │                                │                               │
    │  Desktop A changes instructions:│                               │
    │── PUT /projects/{id}/instructions►│                             │
    │◄── 200 OK ─────────────────────│                               │
    │                                │──── event: instructions-changed───►│
    │                                │    { updatedAt, updatedBy }   │
    │                                │                               │
    │  [STRETCH] Desktop A typing:    │                               │
    │── POST /threads/{t}/typing ────►│                               │
    │◄── 204 No Content ─────────────│                               │
    │                                │──── event: member-typing ─────────►│
    │                                │    { threadId, branchId,      │
    │                                │      userName, expiresAt }    │
    │                                │                               │
    │  Connection drops and recovers: │                               │
    │── GET /subscribe ──────────────►│                               │
    │   Last-Event-ID: {lastEventId}  │                               │
    │◄── replayed missed events ──────│                               │
    │                                │                               │
```

---

## Desktop Multiuser Features

- **Subscription lifecycle** — when a user navigates to a project page, the Desktop requests the start of asynchronous updates for that project ID. When the user navigates to any non-project route or exits the application, the Desktop requests to stop asynchronous updates, releasing the SSE connection.

- **Prompt authoring flow** — when a project member begins entering a new prompt, the Desktop sends a "Started Typing" notification to Moku. When the member completes entry and submits, the Desktop sends a "New Prompt" notification. When the assistant response is received, the Desktop sends a "New Response" notification.

- **Watching member — thread view** — watching members receive the authoring sequence in order: a "Typing…" indicator appears first, followed by the new prompt, followed by the new response. All three are displayed inline within the current Thread View, whether that view is Chat, Prompt, or Graphic mode.

- **Watching member — project-level updates** — watching members see a visual notification and then live updates when any of the following change: the member list, project instructions, files, or the thread list.

---

## New Moku Endpoints — `DesktopMultiuserController`

All endpoints require `Authorization: Bearer {jwt}` and validate that the authenticated user is a member of the specified project.

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| `GET` | `/api/v1/projects/{projectId}/subscribe` | `text/event-stream` 200 | Opens a persistent SSE stream scoped to the project. Supports `Last-Event-ID` request header to replay events missed since the given ID. Connection held open until client disconnects. |
| `GET` | `/api/v1/projects/{projectId}/members/active` | `application/json` 200 | Returns the list of members with an active SSE subscription at the time of the call. Used by the desktop on project open to populate the presence indicator. |
| `POST` | `/api/v1/projects/{projectId}/threads/{threadId}/typing` | `204 No Content` | **[STRETCH]** Signals that the authenticated user is actively typing in `threadId`. Body: `{ "branchId": "1.0" }`. Fire-and-forget — Moku broadcasts `member-typing` to all other subscribers and returns immediately. No persistence. |

### SSE Event Reference

| Event name | Broadcast trigger | Excludes author |
|---|---|---|
| `message-created` | User prompt or assistant response saved | Yes |
| `file-changed` | File added, updated, or deleted | Yes |
| `instructions-changed` | Project instructions updated | Yes |
| `member-changed` | Member added to or removed from project | No |
| `ping` | Every 30 s keepalive | N/A |
| `member-typing` | Member typing signal received | Yes |

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
