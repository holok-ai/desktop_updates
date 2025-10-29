# Holokai Desktop Development Guidelines

**Version:** 1.0  
**Date:** October 14, 2025

---

## Branch Naming

Branches should follow this syntax:

{last name}/FEATURE-{story id}-{short-title}
{last name}/FIX-{issue id}-{short-title}

Example:
baxter/FEATURE-1-implement-chat-input-editting
baxter/FIX-2-correct-issue-with-logfile-name

## Folder Structure

UI components are organized in `src/ui/` with subfolders: `pages/`, `sidebar/`, and `components/`.

Components implementing a specific feature should be grouped in a feature subfolder like `components/projects/` or `components/threads/`.

IPC event handlers are stored in `src-electron/ipc/eventHandlers/` with one class per IPC group.

Service classes are stored in `src-electron/services/` (e.g., `AuthService.ts`, `ThreadService.ts`).

---

## File Naming

Use **PascalCase** for Svelte component files: `ThreadList.svelte`, `ModelSelector.svelte`.

Use **PascalCase** for class files: `AuthService.ts`, `MokuAPIClient.ts`.

Use **camelCase** for utility files: `logger.ts`, `crypto.ts`.

Use **kebab-case** for CSS files: `design-tokens.css`, `global-styles.css`.

---

## Variable Naming

Use **camelCase** for variables and functions: `activeThread`, `handleLogin()`.

Use **PascalCase** for classes and types: `class ThreadService`, `interface UserProfile`.

Use **SCREAMING_SNAKE_CASE** for constants: `const MAX_RETRIES = 3`, `const API_BASE_URL`.

Prefix boolean variables with `is`, `has`, or `should`: `isLoading`, `hasPermission`, `shouldRetry`.

## Class Naming

When defining classes and data models, follow these rules to keep naming consistent:

- **ID fields**: Use `UUID` for any `id` fields. At runtime an `id` is a string, but the canonical type should be `UUID` and IDs should be generated using a secure UUID generator (e.g. `crypto.randomUUID()` in Node). Avoid custom sequential schemes unless explicitly required and namespaced (use prefixes only when necessary).
- **Title / Name**: The human-readable name of an entity should be stored in a `title` field (not `name`). Use `title: string` at the top level of model interfaces and mirror it in `metadata.title` when present. This keeps UI expectations consistent (e.g., list headers, card titles).

Example:

```ts
interface Thread {
  id: UUID;        // stable unique id
  title: string;   // human-friendly name shown in UI
  metadata: { title?: string; description?: string }
}
```

These conventions ensure IDs are globally unique and display names are found in a predictable `title` field across models.

---

## IPC Organization

Group related IPC calls under a single namespace in the context bridge: `window.electron.auth.*`, `window.electron.threads.*`.

Each IPC group (e.g., `auth`, `threads`, `models`) should have a corresponding event handler class in `electron/ipc/eventHandlers/`.

Event handler classes should be named with the pattern `[Group]EventHandler.ts`: `AuthEventHandler.ts`, `ThreadsEventHandler.ts`.

**Service wrappers** are thin TypeScript services that wrap a single IPC domain with one method per IPC call for simple CRUD operations.

**Facades** orchestrate multiple service wrappers to handle complex multi-step workflows with coordinated error recovery.

Register all handlers from a single class in the main IPC setup: `ipcMain.handle('auth:login', () => authEventHandler.handleLogin())`.

---

## Context Bridge Implementation

Define IPC groups in `src-electron/preload.ts` using the pattern: `auth: { login: () => ipcRenderer.invoke('auth:login') }`.

Each group in the context bridge should map to exactly one event handler class.

Use colon notation for IPC channel names to show grouping: `auth:login`, `threads:create`, `models:list`.

---

## Event Handler Classes

Create one event handler class per IPC group in `src-electron/ipc/eventHandlers/`.

Event handler classes should receive service dependencies via constructor injection: `constructor(private authService: AuthService)`.

Each handler method should correspond to one IPC channel: `async handleLogin()` for `auth:login`.

Handler methods should delegate business logic to service classes, not implement it directly.

---

## CSS and UI Styling

Use Tailwind utility classes for styling: `class="flex items-center justify-between p-4"`.

Store design tokens in `src/ui/styles/tokens.css` as CSS custom properties: `--color-primary: #3b82f6`.

Reference design tokens in components using CSS variables: `background: var(--color-primary)`.

Keep component-specific styles in scoped style blocks within the component file.

Avoid inline styles except for dynamic values that must be computed at runtime.

---

## Logging

Use `electron-log` for all logging in both main and renderer processes: `import log from 'electron-log'`.

**Auditing:** Write events to the Holokai Audit Q for user actions including authentication, chat activities, thread management, and application lifecycle events.

Log levels should be used appropriately: `log.error()` for errors, `log.warn()` for warnings, `log.info()` for general info, `log.debug()` for verbose output.

Always sanitize sensitive data before logging: `log.info('User logged in', { userId: user.id })` (never log tokens or passwords).

**Never write sensitive data to logs**, including API keys, tokens, passwords, personal identifying information, or full request/response bodies containing sensitive fields.

Include context objects for structured logging: `log.error('API call failed', { endpoint, statusCode, error })`.

Log files are automatically managed by electron-log and stored in the OS-specific app data directory.

---

## SSO Service

The `AuthService` in `src-electron/services/AuthService.ts` handles all OAuth/SSO operations in the main process.

