# Quick Start Guide - Electron + Angular

## For Windows Users (Recommended Approach)

### First Time Setup

```powershell
# 1. Navigate to project
cd C:\Projects\repos\holokai\desktop-prototypes\electron-angular

# 2. Install dependencies
npm install
```

### Every Day Development - Two Terminals

#### Terminal 1 (Angular Dev Server)
```powershell
npm start
```
**Wait for:** "Application bundle generation complete" message

#### Terminal 2 (Electron)
```powershell
# First time or after changing Electron code
npm run build:electron

# Start Electron window
npm run electron
```

### That's It! 🎉

- **Angular changes**: Auto-reload in Electron window (hot reload)
- **Electron changes**: Close window, run `npm run electron` again
- **DevTools**: Press `Ctrl+Shift+I` in Electron window

## Common Issues

### "Electron window doesn't open"
- Make sure Terminal 1 shows "Application bundle generation complete"
- Make sure you're using PowerShell or CMD, not WSL bash
- Try closing and running `npm run electron` again

### "Cannot find module"
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

### "Port 4200 already in use"
- Close any other Angular apps running
- Or kill the process: `netstat -ano | findstr :4200` then `taskkill /PID <pid> /F`

## File Structure

```
Changes in Angular app:     src/app/**/*
Changes in Electron:        src-electron/**/*
Config files:               *.json files
```

## What to Edit

- **UI/Components**: Edit files in `src/app/`
- **IPC Handlers**: Edit files in `src-electron/ipc-handlers/`
- **Context Bridge**: Edit `src-electron/preload.ts`
- **Main Process**: Edit `src-electron/main.ts`

## Available Scripts

```powershell
npm start              # Angular dev server (browser)
npm run build:electron # Build Electron main process
npm run electron       # Start Electron with built files
npm run electron:dev   # Automated mode (unreliable on Windows)
npm run build:prod     # Production build
npm run package        # Create installer
```

## Getting Help

1. Check console in Terminal 1 for Angular errors
2. Check console in Terminal 2 for Electron errors
3. Press `Ctrl+Shift+I` in Electron for renderer errors
4. See DEVELOPMENT.md for detailed guides
