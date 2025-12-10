# UI/UX Requirements

**Date:** 2025-11-25
**Status:** Requirements Definition
**Purpose:** Define user interface and experience requirements for Holokai Desktop

## Executive Summary

This document defines UI/UX infrastructure requirements:

1. **Menu Bar** - Application menus and commands
2. **System Tray** - Background presence and quick actions
3. **Keyboard Shortcuts** - Accelerators for common actions
4. **Drag and Drop** - File and content handling
5. **Native Dialogs** - File pickers, message boxes
6. **Accessibility** - Screen reader support, keyboard navigation

---

## Existing Design System Reference

The app uses the following established patterns. New features should align with these:

### CSS Framework & Theming

| Aspect | Implementation |
|--------|----------------|
| Framework | Tailwind CSS v3.4.18 |
| Component Library | PrimeNG v17.18.11 (Lara Light Blue theme) |
| Icons | PrimeIcons v7.0.0 |
| Dark Mode | Class-based selector (`.dark` on `<html>`) |
| Theme Storage | localStorage key: `holokai-app-color-mode` |

### Color Variables (from app.css)

```css
/* Primary */
--primary-color: #3b82f6;        /* Blue */

/* Text */
--text-primary: var(--text-color);
--text-secondary: var(--text-color-secondary);
--text-active: var(--primary-color);

/* Surfaces */
--surface-main: var(--surface-ground);
--surface-card: var(--surface-card);
--surface-overlay: var(--surface-overlay);
--surface-hover: var(--surface-hover);
--surface-border: var(--surface-border);

/* Sidebar (custom Holokai colors) */
--sidebar-primary-bg: #091320;           /* Light: dark navy */
--sidebar-secondary-bg: #f2f1ec;         /* Light: off-white */
--sidebar-item-hover: #33667e71;
--sidebar-item-active: #2d85ad;

/* Error */
--error-color: #ff3d32;
--error-bg: color-mix(in srgb, var(--red-100) 35%, transparent);

/* Input */
--input-background: ...
--input-border: ...
```

### Typography

| Property | Value |
|----------|-------|
| Font Family | Inter, system-ui, Avenir, Helvetica, Arial, sans-serif |
| Base Size | 1em (16px) |
| Line Height | 1.5 |
| Sidebar Item | 0.875rem (14px) |
| Small Text | 12px |

### Spacing & Layout

| Variable | Value |
|----------|-------|
| `--content-padding` | 1.25rem (20px) |
| `--inline-spacing` | 0.5rem (8px) |
| `--border-radius` | 6px |
| `--sidebar-primary-width` | 64px (collapsed) / 240px (expanded) |
| `--sidebar-secondary-width` | 280px (expanded) / 48px (collapsed) |

### Component Patterns

**Buttons:**
- Primary: `bg: var(--primary-color); color: white`
- Secondary: `bg: var(--surface-overlay); color: var(--text-primary)`
- Danger: `bg: var(--error-color); color: white`
- Disabled: `opacity: 0.6; cursor: not-allowed`
- Padding: `10px 20px`
- Border radius: `6px`

**Modals:**
- Backdrop: `backdrop-filter: blur(8px)`
- Shadow: `0 4px 20px rgba(0, 0, 0, 0.3)`
- Padding: `24px`
- Z-index: `1000`

**Sidebar Items:**
- Min-height: `44px`
- Padding: `10px 12px`
- Border radius: `6px`
- Transition: `all 0.2s ease`

### Existing Accessibility Patterns

- `role="menuitem"` on sidebar items
- `aria-label` on interactive elements
- `aria-live="polite"` for status messages
- `tabindex="0"` for focusable elements
- Keyboard handlers for Enter, Space, Escape
- Focus: `focus:ring-2 focus:ring-blue-500 focus:outline-none`

---

## 1. Menu Bar

### 1.1 Menu Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  File    Edit    View    Thread    Project    Workflow    Help              │
└─────────────────────────────────────────────────────────────────────────────┘

