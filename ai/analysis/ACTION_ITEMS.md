# Developer Action Items Checklist

**Priority Legend:** 🔴 Critical | 🟡 High | 🟢 Medium | ⚪ Low

---

## 🔴 CRITICAL - Complete Before Production (5-6 days)

### 1. Implement Exchange Code Flow (1-2 days)
**File:** `src-electron/services/auth.service.ts`

- [ ] Complete `startOAuthFlow()` to properly open browser
- [ ] Implement `processOAuthCallback()` to handle `holokai://home?code=xyz`
- [ ] Add real API calls to:
  - POST `/api/auth/exchange-code` { code }
  - POST `/api/auth/token/refresh` { apiKey }
- [ ] Test custom protocol on Windows, macOS, Linux
- [ ] Add error handling for expired/invalid codes
- [ ] Remove or clearly separate mock login code

**Reference:** Architecture.md Section 9

---

### 2. Implement Routing and MenuNavigationService (1 day)

**New Files:**
- [ ] `src/lib/services/menu-navigation.service.ts`
- [ ] Routing configuration (use SvelteKit or svelte-routing)

**Changes:**
- [ ] Replace manual page switching with hash-based routing
- [ ] Create MenuNavigationService that listens to menu events
- [ ] Service should call `router.navigate()`, not set page state
- [ ] Remove menu listeners from `AppLayout.svelte`
- [ ] Make components respond only to route activation

**Example:**
```typescript
// MenuNavigationService
window.electronAPI.onMenuCommand('menu:new-thread', () => {
  router.navigate('/threads', { state: { openCreateDialog: true } });
});
```

**Reference:** Architecture.md Section 5.2

---

### 3. Replace Mock Thread Storage with Moku API (1 day)

**New File:** `src-electron/services/thread.service.ts`

**Changes in:**
- [ ] Create `ThreadService` class in main process
- [ ] Replace in-memory Map with Moku API calls
- [ ] Update `thread-handler.ts` to use ThreadService
- [ ] Implement:
  - `getAllThreads()` → GET `/api/threads`
  - `createThread()` → POST `/api/threads`
  - `updateThread()` → PUT `/api/threads/:id`
  - `deleteThread()` → DELETE `/api/threads/:id`

**Remove:**
- [ ] `const threads: Map<string, Thread> = new Map();` from `thread-handler.ts`
- [ ] `initializeSampleData()` function

**Reference:** Architecture.md Section 2.1, 4.2

---

### 4. Add Basic Tests (2 days)

**Create test files:**
```
tests/
  unit/
    stores/
      [ ] auth.store.spec.ts
      [ ] thread.store.spec.ts
    services/
      [ ] electron.service.spec.ts
      [ ] thread.service.spec.ts
  integration/
    ipc/
      [ ] auth-handler.spec.ts
      [ ] thread-handler.spec.ts
  e2e/
    [ ] auth-flow.spec.ts
    [ ] thread-management.spec.ts
```

**Add to package.json:**
```json
"scripts": {
  "test": "vitest",
  "test:e2e": "playwright test"
}
```

**Install dependencies:**
```bash
npm install -D vitest @vitest/ui @testing-library/svelte
```

---

### 5. Write Setup Documentation (0.5 day)

**Create files:**
- [ ] `README.md` - Main project overview
- [ ] `docs/SETUP.md` - Development environment setup
- [ ] `docs/KNOWN-ISSUES.md` - Current limitations
- [ ] `.env.example` - Environment variables template

**README.md should include:**
- Prerequisites (Node.js version, etc.)
- Installation: `npm install`
- Development: `npm run electron:dev`
- Build: `npm run build:prod`
- Package: `npm run package`
- Project structure overview
- Link to architecture.md and coding-instructions.md

---

## 🟡 HIGH PRIORITY - Complete Soon (3-4 days)

### 6. Implement Content Security Policy (0.5 day)
**File:** `src-electron/main.ts`

- [ ] Add CSP headers configuration
```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://api.moku.holokai.com;"
      ]
    }
  });
});
```
- [ ] Test application with strict CSP
- [ ] Document any required CSP exceptions

**Reference:** Architecture.md Section 8.2

---

### 7. Create MokuAPIClient Service (1 day)
**New File:** `src-electron/services/moku-api-client.ts`

- [ ] Create centralized API client class
- [ ] Add automatic token injection in headers
- [ ] Implement request/response interceptors
- [ ] Add retry logic for failed requests
- [ ] Add error handling and logging
- [ ] Refactor `auth.service.ts` to use MokuAPIClient
- [ ] Refactor `thread.service.ts` to use MokuAPIClient

**Example:**
```typescript
export class MokuAPIClient {
  async get(path: string): Promise<any> {
    const token = await this.authService.getAccessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  }
}
```

**Reference:** Architecture.md Section 4.2, Coding Guidelines API Integration

---