SSO flow uses OAuth 2.0 with PKCE for security: the service generates `code_verifier` and `code_challenge`.

Authentication is initiated via `authService.startOAuthFlow()` which opens the browser for user login.

The custom protocol handler `holokai://callback` intercepts the OAuth redirect and passes the authorization code to `authService.handleCallback()`.

Tokens are stored securely using Electron's `safeStorage` API via `SecureStorageService` in the main process.

Access tokens are refreshed automatically using `authService.refreshAccessToken()` when they expire.

Never store tokens in plain text, log them, or pass them to the renderer process; always use `safeStorage` for encryption.

Desktop SSO relies on the Holokai Moku web SSO for OAuth providers and authentication handshake.

The renderer process should only receive confirmation of authentication status, not the actual tokens.

---

## Testing

Unit tests are stored in `tests/unit/` mirroring the source structure: `tests/unit/stores/auth.store.spec.ts`.

Component tests use Svelte Testing Library with Vitest.

Mock IPC calls in component tests using Vitest spies on `window.electronAPI` methods.

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

Use Svelte stores for state management.

Store files should be named by domain: `auth.store.ts`, `threads.store.ts`, `models.store.ts`.

Use Svelte's built-in store types: `writable()`, `readable()`, and `derived()`.

Keep stores focused on a single domain/feature for better maintainability.

Avoid storing derived data in stores; use derived stores for computed values.

---

## Error Handling

Always wrap IPC calls in try-catch blocks in the renderer process.

Display user-friendly error messages in the UI, not technical error details.

**Never include sensitive data in error messages** displayed to users or passed between processes.

Log technical error details using `electron-log` for debugging: `log.error('Failed to load threads', error)`.

Use error boundaries or error handling middleware to catch unhandled errors.

---

## Security

**Sensitive data should be handled in the main process, not the renderer process** whenever possible.

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

---

## Svelte-Specific Guidelines

### Component Structure

Svelte components are single-file components with `<script>`, `<template>`, and `<style>` sections.

Use `<script lang="ts">` for TypeScript support in components.

Export component props using `export let propName: Type`.

Keep component logic in the script section and avoid complex expressions in markup.

Use lifecycle functions when needed: `onMount()`, `onDestroy()`, `beforeUpdate()`, `afterUpdate()`.

### Reactivity

Svelte's reactivity is built-in: variables are reactive by default when reassigned.

Use reactive declarations for derived values: `$: derivedValue = sourceValue * 2`.

Use reactive statements for side effects: `$: if (condition) { doSomething(); }`.

Subscribe to stores using the `$` prefix: `$authStore.user` automatically subscribes and unsubscribes.

### Store Usage

Create writable stores: `export const user = writable<User | null>(null)`.

Create readable stores for values controlled internally: `export const time = readable(new Date(), set => {...})`.

Create derived stores for computed values: `export const fullName = derived([firstName, lastName], ([$first, $last]) => $first + ' ' + $last)`.

Update stores using `set()` or `update()`: `user.set(newUser)` or `user.update(u => ({ ...u, name: 'New Name' }))`.

Custom stores can add methods: Return an object with `subscribe`, `set`, and custom methods.

### Template Syntax

Use Svelte directives: `{#if}`, `{#each}`, `{#await}` for control flow.

Bind properties with `:` shorthand: `<input bind:value={name}>` or `<input bind:value>`.

Handle events with `on:` directive: `<button on:click={handleClick}>`.

Use two-way binding with `bind:`: `<input bind:value={text}>`.

Apply conditional classes: `<div class:active={isActive}>` or `<div class={isActive ? 'active' : ''}>`.

### Component Communication

Pass data down via props: `<Child propName={value} />`.

Emit events up using `createEventDispatcher()` or callback props.

Use context API for deeply nested data: `setContext()` and `getContext()`.

Share state across components using stores imported from store files.

### Styling

Component styles are scoped by default; no need for CSS modules or scoped attributes.

Use `:global()` selector for global styles within a component: `:global(body) { margin: 0; }`.

Apply dynamic styles with style directive: `<div style:color={textColor}>`.

Combine Tailwind utility classes with component-scoped styles as needed.

### Performance

Use `{#key}` blocks to force re-rendering when values change: `{#key value}{/key}`.

Implement virtual scrolling for large lists using libraries like `svelte-virtual`.

Lazy load components dynamically using `import()`: `const Component = await import('./Component.svelte')`.

Use `tick()` to await DOM updates: `await tick()`.

Optimize list rendering with `{#each}` by providing a key: `{#each items as item (item.id)}`.

### Type Safety

Define prop types using TypeScript: `export let user: User`.

Create type definitions in `src/lib/types/` for shared interfaces.

Use strict TypeScript configuration: `"strict": true` in `tsconfig.json`.

Avoid `any` type; use proper types or `unknown` with type guards.

Use generic types for reusable components: `<script lang="ts" generics="T extends Record<string, any>">`.

### Transitions and Animations

Use built-in transitions: `import { fade, slide, fly } from 'svelte/transition'`.

Apply transitions to elements: `<div transition:fade>`.

Use easing functions from `svelte/easing` for smooth animations.

Create custom transitions for specialized animation needs.

### Actions

Use actions for DOM element behavior: `<div use:tooltip={'text'}>`.

Define actions as functions: `function action(node, parameters) { return { update, destroy }; }`.

Actions are useful for third-party library integration and DOM manipulation.
