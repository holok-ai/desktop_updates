# Holokai Desktop Development Guidelines

**Version:** 1.0  
**Date:** October 14, 2025

---

## Folder Structure

UI components are organized in `src/ui/` with subfolders: `pages/`, `sidebar/`, and `components/`.

Components implementing a specific feature should be grouped in a feature subfolder like `components/projects/` or `components/threads/`.

IPC event handlers are stored in `electron/ipc/eventHandlers/` with one class per IPC group.

Service classes are stored in `electron/services/` (e.g., `AuthService.ts`, `ThreadService.ts`).

---

## File Naming

Use **PascalCase** for component files: `ThreadList.vue`, `LoginScreen.svelte`.

Use **PascalCase** for class files: `AuthService.ts`, `MokuAPIClient.ts`.

Use **camelCase** for utility files: `logger.ts`, `crypto.ts`.

Use **kebab-case** for CSS files: `design-tokens.css`, `global-styles.css`.

---

## Variable Naming

Use **camelCase** for variables and functions: `activeThread`, `handleLogin()`.

Use **PascalCase** for classes and types: `class ThreadService`, `interface UserProfile`.

Use **SCREAMING_SNAKE_CASE** for constants: `const MAX_RETRIES = 3`, `const API_BASE_URL`.

Prefix boolean variables with `is`, `has`, or `should`: `isLoading`, `hasPermission`, `shouldRetry`.

---

## IPC Organization

Group related IPC calls under a single namespace in the context bridge: `window.electron.auth.*`, `window.electron.threads.*`.

Each IPC group (e.g., `auth`, `threads`, `models`) should have a corresponding event handler class in `electron/ipc/eventHandlers/`.

Event handler classes should be named with the pattern `[Group]EventHandler.ts`: `AuthEventHandler.ts`, `ThreadsEventHandler.ts`.

Register all handlers from a single class in the main IPC setup: `ipcMain.handle('auth:login', () => authEventHandler.handleLogin())`.

---

## Context Bridge Implementation

Define IPC groups in `electron/preload.ts` using the pattern: `auth: { login: () => ipcRenderer.invoke('auth:login') }`.

Each group in the context bridge should map to exactly one event handler class.

Use colon notation for IPC channel names to show grouping: `auth:login`, `threads:create`, `models:list`.

---

## Event Handler Classes

Create one event handler class per IPC group in `electron/ipc/eventHandlers/`.

Event handler classes should receive service dependencies via constructor injection: `constructor(private authService: AuthService)`.

Each handler method should correspond to one IPC channel: `async handleLogin()` for `auth:login`.

Handler methods should delegate business logic to service classes, not implement it directly.

---

## CSS and UI Styling

Use Tailwind utility classes for styling: `class="flex items-center justify-between p-4"`.

Store design tokens in `src/ui/styles/tokens.css` as CSS custom properties: `--color-primary: #3b82f6`.

Reference design tokens in components using CSS variables: `background: var(--color-primary)`.

Keep component-specific styles in scoped style blocks within the component file.

Avoid inline styles except for dynamic values: `:style="{ width: progress + '%' }"`.

---

## Logging

Use `electron-log` for all logging in both main and renderer processes: `import log from 'electron-log'`.

Log levels should be used appropriately: `log.error()` for errors, `log.warn()` for warnings, `log.info()` for general info, `log.debug()` for verbose output.

Always sanitize sensitive data before logging: `log.info('User logged in', { userId: user.id })` (never log tokens or passwords).

**Never write sensitive data to logs**, including API keys, tokens, passwords, personal identifying information, or full request/response bodies containing sensitive fields.

Include context objects for structured logging: `log.error('API call failed', { endpoint, statusCode, error })`.

Log files are automatically managed by electron-log and stored in the OS-specific app data directory.

---

## SSO Service

The `AuthService` in `electron/services/AuthService.ts` handles all OAuth/SSO operations in the main process.

SSO flow uses OAuth 2.0 with PKCE for security: the service generates `code_verifier` and `code_challenge`.

Authentication is initiated via `authService.startOAuthFlow()` which opens the browser for user login.

The custom protocol handler `holokai://callback` intercepts the OAuth redirect and passes the authorization code to `authService.handleCallback()`.

Tokens are stored securely using Electron's `safeStorage` API via `SecureStorageService` in the main process.

Access tokens are refreshed automatically using `authService.refreshAccessToken()` when they expire.

Never store tokens in plain text, log them, or pass them to the renderer process; always use `safeStorage` for encryption.

The renderer process should only receive confirmation of authentication status, not the actual tokens.

---

## Testing

Unit tests are stored in `tests/unit/` mirroring the source structure: `tests/unit/stores/auth.spec.ts`.

Component tests use the framework's testing library: `@testing-library/svelte` or `@vue/test-utils`.

Mock IPC calls in component tests using `vi.stubGlobal('window', { electron: { ... } })`.

Integration tests for IPC handlers are stored in `tests/integration/ipc/`.

E2E tests using Playwright are stored in `tests/e2e/` and test complete user workflows.

Test files should be named with `.spec.ts` or `.test.ts` suffix.

Use descriptive test names that explain the behavior: `it('should create thread when user clicks new thread button')`.

---

## API Integration

All external API calls to Moku API should go through `MokuAPIClient` service class.

The API client should use Axios with interceptors for authentication: `config.headers.Authorization = Bearer ${token}`.

API errors should be handled gracefully and logged: `catch (error) { log.error('API call failed', error); throw new Error('User-friendly message'); }`.

Never make API calls directly from UI components; always use service classes.

---

## State Management

Use the framework's built-in state solution: Svelte stores or Pinia (Vue).

Store files should be named by domain: `authStore.ts`, `threadsStore.ts`, `modelsStore.ts`.

Keep stores focused on a single domain/feature for better maintainability.

Avoid storing derived data in stores; use computed/derived values instead.

---

## Error Handling

Always wrap IPC calls in try-catch blocks in the renderer process.

Display user-friendly error messages in the UI, not technical error details.

**Never include sensitive data in error messages** displayed to users or passed between processes.

Log technical error details using `electron-log` for debugging: `log.error('Failed to load threads', error)`.

Use error boundaries or error handling middleware to catch unhandled errors.

---

## Security

**Sensitive data should be handled in the main process (worker process), not the renderer process** whenever possible.

API keys, tokens, and credentials should never be stored in or pass through the renderer process.

Use the context bridge to expose only the minimum necessary functionality to the renderer.

All credential storage must use `safeStorage` API for encryption.

The renderer process should never directly access sensitive data; request it via IPC when needed.

Validate and sanitize all data passed through IPC channels in the main process.

---

## Code Organization Principles

Keep business logic in service classes, not in components or IPC handlers.

Components should only handle presentation and user interaction.

Service classes should be framework-agnostic and testable without UI.

Use dependency injection for services to enable easy testing and mocking.