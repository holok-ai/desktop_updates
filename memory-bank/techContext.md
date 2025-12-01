# Tech Context

Primary stack

- Electron (main process in TypeScript)
- Svelte 5 renderer (TypeScript)
- Vite build for renderer, tsconfigs for Electron/preload

Testing & tooling

- Unit: Vitest
- E2E: Playwright
- Linting: ESLint with project custom plugin (`eslint-plugin-holokai`)

Dependencies & constraints

- No local DB; persistence via Moku or in-memory services for tests.
- Keep contextIsolation enabled; use `safeStorage` for secure token storage.
- New mock TitleGeneratorService added at `src-electron/services/title-generator.service.ts` to support auto-title when backend API is not available.
- Preload exposes new thread events (`thread:titleGenerationStarted` / `thread:titleGenerationFinished`) for renderer to display in-progress UI.
