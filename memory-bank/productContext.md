# Product Context

Why this exists

- Provide a native-feeling desktop client for AI-assisted workflows that integrates with Moku APIs and local UX patterns.

Problems solved

- Centralizes thread and model management for complex conversations.
- Simplifies secure authentication for desktop environments (exchange-code flow via holokai:// callback).

User experience goals

- Lightweight, responsive UI using Svelte 5 signals and stores.
- Menu-agnostic components suitable for different window sizes and dual-sidebar layouts.
- Predictable thread lifecycle and persistence semantics (UUID ids, `title` as display name).
