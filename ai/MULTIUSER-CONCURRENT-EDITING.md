# Desktop Support for Concurrent Multiuser Editing

Multiple desktop clients connected to the same Holokai project must stay in sync in real time — new messages, file changes, member events, and typing indicators should propagate to every watching member without requiring a manual refresh. This document specifies the requirements, message exchange protocol, new Moku API surface, and the rationale for choosing SSE + REST over WebSockets.

---

## Requirements

- **Subscribe to Project Changes** — When a user navigates to a project route, the desktop will call a subscribe Moku endpoint (opens a persistent SSE connection to Moku) for the current project and will receive project change events through SSE. Moku will broadcast project change events to users who have subscribed.
- **Desktop Unsubscription** - the Desktop will unsubscribe a subscribed user when the user navigates to a route outside a project. The desktop will also clear the current user subscriptions on: app start, app exit, user login, user logout. 
- **Desktop Project Change Events** — The existing `ProjectService` and `ProjectMemberService` in Moku will be extended to call the SSE service as a side-effect of processing each mutation. No separate notification endpoint is needed from the Desktop: when a project property update, instruction change, file operation, or member join/removal is committed by the relevant service, it calls the SSE service internally and the appropriate event (`project-changed`, `instructions-changed`, `file-changed`, or `member-changed`) is broadcast to all subscribers of that project.
- **Desktop User Entering New Prompt Text Event** -- This event is used to show subscribed users that another user has started typing a new prompt in the thread.  The Desktop will call a Moku API endpoint with the event. Subscribed users see a little bubble in their thread ("Lauren has started typing a new prompt.") that this is happening.  
- **Desktop New Prompt and Response Events** — Two events to capture: 1) once a user submits a new prompt, that prompt is shown in the chat of all subscribed users; 2) once the response is complete, the response is shown in the chat of all subscribed users. Because message persistence is owned by Holo (not Moku), the Desktop explicitly calls a Moku notification endpoint (`POST /threads/{threadId}/messages`) for each event. Moku broadcasts `message-created` to other subscribers and returns immediately; it does not store the message.
- **Keepalive** — Moku sends a `ping` event every 30 seconds to prevent proxies and OS networking stacks from closing idle connections.
- **Reconnection safety** — the desktop passes a `Last-Event-ID` header on reconnect so Moku can replay any events missed during a dropped connection, preventing gaps in state.

### Project Change Events
Project Change Events include the following:
- **Project Properties Change** — when project title, description, type or any future properties are changed, all subscribed desktops receive a `project-changed` event and update their local project view.
- **Instructions Change** — when project instructions are changed, all subscribed desktops receive an `instructions-changed` event and update their local instructions view.
- **Member Change** — when a member joins or is removed from the project, all connected desktops receive a `member-changed` event and update the member list accordingly.
- **File (metadata) Change** — when a file is added, updated, or deleted, all other desktops receive a `file-changed` event carrying only metadata; content is fetched lazily on demand using the stable `virtualFileId`.

---

## Desktop ↔ Moku Message Exchange

> Paths are abbreviated for readability. All endpoints are prefixed `/api/v1/projects/{projectId}`.

> **Two broadcast patterns:**
> - **Message events** — the Desktop explicitly calls a Moku notification endpoint; Moku has no other way to learn of new messages because Holo owns persistence.
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
    │  Desktop A notifies: new prompt:│                               │
    │── POST /threads/{threadId}/messages ──────────────────────────►│
    │◄── 204 No Content ─────────────│                               │
    │                                │──── event: message-created ───────►│
    │                                │    { threadId, branchId,      │
    │                                │      role: "user", content }  │
    │                                │                               │
    │  Desktop A notifies: new response (received from Holo):        │
    │── POST /threads/{threadId}/messages ──────────────────────────►│
    │◄── 204 No Content ─────────────│                               │
    │                                │──── event: message-created ───────►│
    │                                │    { role: "assistant", ... } │
    │                                │                               │
    │  ── Project change events (ProjectService / ProjectMemberService broadcasts SSE internally) ─────
    │                                │                               │
    │  Desktop A updates project properties:                         │
    │── PATCH /projects/{projectId} ─►│  [ProjectService]             │
    │◄── 200 OK ─────────────────────│                               │
    │                                │──── event: project-changed ───────►│
    │                                │    { title, description,      │
    │                                │      updatedAt, updatedBy }   │
    │                                │                               │
    │  Desktop A adds or removes a member:                           │
    │── POST /members/{userId} ───────►│  [ProjectMemberService]       │
    │◄── 201 Created ────────────────│                               │
    │                                │──── event: member-changed ────────►│
    │                                │    { userId, role,            │
    │                                │      changeType: "added" }    │
    │                                │                               │
    │  Desktop A updates a file:      │                               │
    │── POST /files ─────────────────►│  [ProjectService]             │
    │◄── 201 Created ────────────────│                               │
    │                                │──── event: file-changed ──────────►│
    │                                │    { virtualFileId, fileName, │
    │                                │      changeType: "added" }    │
    │                                │                               │
    │  Desktop A changes instructions:│                               │
    │── PUT /instructions ───────────►│  [ProjectService]             │
    │◄── 200 OK ─────────────────────│                               │
    │                                │──── event: instructions-changed───►│
    │                                │    { updatedAt, updatedBy }   │
    │                                │                               │
    │  [STRETCH] Desktop A typing:    │                               │
    │── POST /threads/{threadId}/typing ────────────────────────────►│
    │◄── 204 No Content ─────────────│                               │
    │                                │──── event: member-typing ─────────►│
    │                                │    { threadId, branchId,      │
    │                                │      userName, expiresAt }    │
    │                                │                               │
    │  Connection drops and recovers: │                               │
    │── GET /subscribe ──────────────►│                               │
    │   Last-Event-ID: {lastEventId} │                               │
    │◄── replayed missed events ──────│                               │
    │                                │                               │
