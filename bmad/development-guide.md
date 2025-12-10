# Development Guide

## Prerequisites

- **Node.js** 18+ and npm
- **Windows, macOS, or Linux** with GUI support
- **Git** for version control

### WSL Users (Important)

Electron is a GUI application and requires native Windows support. If using WSL:

1. **Recommended:** Use Windows Terminal with PowerShell or CMD (not WSL bash)
2. **Alternative:** Install GUI support in WSL2 (Windows 11 or recent Windows 10 with WSLg)

## Quick Start

```bash
# Clone and install
cd /path/to/holokai/desktop
npm install

# Development (two terminal approach - recommended)
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Build and run Electron
npm run build:electron
npm run electron

# OR: Automated watch mode (single terminal)
npm run electron:dev
```

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (browser mode, port 5177) |
| `npm run electron` | Run Electron (requires prior build) |
| `npm run electron:dev` | Development with hot reload |
| `npm run electron:watch` | Watch mode for electron changes |
| `npm run build:electron` | Build Electron main process only |

### Building

| Command | Description |
|---------|-------------|
| `npm run build` | Build Svelte frontend |
| `npm run build:prod` | Build both Svelte and Electron |
| `npm run package` | Create distributable packages |
| `npm run preview` | Preview production build |

### Code Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format with Prettier |
| `npm run check` | Run Svelte type checking |
| `npm run type-check` | Run TypeScript check |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run Vitest unit tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:spec` | Run specific E2E spec |

### Security

| Command | Description |
|---------|-------------|
| `npm run security` | Run security scan script |
| `npm run security:all` | Run all security checks |
| `npm run security:audit` | Better npm audit |
| `npm run security:snyk` | Snyk vulnerability scan |
| `npm run security:deps` | npm audit |
| `npm run security:secrets` | Secretlint scan |
| `npm run security:lockfile` | Lockfile lint |
| `npm run security:sbom` | Generate SBOM |

## Project Configuration

### TypeScript

Two TypeScript configurations:

1. **`tsconfig.json`** - Renderer process (Svelte)
   - Target: ES2022
   - Module resolution: bundler
   - Includes: `src/**`, `src-shared/**`

2. **`tsconfig.electron.json`** - Main process (Electron)
   - Target: ES2022
   - Module resolution: NodeNext
   - Output: `dist-electron/`
   - Includes: `src-electron/**`, `src-shared/**`

### Path Aliases

```typescript
// Available in both configs
$lib/*    → ./src/lib/*
$shared/* → ./src-shared/*
```

### Vite Configuration

- Dev server port: 5177
- Output: `dist/`
- Base: `./` (relative paths for Electron)

### ESLint

Extended configuration with:
- TypeScript ESLint
- Svelte ESLint
- Security plugins (eslint-plugin-security, no-secrets, no-unsanitized)
- SonarJS for code quality
- Custom holokai plugin

### Tailwind CSS

- Dark mode: `selector` strategy
- Content: `./src/**/*.{html,js,svelte,ts}`

## Development Workflow

### Adding a New Feature

1. **Define IPC API** in `src-electron/preload.ts`
   - Add interface methods
   - Expose via contextBridge

2. **Create IPC Handler** in `src-electron/ipc-handlers/`
   - Handle IPC invoke/send
   - Register in `main.ts`

3. **Create Service** (if needed) in `src-electron/services/`
   - Business logic
   - External API integration

4. **Create Renderer Service** in `src/lib/services/`
   - Wrapper around `window.electronAPI`
   - TypeScript types

5. **Create Store** (if needed) in `src/lib/stores/`
   - Svelte writable store
   - Subscribe to IPC events

6. **Build Components** in `src/lib/components/`
   - Svelte components
   - Use stores and services

7. **Add Route** (if needed) in `src/routes/`
   - Page component
   - Update `routes.ts`

### Code Style

Follow `ai/coding-instructions.md`:

- File naming: kebab-case for files, PascalCase for components
- IPC channels: `domain:action` format
- Services: Singleton pattern with typed interfaces
- Stores: Custom store factory pattern
- Components: Single responsibility, props typed

### Security Checklist

- [ ] No `nodeIntegration: true`
- [ ] Context isolation enabled
- [ ] All IPC inputs validated
- [ ] No secrets in renderer
- [ ] Use `safeStorage` for sensitive data
- [ ] CSP configured
- [ ] HTTPS for all external calls

## Testing Strategy

### Unit Tests (Vitest)

Location: `tests/unit/`

```typescript
// Example: tests/unit/stores/thread.store.test.ts
import { describe, it, expect } from 'vitest';
import { threads } from '$lib/stores/thread.store';

describe('thread store', () => {
  it('should add thread', () => {
    // ...
  });
});
```

### Integration Tests

Location: `tests/integration/`

- IPC integration: `tests/integration/ipc/`
- Main process: `tests/integration/main/`

### E2E Tests (Playwright)

Location: `tests/e2e/`

```typescript
// Example: tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  // ...
});
```

### Test Setup

- Global setup: `tests/setup/test-setup.ts`
- Fixtures: `tests/fixtures/`
- Mocks `window.electronAPI` for renderer tests

## Debugging

### Renderer Process

1. Open DevTools: `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac)
2. Use console, network, elements tabs
3. Svelte DevTools extension recommended

### Main Process

1. Use `electron-log` for logging
2. Check logs in:
   - Windows: `%USERPROFILE%\AppData\Roaming\holokai-desktop\logs`
   - macOS: `~/Library/Logs/holokai-desktop`
   - Linux: `~/.config/holokai-desktop/logs`

### VS Code Launch Config

```json
{
  "type": "node",
  "request": "launch",
  "name": "Electron Main",
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
  "args": ["."],
  "cwd": "${workspaceFolder}"
}
```

## Building for Distribution

### Development Build

```bash
npm run build:prod
```

### Production Package

```bash
npm run package
```

Outputs to `release/` directory:
- Windows: NSIS installer
- macOS: DMG
- Linux: AppImage

### Build Configuration

See `package.json` → `build` section for electron-builder config.

## Troubleshooting

### Common Issues

1. **Electron won't start in WSL**
   - Use native Windows terminal
   - Or install WSLg support

2. **IPC not working**
   - Check preload script compiled
   - Verify channel names match
   - Check DevTools console for errors

3. **Hot reload not working**
   - Ensure both Vite and Electron are running
   - Check `nodemon` is watching correct files

4. **Build fails**
   - Clear `dist/` and `dist-electron/`
   - Delete `node_modules` and reinstall

### Getting Help

- Check `ai/` documentation folder
- Review existing code patterns
- Check console/logs for errors
