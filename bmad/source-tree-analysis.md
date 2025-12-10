# Source Tree Analysis

## Project Root Structure

```
holokai-desktop/
├── .claude/                    # Claude AI configuration
├── .github/                    # GitHub configuration
│   └── workflows/              # CI/CD pipelines
├── .vscode/                    # VS Code settings
├── ai/                         # AI-generated documentation
│   └── analysis/               # Design analysis & comparisons
├── eslint-plugin-holokai/      # Custom ESLint rules
├── scripts/                    # Build & utility scripts
├── security-reports/           # Security scan outputs
├── src/                        # 🎯 Svelte frontend (Renderer)
├── src-electron/               # 🎯 Electron main process
├── src-shared/                 # 🎯 Shared types & constants
├── tests/                      # Test suites
├── dist/                       # Built frontend (gitignored)
├── dist-electron/              # Built electron (gitignored)
├── node_modules/               # Dependencies (gitignored)
├── package.json                # Project manifest
├── tsconfig.json               # TypeScript config (renderer)
├── tsconfig.electron.json      # TypeScript config (main)
├── vite.config.ts              # Vite build config
├── tailwind.config.js          # TailwindCSS config
├── eslint.config.js            # ESLint config
└── playwright.config.ts        # E2E test config
```

## Source Directory Deep Dive

### Frontend Source (`src/`)

**Entry Points:**
- `main.ts` - Application bootstrap
- `App.svelte` - Root component
- `app.css` - Global styles

```
src/
├── main.ts                     # 📍 Entry point - mounts App.svelte
├── App.svelte                  # 📍 Root component with Router
├── app.css                     # Global TailwindCSS styles
├── assets/
│   └── images/                 # Static image assets
├── routes/                     # 📍 Page components (SPA routes)
│   ├── +page.svelte            # Home/Dashboard
│   ├── login/+page.svelte      # Login page
│   ├── threads/+page.svelte    # Thread list & chat
│   ├── projects/+page.svelte   # Project management
│   └── settings/+page.svelte   # App settings
└── lib/                        # Shared library code
    ├── components/             # UI components
    │   ├── layout/             # App shell (Sidebar, Header, etc.)
    │   ├── common/             # Reusable components
    │   ├── modals/             # Dialog components
    │   ├── projects/           # Project-specific
    │   ├── threads/            # Thread-specific
    │   └── *.svelte            # Feature components
    ├── constants/              # App constants
    │   ├── app.constant.ts     # General constants
    │   ├── route.constant.ts   # Route paths
    │   ├── sidebar.constant.ts # Sidebar config
    │   └── status.constant.ts  # Status enums
    ├── router/
    │   └── routes.ts           # Route definitions
    ├── services/               # 📍 IPC service wrappers
    │   ├── electron.service.ts # Main electron bridge
    │   ├── thread.service.ts   # Thread operations
    │   ├── project.service.ts  # Project operations
    │   ├── storage.service.ts  # Local storage
    │   ├── theme.service.ts    # Theme management
    │   └── *.service.ts        # Other services
    ├── stores/                 # 📍 Svelte stores (state)
    │   ├── auth.store.ts       # Auth state
    │   ├── thread.store.ts     # Thread list
    │   ├── project.store.ts    # Project list
    │   └── *.store.ts          # Other stores
    ├── types/                  # TypeScript types
    │   ├── app.type.ts         # Core types
    │   ├── thread.type.ts      # Thread types
    │   ├── project.type.ts     # Project types
    │   └── *.type.ts           # Other types
    └── utils/
        └── apiWrapper.ts       # API utilities
```

### Electron Main Process (`src-electron/`)

**Entry Points:**
- `main.ts` - Electron main entry
- `preload.ts` - Context bridge (IPC API)

