# Project Brief

Holokai Desktop — a Svelte + Electron desktop client for Moku-backed AI workflows.

Purpose

- Provide a secure, performant desktop UI for composing, running, and managing AI threads and models.

Scope

- Desktop app built with Electron main process + Svelte 5 renderer.
- In-memory services used for local workflows (Threads, Models) with optional Moku API client integration.
- No local DB; persistence is via Moku (or in-memory for tests/e2e).

Primary Goals

- Secure token handling via safeStorage / context-bridged IPC.
- Fast developer feedback loop with Vitest unit tests and Playwright E2E.
