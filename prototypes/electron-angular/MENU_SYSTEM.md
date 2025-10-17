# Application Menu System

## Overview

Holokai Desktop includes a native Windows application menu with File and Help menus.

## Menu Structure

### File Menu
- **New Thread...** (Ctrl+N) - Opens the new thread dialog
- **Refresh** (Ctrl+R) - Refreshes the thread list
- **Settings...** (Ctrl+,) - Opens settings dialog *(placeholder)*
- **Developer Tools** (Ctrl+Shift+I) - Toggles Chrome DevTools
- **Exit** (Alt+F4) - Closes the application

### Help Menu
- **Getting Started** - Shows getting started guide *(placeholder)*
- **Users Guide** - Shows users guide *(placeholder)*
- **About** - Shows application version and information

## How It Works

The menu system uses Electron's native menu API with IPC communication to trigger actions in the Angular renderer.

### Architecture

```
Menu Click (Main Process)
  ↓
IPC Message Send
  ↓
Preload Script (Context Bridge)
  ↓
Angular Component Listener
  ↓
Action Executed
```

### Implementation Details

**1. Main Process (`src-electron/main.ts`)**
- Creates the menu using `Menu.buildFromTemplate()`
- Sends IPC messages when menu items are clicked
- Example: `mainWindow.webContents.send('menu:new-thread')`

**2. Preload Script (`src-electron/preload.ts`)**
- Exposes `onMenuCommand()` method via context bridge
- Provides safe IPC communication to renderer

**3. Angular Components**
- Listen for menu commands using `window.electronAPI.onMenuCommand()`
- Execute appropriate actions when commands are received

### Example: Adding a New Menu Command

**Step 1: Add to Menu Template (`main.ts`)**
```typescript
{
  label: 'My Command',
  accelerator: 'CmdOrCtrl+M',
  click: () => {
    if (mainWindow) {
      mainWindow.webContents.send('menu:my-command');
    }
  }
}
```

**Step 2: Listen in Component**
```typescript
// In ngOnInit or setupMenuListeners
const cleanup = (window as any).electronAPI.onMenuCommand('menu:my-command', () => {
  this.myAction();
});
this.subscriptions.add({ unsubscribe: cleanup });
```

## Keyboard Shortcuts

The following keyboard shortcuts are available:

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New Thread |
| Ctrl+R | Refresh |
| Ctrl+, | Settings |
| Ctrl+Shift+I | Toggle Developer Tools |
| Alt+F4 | Exit |

*Note: On macOS, Ctrl is replaced with Cmd*

## Developer Tools

Chrome DevTools are no longer opened automatically when the application starts. Instead:

- Use **File > Developer Tools** menu
- Press **Ctrl+Shift+I** (Cmd+Shift+I on macOS)
- Use **F12** key (standard browser shortcut)

The menu command toggles DevTools - clicking it again will close them.

## About Dialog

The About dialog shows:
- Application name: "Holokai Desktop"
- Version: 1.0
- Description: "A reference Electron + Angular application demonstrating architecture patterns."

## Future Enhancements

The following menu items are placeholders and can be implemented:

1. **Settings** - Navigate to a settings page
2. **Getting Started** - Show an onboarding tutorial
3. **Users Guide** - Open documentation or help page

To implement these, follow the pattern shown in the "Adding a New Menu Command" section above.