```

---

## Desktop Multiuser Features

- **Subscription lifecycle** — when a user navigates to a project page, the Desktop opens an SSE connection for that project. The Desktop closes the connection and unsubscribes when any of the following occur: the user navigates to a non-project route, the user logs out, the user logs in (clears any stale subscription from a previous session), app start (clears any stale subscription), or app exit.

- **Prompt authoring flow** — when a project member begins entering a new prompt, the Desktop sends a "Started Typing" notification to Moku. When the member submits the prompt, the Desktop calls `POST /threads/{threadId}/messages` on Moku with the prompt content; Moku broadcasts `message-created` (role: user) to all other watching members. When the Desktop receives the completed assistant response from Holo, it calls the same endpoint again; Moku broadcasts `message-created` (role: assistant). Moku does not persist messages — persistence is handled by Holo.

- **Project change events — internal broadcast** — `project-changed`, `instructions-changed`, `file-changed`, and `member-changed` are not triggered by a separate Desktop notification call. Instead, the existing `ProjectService` and `ProjectMemberService` broadcast the relevant SSE event internally as a side-effect of processing each mutation (property update, instruction update, file operation, member add/remove). The Desktop simply makes its normal REST call and receives the standard HTTP response; the SSE broadcast happens automatically server-side.

- **Watching member — thread view** — watching members receive the authoring sequence in order: a "Typing…" indicator appears first, followed by the new prompt, followed by the new response. All three are displayed inline within the current Thread View, whether that view is Chat, Prompt, or Graphic mode.

- **Watching member — project-level updates** — watching members see a visual notification and then live updates when any of the following change: project properties (title, description), the member list, project instructions, or files.

---

## New Moku Endpoints — `DesktopMultiuserController`

All endpoints require `Authorization: Bearer {jwt}` and validate that the authenticated user is a member of the specified project.

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| `GET` | `/api/v1/projects/{projectId}/subscribe` | `text/event-stream` 200 | Opens a persistent SSE stream scoped to the project. Supports `Last-Event-ID` request header to replay events missed since the given ID. Connection held open until client disconnects. |
| `GET` | `/api/v1/projects/{projectId}/members/active` | `application/json` 200 | Returns the list of members with an active SSE subscription at the time of the call. Used by the desktop on project open to populate the presence indicator. |
| `POST` | `/api/v1/projects/{projectId}/threads/{threadId}/typing` | `204 No Content` | **[STRETCH]** Signals that the authenticated user is actively typing in `threadId`. Body: `{ "branchId": "1.0" }`. Fire-and-forget — Moku broadcasts `member-typing` to all other subscribers and returns immediately. No persistence. |

### Internal SSE Broadcasting

`project-changed`, `instructions-changed`, `file-changed`, and `member-changed` are **not** triggered by a dedicated Desktop notification endpoint. They are broadcast by the existing `ProjectService` and `ProjectMemberService` as a side-effect of processing their normal mutations. The controller methods that handle `PATCH /projects/{projectId}`, `PUT /instructions`, `POST /files`, `POST /members/{userId}`, and `DELETE /members/{userId}` call the SSE service internally after committing the change.

`message-created` is the exception: because Holo owns message persistence, Moku has no other way to learn of new messages. The Desktop explicitly calls `POST /threads/{threadId}/messages` as a notification-only call; Moku broadcasts the event and returns immediately without storing anything.

### SSE Event Reference

| Event name | Broadcast trigger | Excludes author | Notes |
|---|---|---|---|
| `message-created` | Desktop notifies Moku of a new user prompt or assistant response | Yes | |
| `file-changed` | Project file added, updated, or deleted | Yes | |
| `instructions-changed` | Project instructions updated | Yes | |
| `project-changed` | Project title, description, or other properties updated | Yes | |
| `member-changed` | Member added to or removed from project | No | |
| `ping` | Every 30 seconds keepalive | N/A | |
| `member-typing` | Member typing signal received | Yes | [STRETCH] |

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
