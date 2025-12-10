# Story 4.3: Deep Link Handler

Status: ready-for-dev

## Story

As a user,
I want to open specific threads, projects, and workflows via holokai:// links,
so that I can navigate directly from external sources (browser, email, etc.).

## Acceptance Criteria

1. holokai://thread/{id} opens specific thread (CORE §10.2)
2. holokai://project/{id} opens specific project (CORE §10.2)
3. holokai://workflow/{id} opens specific workflow (CORE §10.2)
4. holokai://settings opens settings page (CORE §10.2)
5. holokai://settings/{section} opens specific settings tab (CORE §10.2)
6. Links work from browser, email, and other applications (CORE §10.3)
7. Links work when app is closed (launch app and navigate) (CORE §10.3)
8. Links work when app is open (focus window and navigate) (CORE §10.4)
9. Malformed URLs handled gracefully (show error toast, log warning)
10. Authentication required before navigation (redirect to login if needed)

## Tasks / Subtasks

- [ ] Register holokai:// protocol handler (AC: #6, #7, #8)
  - [ ] Register protocol in main.ts: app.setAsDefaultProtocolClient('holokai')
  - [ ] Configure electron-builder for protocol registration
  - [ ] macOS: Add protocol to Info.plist (CFBundleURLTypes)
  - [ ] Windows: Registry entry added by installer
  - [ ] Linux: Add .desktop file with MimeType=x-scheme-handler/holokai
  - [ ] Test protocol registration on all platforms

- [ ] Create DeepLinkParser utility (AC: #1-#5, #9)
  - [ ] Create `src/utils/deepLinkParser.ts`
  - [ ] Parse URL format: holokai://{route}/{id}?{params}
  - [ ] Extract route type: 'thread' | 'project' | 'workflow' | 'settings'
  - [ ] Extract route ID (if applicable)
  - [ ] Extract query parameters (optional)
  - [ ] Validate URL format, return null for malformed URLs
  - [ ] Write unit test: Valid URLs parsed correctly
  - [ ] Write unit test: Malformed URLs return null

- [ ] Create DeepLinkRouter service (AC: #1-#5, #10)
  - [ ] Create `src/services/DeepLinkRouter.ts`
  - [ ] Implement handleDeepLink(url: string) method
  - [ ] Parse URL with DeepLinkParser
  - [ ] Check if user is authenticated (authStore.isAuthenticated)
  - [ ] If not authenticated: Store pending URL, navigate to login
  - [ ] After login: Process pending URL
  - [ ] Route handlers:
    - thread/{id}: navigate('/thread/:id')
    - project/{id}: navigate('/project/:id')
    - workflow/{id}: navigate('/workflow/:id')
    - settings: navigate('/settings')
    - settings/{section}: navigate('/settings', {tab: section})
  - [ ] Show error toast for unknown routes
  - [ ] Write unit test: Route handlers navigate correctly
  - [ ] Write unit test: Unauthenticated user redirected to login

- [ ] Handle deep links when app is closed (AC: #7, #10)
  - [ ] Listen for 'open-url' event in main.ts (macOS)
  - [ ] Listen for 'second-instance' event in main.ts (Windows/Linux)
  - [ ] Store deep link URL during app launch (before window ready)
  - [ ] Process stored URL after app.whenReady() and user authenticated
  - [ ] Send URL to renderer via IPC: 'deep-link-navigate'
  - [ ] Renderer processes URL with DeepLinkRouter
  - [ ] Write integration test: Launch app with URL, verify navigation

- [ ] Handle deep links when app is open (AC: #8)
  - [ ] Listen for 'open-url' event (macOS)
  - [ ] Listen for 'second-instance' event (Windows/Linux)
  - [ ] Focus existing window: BrowserWindow.focus()
  - [ ] Send URL to renderer via IPC: 'deep-link-navigate'
  - [ ] Renderer processes URL immediately
  - [ ] Write integration test: Send URL to running app, verify navigation

- [ ] Add pending deep link handling (AC: #10)
  - [ ] Store pending URL in authStore if user not authenticated
  - [ ] After successful login: Check for pending URL
  - [ ] Process pending URL with DeepLinkRouter
  - [ ] Clear pending URL after processing
  - [ ] Show toast: "Opening {resource}..."

- [ ] Add deep link error handling (AC: #9)
  - [ ] Catch errors in route handlers (resource not found, network error)
  - [ ] Show error toast: "Could not open {route}/{id}"
  - [ ] Log error with context (URL, error message, user ID)
  - [ ] Fallback to home page if navigation fails

## Dev Notes

### Architecture Patterns and Constraints

**Protocol Registration:**
- OS handles protocol → launches/focuses app → passes URL
- macOS: 'open-url' event
- Windows/Linux: 'second-instance' event (prevents multiple instances)
- electron-builder handles platform-specific registration

**Two Scenarios:**
1. **App Closed:** Store URL → Wait for app ready → Authenticate → Navigate
2. **App Open:** Focus window → Navigate immediately

**URL Format:**
```
holokai://thread/550e8400-e29b-41d4-a716-446655440000
holokai://project/abc123
holokai://workflow/def456?version=2
holokai://settings/notifications
```

**Authentication Flow:**
- Deep link received → Check authStore.isAuthenticated
- Not authenticated: Store pending URL, navigate to login
- After login: Process pending URL from authStore

### Project Structure Notes

**File Locations:**
- `src-electron/main.ts` - Protocol registration and event listeners
- `src/services/DeepLinkRouter.ts` - Route handling logic
- `src/utils/deepLinkParser.ts` - URL parsing utility
- `src/stores/authStore.ts` - Pending URL storage

**Platform-Specific:**
- macOS: electron-builder handles Info.plist
- Windows: electron-builder adds registry keys
- Linux: electron-builder generates .desktop file

### Testing Framework

**Unit Tests:**
- DeepLinkParser URL parsing
- DeepLinkRouter route handlers

**Integration Tests:**
- IPC communication for deep link events
- Navigation after URL received
- Pending URL after login

**E2E Tests:**
- Launch app with deep link (simulated)
- Send deep link to running app (simulated)

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E4-S3]
- [Source: docs/architecture-2025-11-25.md §2.2 - DeepLinkHandler]

### Learnings from Previous Stories

**From E4-S1, E4-S2:**
- IPC patterns for main ↔ renderer
- Service layer architecture
- Error handling with toasts

## Dev Agent Record

### Context Reference
- [Story Context XML](e4-s3-deep-link-handler.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->
