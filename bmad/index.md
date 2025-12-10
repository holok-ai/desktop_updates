# Holokai Desktop - Project Documentation Index

> **Project Documentation Hub** for Holokai Desktop Application
>
> Last Updated: 2025-11-25 | Phase: 2.0 Development

## Project Overview

| Attribute | Value |
|-----------|-------|
| **Project Name** | Holokai Desktop |
| **Type** | Desktop Application (Electron) |
| **Repository** | Monolith |
| **Primary Language** | TypeScript |
| **UI Framework** | Svelte 5 |
| **Architecture** | Multi-process (Main + Renderer) |
| **Current Phase** | Phase 2 - Collaboration & Workflows |

### Quick Reference

- **Tech Stack:** Electron 39 + Svelte 5 + TypeScript 5 + Vite 7
- **Entry Points:** `src/main.ts` (renderer), `src-electron/main.ts` (main process)
- **State Management:** Svelte writable stores
- **Data Storage:** electron-store (local JSON)
- **AI Providers:** Claude, OpenAI, Ollama

---

## Phase 2 Documentation (2025-11-25)

### Document Abbreviation Key

Used for requirement traceability in [Epics and Stories](./epics-and-stories-2025-11-25.md):

| Abbr | Document | Category |
|------|----------|----------|
| **TM** | [Thread Management](./thread-management-requirements-2025-11-25.md) | Requirements |
| **TLC** | [Thread Loading & Caching](./thread-loading-caching-requirements-2025-11-25.md) | Requirements |
| **PROJ** | [Project Requirements](./project-requirements-2025-11-25.md) | Requirements |
| **CORE** | [Desktop Core](./desktop-core-requirements-2025-11-25.md) | Requirements |
| **UI** | [UI/UX Requirements](./ui-ux-requirements-2025-11-25.md) | Requirements |
| **INS** | [Insights Requirements](./insights-requirements-2025-11-25.md) | Requirements |
| **ARCH** | [Architecture](./architecture-2025-11-25.md) | Technical Spec |
| **API** | [Moku API Specification](./moku-api-specification-2025-11-25.md) | Technical Spec |
| **DB** | [Database Schema](./database-schema-2025-11-25.md) | Technical Spec |
| **WF** | [Workflow Templates](./brainstorming-session-workflow-templates-2025-11-25.md) | Brainstorming |
| **FS** | [File Storage](./brainstorming-session-file-storage-2025-11-25.md) | Brainstorming |

### Product Requirements

| Document | Description | Status |
|----------|-------------|--------|
| [PRD - Desktop Phase 2](./prd-desktop-phase2-2025-11-25.md) | Complete product requirements document | Draft |
| [Epics and Stories](./epics-and-stories-2025-11-25.md) | Epic breakdown, stories, team assignments | Active |

### Requirements Specifications

| Document | Description | Priority |
|----------|-------------|----------|
| [Thread Management](./thread-management-requirements-2025-11-25.md) | Branching, retry, auto-title, clipboard | P0 |
| [Thread Loading & Caching](./thread-loading-caching-requirements-2025-11-25.md) | Cache architecture, TTL, LRU eviction | P0 |
| [Project Requirements](./project-requirements-2025-11-25.md) | Collaboration, roles, file storage | P0 |
| [Desktop Core](./desktop-core-requirements-2025-11-25.md) | Notifications, state, deep links | P0 |
| [UI/UX Requirements](./ui-ux-requirements-2025-11-25.md) | Menu, tray, shortcuts, accessibility | P1 |
| [Insights Requirements](./insights-requirements-2025-11-25.md) | Dashboard, activity, reports | P1 |

### Technical Specifications

| Document | Description |
|----------|-------------|
| [Architecture (Phase 2)](./architecture-2025-11-25.md) | System architecture, IPC API, data model |
| [Moku API Specification](./moku-api-specification-2025-11-25.md) | Complete REST API endpoints |
| [Database Schema](./database-schema-2025-11-25.md) | PostgreSQL tables, migrations, views |

### Brainstorming Sessions

| Document | Description |
|----------|-------------|
| [Tool Orchestrator](./brainstorming-session-results-2025-11-25.md) | Tool orchestration architecture |
| [File Storage](./brainstorming-session-file-storage-2025-11-25.md) | Storage Service integration |
| [Workflow Templates](./brainstorming-session-workflow-templates-2025-11-25.md) | Workflow model and execution |

---

## Phase 1 Documentation (Existing)

### Core Architecture

- [Architecture Overview](./architecture.md) - System design, patterns, technology stack
- [Source Tree Analysis](./source-tree-analysis.md) - Directory structure and file organization
- [IPC API Reference](./ipc-api.md) - Inter-process communication API

### Frontend Documentation

- [Component Inventory](./component-inventory.md) - UI components catalog
- [State Management](./state-management.md) - Svelte stores and data flow

### Development

- [Development Guide](./development-guide.md) - Setup, scripts, workflow

---

## Existing Project Documentation

Located in `/mnt/c/Projects/repos/holokai/desktop/ai/`:

### Architecture & Design

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/ARCHITECTURE.md) | Complete system architecture |
| [desktop-system-architecture.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/desktop-system-architecture.md) | Detailed system design |
| [dual-sidebar-design-guide.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/dual-sidebar-design-guide.md) | UI layout design |

### Developer Resources

| Document | Description |
|----------|-------------|
| [DEVELOPER-README.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/DEVELOPER-README.md) | Developer onboarding |
| [coding-instructions.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/coding-instructions.md) | Coding standards |
| [PROCESS.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/PROCESS.md) | Development process |

### API Documentation

| Document | Description |
|----------|-------------|
| [MOKU-API-FOR-DESKTOP.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/MOKU-API-FOR-DESKTOP.md) | Moku API integration |
| [thread-methods.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/thread-methods.md) | Thread API methods |
| [chat-configuration.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/chat-configuration.md) | Chat configuration |

### Feature Documentation

| Document | Description |
|----------|-------------|
| [FILE-TOOLS-INTEGRATION.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/FILE-TOOLS-INTEGRATION.md) | File handling |
| [PROJECTS-FEATURE-SUMMARY.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/PROJECTS-FEATURE-SUMMARY.md) | Projects feature |
| [PROJECT-MANAGEMENT-IMPLEMENTATION.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/PROJECT-MANAGEMENT-IMPLEMENTATION.md) | Project management |
| [LOGGING-IMPLEMENTATION.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/LOGGING-IMPLEMENTATION.md) | Logging system |
| [MARKDOWN-RENDERING-IMPLEMENTATION.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/MARKDOWN-RENDERING-IMPLEMENTATION.md) | Markdown rendering |
| [OPTIMISTIC-RENDERING.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/OPTIMISTIC-RENDERING.md) | Optimistic UI |
| [FEATURE-PROMPT-EDIT-REGENERATE.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/FEATURE-PROMPT-EDIT-REGENERATE.md) | Prompt editing |
| [INLINE-EDIT-SUMMARY.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/INLINE-EDIT-SUMMARY.md) | Inline editing |

### Authentication

| Document | Description |
|----------|-------------|
| [REVISED-SSO.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/REVISED-SSO.md) | SSO implementation |

### Analysis & Comparisons

Located in `/mnt/c/Projects/repos/holokai/desktop/ai/analysis/`:

| Document | Description |
|----------|-------------|
| [context-management.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/analysis/context-management.md) | Context management analysis |
| [ACTION_ITEMS.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/analysis/ACTION_ITEMS.md) | Action items |
| [OPTIONS-COMPARISON-sso.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/analysis/OPTIONS-COMPARISON-sso.md) | SSO options comparison |
| [OPTIONS-COMPARISON-ui-frameworks.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/analysis/OPTIONS-COMPARISON-ui-frameworks.md) | UI framework comparison |
| [svelte-desktop-design.md](file:///mnt/c/Projects/repos/holokai/desktop/ai/analysis/svelte-desktop-design.md) | Svelte design analysis |

### Root Documentation

| Document | Location |
|----------|----------|
| [README.md](file:///mnt/c/Projects/repos/holokai/desktop/README.md) | Project overview |
| [QUICK_START.md](file:///mnt/c/Projects/repos/holokai/desktop/QUICK_START.md) | Quick start guide |
| [ESLINT-SETUP.md](file:///mnt/c/Projects/repos/holokai/desktop/ESLINT-SETUP.md) | ESLint configuration |

---

## Getting Started

### For New Developers

1. Read the [Development Guide](./development-guide.md)
2. Review the [Architecture Overview](./architecture.md)
3. Explore the [Source Tree Analysis](./source-tree-analysis.md)

### For Feature Development

1. Check [Component Inventory](./component-inventory.md) for existing UI components
2. Review [IPC API Reference](./ipc-api.md) for available APIs
3. Understand [State Management](./state-management.md) patterns

### For AI-Assisted Development (PRD/Architecture)

When creating a brownfield PRD or feature specification:

1. Reference this index as the primary context source
2. Include relevant architecture docs for technical context
3. Link to specific feature docs for domain context

---

## Document Statistics

| Metric | Value |
|--------|-------|
| Phase 2 Documents | 13 |
| Phase 1 Documents | 6 |
| Existing Documentation | 30 files |
| Total Documentation | ~800KB |
| Last Updated | 2025-11-25 |

### Phase 2 Document Summary

| Category | Count | Documents |
|----------|-------|-----------|
| PRD & Planning | 2 | Product requirements, epics/stories |
| Requirements | 6 | Thread, project, cache, core, UI, insights |
| Technical Specs | 3 | Architecture, API, database |
| Brainstorming | 3 | Tools, files, workflows |

---

## Codebase Location

- **Project Root:** `/mnt/c/Projects/repos/holokai/desktop`
- **Documentation Output:** `/mnt/c/Projects/repos/holokai/bmad/desktop-project/docs`
- **Existing AI Docs:** `/mnt/c/Projects/repos/holokai/desktop/ai/`