FILE                          EDIT
────                          ────
New Thread         Ctrl+N     Undo              Ctrl+Z
New Project        Ctrl+Shift+N   Redo          Ctrl+Y
─────────────────             ─────────────────
Open Thread...     Ctrl+O     Cut               Ctrl+X
Open Project...               Copy              Ctrl+C
─────────────────             Paste             Ctrl+V
Import Thread...              Paste Special     Ctrl+Shift+V
Export Thread...              ─────────────────
─────────────────             Select All        Ctrl+A
Settings           Ctrl+,     ─────────────────
─────────────────             Find              Ctrl+F
Exit               Alt+F4     Find in Thread    Ctrl+Shift+F

VIEW                          THREAD
────                          ──────
Sidebar            Ctrl+B     Retry Prompt      Ctrl+R
Full Screen        F11        Copy to Input     Ctrl+Shift+C
─────────────────             ─────────────────
Zoom In            Ctrl++     New Branch
Zoom Out           Ctrl+-     Collapse Branches
Reset Zoom         Ctrl+0     Expand All Branches
─────────────────             ─────────────────
Theme >                       Generate Title
  Light                       Edit Title        F2
  Dark                        ─────────────────
  System                      Move to Project...
─────────────────             Archive Thread
Refresh            Ctrl+Shift+R   Delete Thread

PROJECT                       WORKFLOW
───────                       ────────
Project Settings              New Workflow      Ctrl+Shift+W
Members...                    Run Workflow      Ctrl+Enter
─────────────────             ─────────────────
New Thread in Project         Save as Template
New Workflow in Project       ─────────────────
─────────────────             Workflow History
Storage Usage

HELP
────
Documentation     F1
Keyboard Shortcuts Ctrl+/
─────────────────
Check for Updates
─────────────────
About Holokai
```

### 1.2 Menu Implementation

```typescript
import { Menu, MenuItem, app } from 'electron';

function createApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Thread',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('menu:newThread')
        },
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => sendToRenderer('menu:newProject')
        },
        { type: 'separator' },
        {
          label: 'Open Thread...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('menu:openThread')
        },
        {
          label: 'Open Project...',
          click: () => sendToRenderer('menu:openProject')
        },
        { type: 'separator' },
        {
          label: 'Import Thread...',
          click: () => handleImportThread()
        },
        {
          label: 'Export Thread...',
          click: () => handleExportThread()
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToRenderer('menu:settings')
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    // ... other menus
  ];

  // macOS: Add app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'Cmd+,',
          click: () => sendToRenderer('menu:settings')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  return Menu.buildFromTemplate(template);
}

// Set application menu on startup
app.whenReady().then(() => {
  Menu.setApplicationMenu(createApplicationMenu());
});
```

### 1.3 Context Menus

```typescript
// Thread list context menu
function showThreadContextMenu(thread: Thread): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => openThread(thread.id)
    },
    { type: 'separator' },
    {
      label: 'Copy Link',
      click: () => copyDeepLink('thread', thread.id)
    },
    {
      label: 'Duplicate',
      click: () => duplicateThread(thread.id)
    },
    { type: 'separator' },
    {
      label: 'Move to Project',
      submenu: projectsSubmenu(thread.id)
    },
    { type: 'separator' },
    {
      label: 'Archive',
      click: () => archiveThread(thread.id)
    },
    {
      label: 'Delete',
      click: () => confirmDeleteThread(thread.id)
    }
  ]);

  menu.popup();
}

// Message context menu
function showMessageContextMenu(message: Message): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      click: () => copyToClipboard(message.id)
    },
    {
      label: 'Copy as Markdown',
      click: () => copyToClipboard(message.id, 'markdown')
    },
    { type: 'separator' },
    ...(message.role === 'user' ? [
      {
        label: 'Copy to Input',
        click: () => copyPromptToInput(message.id)
      },
      {
        label: 'Retry',
        click: () => initiateRetry(message.id)
      },
      { type: 'separator' }
    ] : []),
    {
      label: 'Select All',
      click: () => selectAllInMessage(message.id)
    }
  ]);

  menu.popup();
}
```

---

## 2. System Tray

### 2.1 Tray Behavior

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SYSTEM TRAY                                         │
│                                                                              │
│  ICON STATES                                                                │
│  ───────────                                                                 │
│  • Default: Holokai logo                                                    │
│  • Processing: Animated/pulsing                                             │
│  • Notification: Badge overlay                                              │
│  • Offline: Grayed out                                                      │
│                                                                              │
│  CLICK BEHAVIOR                                                              │
│  ──────────────                                                              │
│  • Left click: Show/hide main window                                        │
│  • Right click: Show context menu                                           │
│                                                                              │
│  CONTEXT MENU                                                                │
│  ────────────                                                                │
│  • New Thread                                                                │
│  • Recent Threads >                                                          │
│  • ─────────────                                                             │
│  • Show Window                                                               │
│  • ─────────────                                                             │
│  • Settings                                                                  │
│  • Quit                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tray Implementation

```typescript
import { Tray, Menu, nativeImage, app } from 'electron';

