# Quick Start Guide - Electron + Svelte Prototype

## ✅ Project Status

The Electron + Svelte reference application is now **COMPLETE** and ready to build and run!

## Prerequisites

- Node.js 18+ and npm installed
- Windows, macOS, or Linux

## Installation & Running

### Step 1: Install Dependencies

```bash
cd C:\Projects\repos\holokai\desktop\prototypes\electron-svelte
npm install
```

### Step 2: Run in Development Mode

**Option A: Two-Terminal Approach (Recommended)**

Terminal 1 - Start Vite Dev Server:

```bash
npm run dev
```

Terminal 2 - Build and Start Electron:

```bash
npm run build:electron
npm run electron
```

**Option B: Automated Watch Mode**

```bash
npm run electron:dev
```

### Step 3: Build for Production

```bash
npm run build:prod
npm run package
```

This creates distributable installers in the `release/` folder.

## What's Included

### ✅ Complete Electron Main Process

- `src-electron/main.ts` - Application lifecycle
- `src-electron/preload.ts` - Context Bridge API
- `src-electron/ipc-handlers/` - All IPC handlers (auth, settings, system, thread)
- `src-electron/services/` - Business logic services (AuthService, SettingsService)

### ✅ Complete Svelte Application

- `src/App.svelte` - Root component with auth routing
- `src/lib/stores/` - Reactive stores (auth, threads)
- `src/lib/services/` - Service layer (electron, thread)
- `src/lib/components/layout/` - Layout components (AppLayout, Header, Navbar)
- `src/routes/` - Page components (Home, Login, Threads)

### ✅ Configuration Files

- `package.json` - All dependencies configured
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `tsconfig.electron.json` - Electron TypeScript config

## Application Features

1. **Authentication System**
   - Mock login with multiple providers (Microsoft, Google, OAuth2)
   - Secure token storage using Electron's safeStorage
   - Persistent sessions across app restarts

2. **Thread Management (CRUD)**
   - Create, Read, Update, Delete threads
   - Real-time updates across windows via event broadcasting
   - Modal dialogs for creating/editing

3. **Security Features**
   - Context isolation enabled
   - No Node integration in renderer
   - Secure IPC communication via Context Bridge
   - Encrypted credential storage

4. **Reactive State Management**
   - Svelte stores for auth and threads
   - Automatic UI updates on state changes
   - Service layer for business logic

5. **Menu Integration**
   - File menu with keyboard shortcuts
   - Developer tools toggle
   - Menu commands trigger navigation

## Testing the Application

### 1. Login

- Click "Sign In (Mock)"
- Choose a provider (Microsoft/Google/OAuth2)
- You'll be logged in with a mock user

### 2. Threads

- Navigate to "Threads" in the sidebar
- Click "New Thread" to create
- Click "Edit" on any thread to modify
- Click "Delete" to remove a thread
- Changes sync in real-time if you open multiple windows

### 3. Menu Commands

- File → New Thread (Ctrl+N)
- File → Refresh (Ctrl+R)
- File → Developer Tools (Ctrl+Shift+I)

## Architecture Highlights

### Svelte vs Angular Benefits

✅ **Smaller Bundle Size**: ~50-100KB vs 500KB+
✅ **Simpler Syntax**: Less boilerplate
✅ **True Reactivity**: No change detection or observables
✅ **Faster Performance**: Compiled, no runtime overhead
✅ **Easier Learning Curve**: More intuitive

### Key Patterns

1. **Service Wrapper Pattern**: Services wrap IPC calls
2. **Store Pattern**: Svelte stores for reactive state
3. **Event Listeners**: Real-time updates via IPC events
4. **Type Safety**: Full TypeScript throughout

## Troubleshooting

### Electron window doesn't open

- Ensure Vite dev server is running first (npm run dev)
- Check that port 5173 is available
- Try the two-terminal approach instead of automated

### TypeScript errors

- Run `npm install` to ensure all types are installed
- Restart your IDE/editor

### Module not found errors

- Run `npm run build:electron` before starting Electron
- Check that all paths use forward slashes in imports

## Next Steps

- Customize the UI styling in component `<style>` blocks
- Add more IPC handlers for additional features
- Implement real Moku API integration (replace mock auth)
- Add more pages/routes as needed
- Configure electron-builder for your specific platform

## Project Structure

```
electron-svelte/
├── src/                        # Svelte application
│   ├── lib/
│   │   ├── components/layout/  # Layout components
│   │   ├── services/           # Service layer
│   │   ├── stores/             # Svelte stores
│   │   └── types/              # TypeScript types
│   ├── routes/                 # Pages
│   ├── App.svelte              # Root component
│   ├── main.ts                 # Svelte bootstrap
│   └── app.css                 # Global styles
├── src-electron/               # Electron main process
│   ├── ipc-handlers/           # IPC handlers
│   ├── services/               # Services
│   ├── main.ts                 # Main process
│   └── preload.ts              # Preload script
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## Success! 🎉

Your Electron + Svelte reference application is complete and functional. Follow the installation steps above to run it!
