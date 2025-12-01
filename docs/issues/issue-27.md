## [STORY] Message State Transitions (Sending → Sent → Failed → Retried)

**Parent Feature:** #15
**Priority:** P1 (High)  
**Area:** conversation/frontend state management  
**Estimate:** 4 points

---

### Story  
As a user, I want message state indicators to accurately update from sending to sent (or failed then retried) so that I can trust whether my inputs successfully reached the AI and avoid duplicate messages.

---

### Acceptance Criteria (Gherkin)

**Scenario 1 — Successful State Progression (Happy Path)**  
- **Given** I type and send a message  
  **When** the frontend optimistically renders it with state `sending`  
  **Then** upon receiving backend acknowledgment (`message.ack` event)  
  the state transitions to `sent` and UI reflects success (symbol ✔ or fade animation).  
- **And** message data updated in store (`status: sent`, `sent_at: timestamp`).

**Scenario 2 — Failure Then Retry (Recoverable)**  
- **Given** backend returns temporary error (`503`, `timeout`) for delivery  
  **When** the retry handler resends the message within 10 seconds  
  **Then** message state goes from `failed` → `retrying` → `sent`.  
- **And** UI shows spinner during retry and confirmation on success.

**Scenario 3 — Permanent Failure (Non‑Recoverable)**  
- **Given** the system returns an error classified as non‑retryable (`401`, `400`)  
  **When** I attempt to send the message  
  **Then** the message state becomes `failed` and persists until user clicks “Retry” or “Edit & Resend.”  
- **And** a tooltip appears explaining why the message failed (“Session expired – please log in”).

**Scenario 4 — Message State Machine Integrity**  
- **Given** the message exists in client store  
  **When** its state changes  
  **Then** it follows allowed transitions only:  
  (`sending` → `sent` → `complete` → archived) or   
  (`sending` → `failed` → `retrying` → `sent`).  
- **And** invalid state jumps (e.g., `failed` → `complete`) are rejected by the state machine enforcer.

---

### NFRs (Non‑Functional Requirements)  
- **State Update Latency:** ≤ 150 ms from event receipt to UI update (p95).  
- **Determinism:** Each message limited to one state transition at a time (single thread).  
- **Auditability:** All transitions logged in Telemetry (`state.transition`, old → new, timestamp).  
- **Persistence:** Thread and message entities always consistent with frontend store (verified daily sync job).  
- **Resilience:** State machine resets gracefully after app restart or browser refresh.

---

### Technical Implementation Notes  
- **Frontend Architecture:** Implement Finite State Machine (FSM) pattern in Angular service (`MessageStateMachine`).  
  - Managed via RxJS `BehaviorSubject` or `XState` for explicit state charts [per FSM best practices][web:329][web:333].  
  - FSM Definition:  
    `
    states = {
      sending: { on: { ACK: "sent", FAIL: "failed" } },
      sent: { on: { CONFIRM: "complete" } },
      failed: { on: { RETRY: "retrying" } },
      retrying: { on: { ACK: "sent", FAIL: "failed" } },
      complete: {}
    }
    `  
- **Backend Signals:** Events (`message.ack`, `message.failed`, `message.retry`) received through WebSocket or SSE and fed into FSM dispatcher.  
- **Persistence:** On every transition, write the updated status and timestamp to IndexedDB store.  
- **Integrity Guard:** Concurrent FSM instances prevented (per thread single actor model) [web:336].  
- **Telemetry:** Emit metrics `moku.message.state.count{status}` and `transition.duration.ms`.  
- **UI Feedback:** CSS animations on transition (“sending” pulse, “failed” red icon, “retrying” spinner).

---

### Data / Business Rules  
- Valid States: `sending`, `sent`, `retrying`, `failed`, `complete`, `archived`.  
- Each transition records `previous_state`, `new_state`, `changed_at`.  
- FSM state snapshots stored in IndexedDB (`threads/{id}/state.json`).  
- If user edits a failed message and resends, a new `client_message_id` is generated but `thread_id` remains.  
- Duplicate transition events (ack after retry) ignored based on sequence ID.

---

### Dependencies / Assumptions  
- Backend push events for `ack`, `fail`, and `retry` enabled (Feature 002.3).  
- Frontend includes UI icons and animations assets in design system.  
- Telemetry and Audit services subscribed to `state.transition` topic.  
- Offline queue (Feature 3.3) feeds retrying events as normal transitions.

---

### Definition of Ready (DoR)  
- FSM transition diagram approved ✓  
- Event handlers mapped (ACK/FAIL/RETRY/CONFIRM) ✓  
- Telemetry logging agreed ✓  
- UX icons and states signed off ✓

### Definition of Done (DoD)  
- All transitions occur per FSM rules ✓  
- No illegal state skips detected ✓  
- UI updates real‑time with 150 ms latency p95 ✓  
- Audit entries recorded for each event ✓  
- Load test (500 threads) runs without sync drift ✓

---

**Labels:** `type:story`  `priority:P1`  `area:frontend‑state`  `status:ready`