class TrayManager {
  private tray: Tray | null = null;
  private isProcessing = false;

  initialize(): void {
    const iconPath = this.getIconPath();
    this.tray = new Tray(iconPath);

    this.tray.setToolTip('Holokai Desktop');
    this.updateContextMenu();

    // Click behavior
    this.tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  }

  private getIconPath(): string {
    const iconName = process.platform === 'win32' ? 'tray.ico' : 'tray.png';
    return path.join(__dirname, 'assets', iconName);
  }

  private updateContextMenu(): void {
    const recentThreads = stateStore.get('application').recentThreads || [];

    const menu = Menu.buildFromTemplate([
      {
        label: 'New Thread',
        click: () => {
          mainWindow?.show();
          sendToRenderer('menu:newThread');
        }
      },
      {
        label: 'Recent Threads',
        submenu: recentThreads.slice(0, 5).map(thread => ({
          label: thread.title || 'Untitled',
          click: () => {
            mainWindow?.show();
            sendToRenderer('navigate', { route: `/thread/${thread.id}` });
          }
        }))
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          mainWindow?.show();
          sendToRenderer('menu:settings');
        }
      },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ]);

    this.tray?.setContextMenu(menu);
  }

  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
    // Update icon to animated version when processing
    const iconName = processing ? 'tray-processing' : 'tray';
    const iconPath = path.join(__dirname, 'assets', `${iconName}.png`);
    this.tray?.setImage(iconPath);
  }

  setOffline(offline: boolean): void {
    const iconName = offline ? 'tray-offline' : 'tray';
    const iconPath = path.join(__dirname, 'assets', `${iconName}.png`);
    this.tray?.setImage(iconPath);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
```

### 2.3 Minimize to Tray

```typescript
// User preference: minimize to tray instead of taskbar
interface TraySettings {
  minimizeToTray: boolean;
  closeToTray: boolean;
  showInTaskbar: boolean;
}

mainWindow.on('minimize', () => {
  const settings = stateStore.get('preferences').tray;
  if (settings.minimizeToTray) {
    mainWindow.hide();
  }
});

mainWindow.on('close', (event) => {
  const settings = stateStore.get('preferences').tray;
  if (settings.closeToTray && !app.isQuitting) {
    event.preventDefault();
    mainWindow.hide();
  }
});
```

---

## 3. Keyboard Shortcuts

### 3.1 Global Shortcuts

| Category | Action | Windows/Linux | macOS |
|----------|--------|---------------|-------|
| **File** | New Thread | Ctrl+N | Cmd+N |
| | New Project | Ctrl+Shift+N | Cmd+Shift+N |
| | Open | Ctrl+O | Cmd+O |
| | Settings | Ctrl+, | Cmd+, |
| | Quit | Alt+F4 | Cmd+Q |
| **Edit** | Undo | Ctrl+Z | Cmd+Z |
| | Redo | Ctrl+Y | Cmd+Shift+Z |
| | Cut | Ctrl+X | Cmd+X |
| | Copy | Ctrl+C | Cmd+C |
| | Paste | Ctrl+V | Cmd+V |
| | Select All | Ctrl+A | Cmd+A |
| | Find | Ctrl+F | Cmd+F |
| **View** | Toggle Sidebar | Ctrl+B | Cmd+B |
| | Full Screen | F11 | Cmd+Ctrl+F |
| | Zoom In | Ctrl++ | Cmd++ |
| | Zoom Out | Ctrl+- | Cmd+- |
| | Reset Zoom | Ctrl+0 | Cmd+0 |
| | Refresh | Ctrl+Shift+R | Cmd+Shift+R |
| **Thread** | Submit Prompt | Enter | Enter |
| | New Line in Prompt | Shift+Enter | Shift+Enter |
| | Retry | Ctrl+R | Cmd+R |
| | Copy to Input | Ctrl+Shift+C | Cmd+Shift+C |
| **Navigation** | Next Thread | Ctrl+Tab | Cmd+Tab |
| | Previous Thread | Ctrl+Shift+Tab | Cmd+Shift+Tab |
| | Go to Thread List | Ctrl+1 | Cmd+1 |
| | Go to Projects | Ctrl+2 | Cmd+2 |
| **Help** | Documentation | F1 | F1 |
| | Keyboard Shortcuts | Ctrl+/ | Cmd+/ |

### 3.2 Shortcut Registration

```typescript
import { globalShortcut, app } from 'electron';

class ShortcutManager {
  private shortcuts: Map<string, () => void> = new Map();

  registerGlobalShortcuts(): void {
    // Register shortcuts that work even when app is not focused
    globalShortcut.register('CmdOrCtrl+Shift+H', () => {
      // Quick capture - open new thread from anywhere
      mainWindow?.show();
      sendToRenderer('menu:newThread');
    });
  }

  registerLocalShortcuts(): void {
    // These are handled via accelerators in menus
    // and via keydown handlers in renderer
  }

  // Allow user customization
  setCustomShortcut(action: string, shortcut: string): void {
    const preferences = stateStore.get('preferences');
    preferences.shortcuts[action] = shortcut;
    stateStore.set('preferences', preferences);

    // Rebuild menus with new shortcuts
    Menu.setApplicationMenu(createApplicationMenu());
  }

  getShortcut(action: string): string {
    const custom = stateStore.get('preferences').shortcuts[action];
    return custom || DEFAULT_SHORTCUTS[action];
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
  }
}

// Unregister on quit
app.on('will-quit', () => {
  shortcutManager.unregisterAll();
});
```

### 3.3 Keyboard Shortcuts Dialog

```svelte
<!-- Shortcuts help dialog -->
<dialog bind:this={dialog} class="shortcuts-dialog">
  <h2>Keyboard Shortcuts</h2>

  {#each categories as category}
    <section>
      <h3>{category.name}</h3>
      <table>
        {#each category.shortcuts as shortcut}
          <tr>
            <td>{shortcut.action}</td>
            <td class="shortcut-key">
              {#if isMac}
                {shortcut.mac}
              {:else}
                {shortcut.windows}
              {/if}
            </td>
          </tr>
        {/each}
      </table>
    </section>
  {/each}

  <button on:click={() => dialog.close()}>Close</button>
</dialog>
```

---

## 4. Drag and Drop

### 4.1 Supported Drop Zones

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DRAG AND DROP ZONES                                  │
│                                                                              │
│  PROMPT INPUT                                                                │
│  ────────────                                                                │
│  • Drop files → Add as attachments                                          │
│  • Drop images → Add as image attachments                                   │
│  • Drop text → Insert at cursor                                             │
│                                                                              │
│  THREAD LIST                                                                 │
│  ───────────                                                                 │
│  • Drag thread → Reorder                                                    │
│  • Drop on project → Move thread to project                                 │
│                                                                              │
│  PROJECT SIDEBAR                                                             │
│  ───────────────                                                             │
│  • Drop thread → Add to project                                             │
│  • Drop files → Add as project files                                        │
│                                                                              │
│  MESSAGE AREA                                                                │
│  ────────────                                                                │
│  • Drop files → Attach to current input                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Drop Handler Implementation

```typescript
// Main process: Enable file drops
mainWindow.webContents.on('will-navigate', (event) => {
  event.preventDefault(); // Prevent navigation on file drop
});

// Renderer: Drop zone component
class DropZone {
  private element: HTMLElement;
  private onDrop: (files: File[], position?: { x: number; y: number }) => void;

  constructor(element: HTMLElement, onDrop: typeof this.onDrop) {
    this.element = element;
    this.onDrop = onDrop;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.element.addEventListener('dragenter', this.handleDragEnter.bind(this));
    this.element.addEventListener('dragover', this.handleDragOver.bind(this));
    this.element.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.element.addEventListener('drop', this.handleDrop.bind(this));
  }

  private handleDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.element.classList.add('drag-over');
  }

  private handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  }

  private handleDragLeave(event: DragEvent): void {
    // Only remove class if leaving the element entirely
    if (!this.element.contains(event.relatedTarget as Node)) {
      this.element.classList.remove('drag-over');
    }
  }

  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.element.classList.remove('drag-over');

    const files = Array.from(event.dataTransfer?.files || []);
    const position = { x: event.clientX, y: event.clientY };

    if (files.length > 0) {
      this.onDrop(files, position);
    }
  }
}
```

### 4.3 Prompt Input Drop Handler

```typescript
// Handle drops on prompt input
function handlePromptDrop(files: File[]): void {
  const validFiles: File[] = [];
  const invalidFiles: string[] = [];

  for (const file of files) {
    if (isValidAttachment(file)) {
      validFiles.push(file);
    } else {
      invalidFiles.push(file.name);
    }
  }

  // Add valid files as attachments
  for (const file of validFiles) {
    addPendingAttachment(currentThread.id, file);
  }

  // Notify about invalid files
  if (invalidFiles.length > 0) {
    notificationService.showToast({
      type: 'error',
      title: 'Some files skipped',
      body: `${invalidFiles.join(', ')} not supported`
    });
  }
}

function isValidAttachment(file: File): boolean {
  const maxSize = 25 * 1024 * 1024; // 25MB
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  return file.size <= maxSize && allowedTypes.includes(file.type);
}
```

### 4.4 Thread Drag and Drop

```typescript
// Thread reordering via drag
interface DragState {
  threadId: string;
  sourceIndex: number;
  sourceProjectId?: string;
}

function handleThreadDragStart(event: DragEvent, thread: Thread, index: number): void {
  event.dataTransfer!.effectAllowed = 'move';
  event.dataTransfer!.setData('application/x-holokai-thread', JSON.stringify({
    threadId: thread.id,
    sourceIndex: index,
    sourceProjectId: thread.projectId
  }));

  // Set drag image
  const dragImage = createThreadDragImage(thread);
  event.dataTransfer!.setDragImage(dragImage, 0, 0);
}

function handleThreadDrop(event: DragEvent, targetProjectId?: string): void {
  const data = event.dataTransfer!.getData('application/x-holokai-thread');
  if (!data) return;

  const { threadId, sourceProjectId } = JSON.parse(data) as DragState;

  if (targetProjectId !== sourceProjectId) {
    // Move thread to different project
    moveThread(threadId, targetProjectId);
  }
}
```

---

## 5. Native Dialogs

### 5.1 File Dialogs

```typescript
import { dialog, BrowserWindow } from 'electron';

// Open file dialog
async function showOpenFileDialog(options?: {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  multiSelect?: boolean;
}): Promise<string[] | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: options?.title || 'Open File',
    properties: [
      'openFile',
      ...(options?.multiSelect ? ['multiSelections'] : [])
    ] as any,
    filters: options?.filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  return result.canceled ? null : result.filePaths;
}