### 8. Implement Audit Logging (1 day)
**New File:** `src-electron/services/audit.service.ts`

- [ ] Create AuditService class
- [ ] Define AuditEvent interface
- [ ] Implement `logEvent()` method that POSTs to Moku Audit API
- [ ] Add audit logging for:
  - Application startup/shutdown
  - User login/logout
  - Thread create/update/delete
- [ ] Example usage in auth.service.ts:
```typescript
await auditService.logEvent({
  type: 'USER_LOGIN',
  userId: user.id,
  provider: 'microsoft',
  timestamp: new Date()
});
```

**Reference:** Architecture.md Section 6.1

---

### 9. Rename IPC Handler Files (0.25 day)

- [ ] Rename `auth-handler.ts` → `AuthEventHandler.ts`
- [ ] Rename `thread-handler.ts` → `ThreadsEventHandler.ts`
- [ ] Rename `settings-handler.ts` → `SettingsEventHandler.ts`
- [ ] Rename `system-handler.ts` → `SystemEventHandler.ts`
- [ ] Update all imports in `main.ts`

**Reference:** Coding-instructions.md File Naming section

---

### 10. Replace console.log with electron-log (0.5 day)

**Files to update:**
- [ ] `src-electron/ipc-handlers/thread-handler.ts` (multiple instances)
- [ ] `src-electron/ipc-handlers/system-handler.ts`
- [ ] Any other files using `console.log()`

**Replace:**
```typescript
console.log('[IPC] thread:getAll called');
```

**With:**
```typescript
log.info('[IPC] thread:getAll called');
```

---

## 🟢 MEDIUM PRIORITY - Can Be Deferred (1-2 days)

### 11. Add Error Boundaries (0.5 day)

- [ ] Create global error handler for renderer process
- [ ] Add user-friendly error messages
- [ ] Create error notification component
- [ ] Log all errors to electron-log

---

### 12. Implement Automatic Token Refresh (1 day)

**File:** `src-electron/services/auth.service.ts`

- [ ] Complete `refreshAccessToken()` method
- [ ] Add token expiry checking before each API call
- [ ] Implement automatic refresh when token near expiry
- [ ] Handle refresh failures (force re-authentication)
- [ ] Add tests for token refresh flow

---

### 13. Add Settings UI (1 day)

**New Files:**
- [ ] `src/routes/settings/+page.svelte`

**Features:**
- [ ] Form to configure Moku Web URL
- [ ] Form to configure Moku API URL
- [ ] Theme selector (light/dark)
- [ ] Log level selector
- [ ] Save/Reset buttons
- [ ] Display settings file path

---

## ⚪ LOW PRIORITY - Future Enhancements

### 14. LLM Provider Support (Phase 2)

**Note:** Defer unless required for initial release

- [ ] Implement IChatProvider interface
- [ ] Add ChatService
- [ ] Create provider implementations:
  - ClaudeChatProvider
  - OpenAIChatProvider
  - OllamaChatProvider
- [ ] Message format conversion
- [ ] Token metrics collection

**Reference:** Architecture.md Section 7

---

## Quick Win Items (< 1 hour each)

### Documentation
- [ ] Add comments to complex functions in auth.service.ts
- [ ] Create API_ENDPOINTS.md documenting Moku API contract
- [ ] Add JSDoc comments to all public service methods

### Code Quality
- [ ] Run TypeScript compiler with strict mode
- [ ] Fix any TypeScript errors/warnings
- [ ] Add eslint configuration
- [ ] Run linter and fix issues

### Configuration
- [ ] Create `.env.example` file
- [ ] Document required environment variables
- [ ] Add validation for required settings on startup

---

## Testing Checklist

Before marking items as complete, verify:

### Manual Testing
- [ ] Application starts without errors
- [ ] Can navigate between pages
- [ ] Menu commands work correctly
- [ ] Thread CRUD operations work
- [ ] Authentication flow completes successfully
- [ ] Logging appears in log files

### Code Review
- [ ] All TypeScript errors resolved
- [ ] No console.log statements remain
- [ ] All files follow naming conventions
- [ ] Code follows architecture patterns
- [ ] Sensitive data not logged

### Platform Testing
- [ ] Windows 10/11
- [ ] macOS 12+
- [ ] Linux (Ubuntu 22.04+)

---

## Definition of Done

Each item is considered complete when:

✅ Code is written and tested  
✅ Unit tests added (where applicable)  
✅ TypeScript compiles without errors  
✅ Code reviewed against architecture.md  
✅ Documentation updated  
✅ Manual testing passed  
✅ Committed to version control  

---

## Notes

- Prioritize Critical items first
- High Priority items should be completed before public release
- Medium Priority items improve robustness
- Low Priority items are nice-to-haves

**Estimated Timeline:**
- 2 developers working together: 4.5-6 days for Critical + High Priority
- Single developer: 9-12 days for Critical + High Priority

---

Last Updated: October 27, 2025