```
src-electron/
├── main.ts                     # 📍 Electron app entry point
├── preload.ts                  # 📍 Context bridge (window.electronAPI)
├── package.json                # ESM marker for electron
├── ipc-handlers/               # 📍 IPC request handlers
│   ├── auth-handler.ts         # Auth IPC
│   ├── chat-handler.ts         # Chat IPC
│   ├── thread-handler.ts       # Thread IPC
│   ├── project-handler.ts      # Project IPC
│   ├── file-handler.ts         # File IPC
│   ├── settings-handler.ts     # Settings IPC
│   ├── models-handler.ts       # Models IPC
│   └── system-handler.ts       # System IPC
├── repository/                 # Data access layer
│   ├── thread-repository.ts    # Thread persistence
│   └── project-repository.ts   # Project persistence
├── services/                   # Business logic
│   ├── auth.service.ts         # Authentication
│   ├── settings.service.ts     # App settings
│   ├── moku.service.ts         # Moku API client
│   ├── title-generator.service.ts  # Auto title generation
│   ├── title-validation.service.ts # Title validation
│   ├── file-*.service.ts       # File handling (5 services)
│   └── chat/                   # 📍 Chat subsystem
│       ├── ChatService.ts      # Main chat orchestrator
│       ├── ChatApiService.ts   # API integration
│       ├── interfaces/         # Chat interfaces
│       │   ├── IChatProvider.ts
│       │   └── ChatMessage.ts
│       ├── factories/
│       │   └── ChatProviderFactory.ts  # Provider factory
│       ├── providers/          # 📍 LLM providers
│       │   ├── ClaudeChatProvider.ts
│       │   ├── OpenAIChatProvider.ts
│       │   └── OllamaChatProvider.ts
│       ├── converters/         # Request/response converters
│       │   ├── ChatRequestConverter.ts
│       │   ├── ClaudeConverter.ts
│       │   ├── OpenAIConverter.ts
│       │   └── OllamaConverter.ts
│       └── audit/              # Token auditing
│           ├── AuditService.ts
│           ├── AuditTypes.ts
│           ├── TokenAccumulator.ts
│           └── TokenCounters.ts
└── utils/
    └── logger.ts               # Logging utility
```

### Shared Code (`src-shared/`)

```
src-shared/
├── constants/                  # Shared constants
└── types/
    └── attachment.types.ts     # File attachment types
```

### Test Structure (`tests/`)

```
tests/
├── e2e/                        # End-to-end tests (Playwright)
├── fixtures/                   # Test fixtures
├── integration/                # Integration tests
│   ├── ipc/                    # IPC integration
│   └── main/                   # Main process integration
├── setup/                      # Test setup files
└── unit/                       # Unit tests (Vitest)
    ├── audit/                  # Audit service tests
    ├── components/             # Component tests
    ├── converters/             # Converter tests
    ├── factories/              # Factory tests
    ├── interfaces/             # Interface tests
    ├── ipc/                    # IPC handler tests
    ├── lib/                    # Lib utility tests
    ├── main/                   # Main process tests
    ├── providers/              # Provider tests
    ├── repository/             # Repository tests
    ├── services/               # Service tests
    ├── stores/                 # Store tests
    ├── types/                  # Type tests
    └── utils/                  # Utility tests
```

## Critical Folders Summary

| Folder | Purpose | File Count |
|--------|---------|------------|
| `src/lib/components/` | UI components | ~27 |
| `src/lib/services/` | IPC wrappers | 9 |
| `src/lib/stores/` | State management | 5 |
| `src-electron/ipc-handlers/` | IPC handlers | 8 |
| `src-electron/services/` | Business logic | ~20 |
| `src-electron/services/chat/` | Chat subsystem | 15 |
| `tests/` | All test files | 40+ |

## Key Entry Points

| File | Purpose |
|------|---------|
| `src/main.ts` | Frontend bootstrap |
| `src/App.svelte` | Root UI component |
| `src-electron/main.ts` | Electron main process |
| `src-electron/preload.ts` | IPC Context Bridge |

## Path Aliases

Configured in `tsconfig.json`:
- `$lib/*` → `./src/lib/*`
- `$shared/*` → `./src-shared/*`