// Save file dialog
async function showSaveFileDialog(options?: {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | null> {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: options?.title || 'Save File',
    defaultPath: options?.defaultPath,
    filters: options?.filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  return result.canceled ? null : result.filePath;
}

// Common dialog configurations
const DIALOG_CONFIGS = {
  importThread: {
    title: 'Import Thread',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  },
  exportThread: {
    title: 'Export Thread',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  },
  attachFile: {
    title: 'Attach File',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    multiSelect: true
  }
};
```

### 5.2 Message Dialogs

```typescript
// Confirmation dialog
async function showConfirmDialog(options: {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'info' | 'warning' | 'error' | 'question';
}): Promise<boolean> {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: options.type || 'question',
    title: options.title,
    message: options.message,
    detail: options.detail,
    buttons: [options.confirmLabel || 'OK', options.cancelLabel || 'Cancel'],
    defaultId: 0,
    cancelId: 1
  });

  return result.response === 0;
}

// Delete confirmation
async function confirmDelete(itemType: string, itemName: string): Promise<boolean> {
  return showConfirmDialog({
    type: 'warning',
    title: `Delete ${itemType}`,
    message: `Are you sure you want to delete "${itemName}"?`,
    detail: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel'
  });
}

// Error dialog
async function showErrorDialog(title: string, message: string, detail?: string): Promise<void> {
  await dialog.showMessageBox(mainWindow!, {
    type: 'error',
    title,
    message,
    detail,
    buttons: ['OK']
  });
}

// Info dialog
async function showInfoDialog(title: string, message: string): Promise<void> {
  await dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title,
    message,
    buttons: ['OK']
  });
}
```

### 5.3 Custom Dialogs

```typescript
// For complex dialogs, use in-app modals instead of native
// Example: Project settings dialog, member management, etc.

// Expose dialog API to renderer
contextBridge.exposeInMainWorld('dialog', {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  confirm: (options) => ipcRenderer.invoke('dialog:confirm', options),
  error: (title, message, detail) => ipcRenderer.invoke('dialog:error', title, message, detail),
  info: (title, message) => ipcRenderer.invoke('dialog:info', title, message)
});
```

---

## 6. Accessibility

### 6.1 Accessibility Requirements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ACCESSIBILITY BASELINE                                  │
│                                                                              │
│  KEYBOARD NAVIGATION                                                         │
│  ───────────────────                                                         │
│  • All interactive elements focusable via Tab                               │
│  • Logical tab order                                                         │
│  • Visible focus indicators                                                  │
│  • Skip links for main content                                              │
│  • Arrow key navigation in lists                                            │
│                                                                              │
│  SCREEN READER SUPPORT                                                       │
│  ─────────────────────                                                       │
│  • Semantic HTML elements                                                    │
│  • ARIA labels and roles                                                     │
│  • Live regions for dynamic content                                         │
│  • Meaningful alt text for images                                           │
│                                                                              │
│  VISUAL ACCESSIBILITY                                                        │
│  ────────────────────                                                        │
│  • Minimum contrast ratio 4.5:1                                             │
│  • Resizable text (up to 200%)                                              │
│  • No color-only information                                                 │
│  • Reduced motion option                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Focus Management

```typescript
// Focus trap for modals
class FocusTrap {
  private element: HTMLElement;
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
    this.updateFocusableElements();
    this.setupTrap();
  }

  private updateFocusableElements(): void {
    const focusable = this.element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    this.firstFocusable = focusable[0] || null;
    this.lastFocusable = focusable[focusable.length - 1] || null;
  }

  private setupTrap(): void {
    this.element.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === this.firstFocusable) {
          event.preventDefault();
          this.lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === this.lastFocusable) {
          event.preventDefault();
          this.firstFocusable?.focus();
        }
      }
    });
  }

  activate(): void {
    this.firstFocusable?.focus();
  }
}

// Skip link
function renderSkipLink(): HTMLElement {
  const link = document.createElement('a');
  link.href = '#main-content';
  link.className = 'skip-link';
  link.textContent = 'Skip to main content';
  return link;
}
```

### 6.3 ARIA Attributes

```svelte
<!-- Thread list with proper ARIA -->
<nav aria-label="Thread list">
  <ul role="listbox" aria-label="Threads">
    {#each threads as thread, index}
      <li
        role="option"
        aria-selected={selectedId === thread.id}
        tabindex={selectedId === thread.id ? 0 : -1}
        on:keydown={(e) => handleListKeydown(e, index)}
      >
        <span class="thread-title">{thread.title || 'Untitled'}</span>
        <span class="sr-only">
          {thread.messageCount} messages, last updated {formatDate(thread.updatedAt)}
        </span>
      </li>
    {/each}
  </ul>
</nav>

<!-- Message with live region for streaming -->
<div
  role="log"
  aria-live="polite"
  aria-label="Conversation"
>
  {#each messages as message}
    <article
      role="article"
      aria-label="{message.role} message"
    >
      <header class="sr-only">
        {message.role === 'user' ? 'You' : 'Assistant'} at {formatTime(message.createdAt)}
      </header>
      <div class="message-content">
        {message.content}
      </div>
    </article>
  {/each}
</div>

<!-- Loading indicator -->
{#if isLoading}
  <div role="status" aria-live="polite">
    <span class="sr-only">Loading response...</span>
    <LoadingSpinner />
  </div>
{/if}
```

### 6.4 Reduced Motion

```typescript
// Check user preference
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// CSS for reduced motion
const reducedMotionStyles = `
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// Svelte transition with reduced motion support
function safeTransition(node: HTMLElement, params: TransitionParams) {
  if (prefersReducedMotion()) {
    return { duration: 0 };
  }
  return fly(node, params);
}
```

### 6.5 Contrast and Color

The app uses existing CSS custom properties from `app.css`. Focus styles should use these variables:

```css
/* Existing app color variables (from app.css) */
:root {
  --primary-color: #3b82f6;           /* Blue - PrimeNG Lara */
  --text-primary: var(--text-color);
  --text-secondary: var(--text-color-secondary);
  --surface-main: var(--surface-ground);
  --surface-hover: var(--surface-hover);
  --error-color: #ff3d32;
}

/* Dark mode uses .dark class selector */
html.dark {
  /* Variables automatically adjusted by theme */
}

/* NEW: Focus ring variables to add */
:root {
  --focus-ring-color: var(--primary-color);
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

/* Focus visible - consistent with existing button:focus pattern */
:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

/* Alternative: Use Tailwind focus classes (already in use) */
/* focus:ring-2 focus:ring-blue-500 focus:outline-none */

/* Error states - use existing --error-color */
.error {
  color: var(--error-color);
  background: var(--error-bg);  /* Uses color-mix for transparency */
}
```

**Existing Focus Patterns in Codebase:**
- Tailwind: `focus:outline-none focus:ring-2 focus:ring-blue-500`
- CSS: `button:focus { outline: 4px auto -webkit-focus-ring-color; }`
- Component: `&:focus { outline: none; background: var(--surface-hover); }`

---

## 7. Implementation Checklist

### 7.1 Menu Bar

- [ ] Create application menu template
- [ ] Implement File menu actions
- [ ] Implement Edit menu actions
- [ ] Implement View menu actions
- [ ] Implement Thread menu actions
- [ ] Implement Project menu actions
- [ ] Implement Workflow menu actions
- [ ] Implement Help menu actions
- [ ] macOS-specific app menu
- [ ] Context menus (thread, message, project)

### 7.2 System Tray

- [ ] Create tray icon (normal, processing, offline states)
- [ ] Implement tray context menu
- [ ] Left-click show/hide behavior
- [ ] Minimize to tray option
- [ ] Close to tray option

### 7.3 Keyboard Shortcuts

- [ ] Register global shortcuts
- [ ] Implement menu accelerators
- [ ] Keyboard shortcuts dialog
- [ ] Custom shortcut support
- [ ] Platform-specific shortcuts (Mac/Windows/Linux)

### 7.4 Drag and Drop

- [ ] Prompt input drop zone (files, images)
- [ ] Thread list drag reorder
- [ ] Thread to project drop
- [ ] Project file drop
- [ ] Visual feedback (drag-over states)

### 7.5 Native Dialogs

- [ ] Open file dialog
- [ ] Save file dialog
- [ ] Confirmation dialogs
- [ ] Error dialogs
- [ ] Info dialogs

### 7.6 Accessibility

- [ ] Keyboard navigation for all interactive elements
- [ ] Tab order audit
- [ ] Focus indicators
- [ ] Skip links
- [ ] ARIA labels and roles
- [ ] Live regions for dynamic content
- [ ] Screen reader testing
- [ ] Contrast ratio validation
- [ ] Reduced motion support
- [ ] Text resizing support

---

## 8. Key Decisions Summary

| Decision | Value |
|----------|-------|
| CSS Framework | Tailwind CSS v3.4.18 (existing) |
| Component Library | PrimeNG Lara Light Blue (existing) |
| Dark Mode | Class-based `.dark` selector (existing) |
| Primary Color | `#3b82f6` / `var(--primary-color)` (existing) |
| Menu framework | Electron Menu API |
| System tray | Single icon with context menu |
| Tray click | Left = toggle window, Right = menu |
| Minimize to tray | User preference (default off) |
| Global shortcut | Ctrl/Cmd+Shift+H (quick capture) |
| Custom shortcuts | Stored in user preferences |
| Drag drop files | Validate size (25MB) and type |
| Thread drag | Move between projects |
| Native dialogs | Electron dialog API |
| Custom modals | In-app with `backdrop-filter: blur(8px)` |
| WCAG target | Level AA |
| Focus indicator | `focus:ring-2 focus:ring-blue-500` (Tailwind) |
| Border radius | 6px / `var(--border-radius)` |
| Transitions | `all 0.2s ease` |

---

_UI/UX requirements defined - 2025-11-25_
