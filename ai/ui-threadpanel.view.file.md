# Thread Panel File View

**Version:** 1.0
**Date:** 2026-01-30
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-layout.md** | Layout system and component structure |
| **ui-threadpanel-components.md** | Component hierarchy and state machine |

---

## 1. Overview

The File View provides a hierarchical file browser and manager for project files. Users can create, delete, and rename folders; open, move, rename, and delete files. Each file displays metadata tooltips showing the last read and write information including prompt, model, user, and timestamp.

---

## 2. Requirements

| # | Requirement |
|---|-------------|
| 1 | Display project folder structure as expandable tree |
| 2 | Create new folders with user-provided names |
| 3 | Delete folders (with confirmation for non-empty folders) |
| 4 | Rename folders inline with validation |
| 5 | Open files in editor (read-only preview or editable) |
| 6 | Move files between folders via drag-drop or menu |
| 7 | Rename files inline with validation |
| 8 | Delete files with confirmation dialog |
| 9 | Display tooltip on file hover showing: last read prompt, model, user, timestamp |
| 10 | Display tooltip on file hover showing: last write prompt, model, user, timestamp |
| 11 | Show file icon based on extension (code, markdown, text, etc.) |
| 12 | Display file size and type in file details |

---

## 3. ThreadFileView.svelte

**Responsibilities:**
- Render file tree with folder navigation
- Handle folder CRUD operations
- Handle file CRUD operations
- Display file metadata tooltips
- Track folder expansion state

**Props:**
```typescript
interface ThreadFileViewProps {
  thread: Thread;
  projectId: string;
}
```

**State:**
```typescript
interface FileMetadata {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;           // bytes
  extension?: string;       // file type
  lastRead?: {
    prompt: string;        // Prompt text that led to file read
    model: string;         // Model used
    user: string;          // User name
    timestamp: number;     // ISO timestamp
  };
  lastWrite?: {
    prompt: string;        // Prompt text that led to file write
    model: string;         // Model used
    user: string;          // User name
    timestamp: number;     // ISO timestamp
  };
}

let fileTree = $state<FileMetadata[]>([]);
let expandedFolders = $state(new Set<string>()); // folder paths
let selectedFileId = $state<string | null>(null);
let renamingItemId = $state<string | null>(null);
let renameValue = $state('');
```

**Template:**
```svelte
<div class="thread-file-view">
  <div class="file-view-toolbar">
    <button onclick={handleCreateFolder} title="Create new folder">
      + Folder
    </button>
    <button onclick={handleRefresh} title="Refresh file tree">
      ↻ Refresh
    </button>
  </div>

  <div class="file-tree-container">
    <FileTree
      tree={fileTree}
      expandedFolders={expandedFolders}
      selectedFileId={selectedFileId}
      renamingItemId={renamingItemId}
      renameValue={renameValue}
      onToggleFolder={handleToggleFolderExpansion}
      onSelectFile={handleSelectFile}
      onCreateFolder={handleCreateFolder}
      onDeleteFolder={handleDeleteFolder}
      onRenameItem={handleRenameItem}
      onDeleteFile={handleDeleteFile}
      onOpenFile={handleOpenFile}
      onMoveFile={handleMoveFile}
      onStartRename={handleStartRename}
      onCancelRename={handleCancelRename}
      onUpdateRenameValue={handleUpdateRenameValue}
    />
  </div>
</div>
```

**Key Methods:**
```typescript
async function loadFileTree(): Promise<void> {
  try {
    const tree = await window.electronAPI.files.getProjectFiles(projectId);
    fileTree = processFileMetadata(tree);
  } catch (error) {
    console.error('Failed to load file tree:', error);
  }
}

function processFileMetadata(files: any[]): FileMetadata[] {
  return files.map(f => ({
    id: f.id,
    name: f.name,
    type: f.isDirectory ? 'folder' : 'file',
    path: f.path,
    size: f.size,
    extension: f.extension,
    lastRead: f.lastRead ? {
      prompt: f.lastRead.prompt,
      model: f.lastRead.model,
      user: f.lastRead.user,
      timestamp: f.lastRead.timestamp,
    } : undefined,
    lastWrite: f.lastWrite ? {
      prompt: f.lastWrite.prompt,
      model: f.lastWrite.model,
      user: f.lastWrite.user,
      timestamp: f.lastWrite.timestamp,
    } : undefined,
  }));
}

function handleToggleFolderExpansion(folderPath: string): void {
  expandedFolders = new Set(expandedFolders);
  if (expandedFolders.has(folderPath)) {
    expandedFolders.delete(folderPath);
  } else {
    expandedFolders.add(folderPath);
  }
}

async function handleCreateFolder(): Promise<void> {
  const parentPath = selectedFileId ? getParentPath(selectedFileId) : '/';
  const name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;

  try {
    await window.electronAPI.files.createFolder(projectId, parentPath, name);
    await loadFileTree();
  } catch (error) {
    console.error('Failed to create folder:', error);
  }
}

async function handleDeleteFolder(folderPath: string, isNonEmpty: boolean): Promise<void> {
  const message = isNonEmpty
    ? 'This folder is not empty. Delete anyway?'
    : 'Delete this folder?';
  
  if (!confirm(message)) return;

  try {
    await window.electronAPI.files.deleteFolder(projectId, folderPath);
    await loadFileTree();
  } catch (error) {
    console.error('Failed to delete folder:', error);
  }
}

function handleStartRename(itemId: string, currentName: string): void {
  renamingItemId = itemId;
  renameValue = currentName;
}

function handleCancelRename(): void {
  renamingItemId = null;
  renameValue = '';
}

function handleUpdateRenameValue(value: string): void {
  renameValue = value;
}

async function handleRenameItem(itemId: string, itemPath: string, isFile: boolean): Promise<void> {
  if (!renameValue.trim()) return;

  try {
    if (isFile) {
      await window.electronAPI.files.renameFile(projectId, itemPath, renameValue);
    } else {
      await window.electronAPI.files.renameFolder(projectId, itemPath, renameValue);
    }
    await loadFileTree();
  } catch (error) {
    console.error('Failed to rename item:', error);
  } finally {
    renamingItemId = null;
    renameValue = '';
  }
}

function handleSelectFile(fileId: string): void {
  selectedFileId = fileId;
}

async function handleOpenFile(filePath: string, fileId: string): Promise<void> {
  try {
    const content = await window.electronAPI.files.readFile(projectId, filePath);
    // Update last read timestamp
    await window.electronAPI.files.updateFileMetadata(projectId, fileId, { lastRead: Date.now() });
    
    // Emit event to open file in editor or viewer
    window.dispatchEvent(new CustomEvent('file:open', {
      detail: { fileId, filePath, content }
    }));
  } catch (error) {
    console.error('Failed to open file:', error);
  }
}

async function handleMoveFile(fileId: string, fromPath: string, toFolderPath: string): Promise<void> {
  try {
    await window.electronAPI.files.moveFile(projectId, fromPath, toFolderPath);
    await loadFileTree();
  } catch (error) {
    console.error('Failed to move file:', error);
  }
}

async function handleDeleteFile(filePath: string): Promise<void> {
  if (!confirm('Delete this file? This cannot be undone.')) return;

  try {
    await window.electronAPI.files.deleteFile(projectId, filePath);
    await loadFileTree();
    if (selectedFileId === filePath) {
      selectedFileId = null;
    }
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
}

async function handleRefresh(): Promise<void> {
  await loadFileTree();
}
```

**Lifecycle:**
```typescript
import { onMount } from 'svelte';

onMount(async () => {
  await loadFileTree();
});
```

**Size Estimate:** ~300 lines

---

## 4. Sub-Components

### 4.1 FileTree.svelte

**Responsibilities:**
- Render hierarchical folder structure
- Display file items in tree
- Handle context menus for CRUD operations
- Manage drag-drop for file moves

**Props:**
```typescript
interface FileTreeProps {
  tree: FileMetadata[];
  expandedFolders: Set<string>;
  selectedFileId: string | null;
  renamingItemId: string | null;
  renameValue: string;
  onToggleFolder: (path: string) => void;
  onSelectFile: (fileId: string) => void;
  onCreateFolder: () => void;
  onDeleteFolder: (path: string, isNonEmpty: boolean) => void;
  onRenameItem: (itemId: string, path: string, isFile: boolean) => void;
  onDeleteFile: (path: string) => void;
  onOpenFile: (path: string, fileId: string) => void;
  onMoveFile: (fileId: string, fromPath: string, toPath: string) => void;
  onStartRename: (itemId: string, name: string) => void;
  onCancelRename: () => void;
  onUpdateRenameValue: (value: string) => void;
}
```

**Size Estimate:** ~150 lines

### 4.2 FolderItem.svelte

**Responsibilities:**
- Display folder with expand/collapse toggle
- Show folder icon and name
- Handle context menu (create, rename, delete)
- Recursively render child files/folders

**Props:**
```typescript
interface FolderItemProps {
  folder: FileMetadata;
  isExpanded: boolean;
  isRenaming: boolean;
  renameValue: string;
  onToggleExpansion: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onCreateSubFolder: () => void;
  children: FileMetadata[];
}
```

**Size Estimate:** ~120 lines

### 4.3 FileItem.svelte

**Responsibilities:**
- Display file with icon and name
- Show file size and type
- Display metadata tooltips on hover
- Handle context menu (open, rename, delete, move)
- Render rename input in edit mode

**Props:**
```typescript
interface FileItemProps {
  file: FileMetadata;
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onMove: (targetFolderPath: string) => void;
  onStartRename: () => void;
  onUpdateRenameValue: (value: string) => void;
}
```

**Size Estimate:** ~140 lines

### 4.4 FileMetadataTooltip.svelte

**Responsibilities:**
- Display file metadata in tooltip format
- Show last read and last write information
- Format timestamps in human-readable format

**Props:**
```typescript
interface FileMetadataTooltipProps {
  lastRead?: {
    prompt: string;
    model: string;
    user: string;
    timestamp: number;
  };
  lastWrite?: {
    prompt: string;
    model: string;
    user: string;
    timestamp: number;
  };
}
```

**Template:**
```svelte
<div class="file-metadata-tooltip">
  {#if lastRead}
    <div class="metadata-section">
      <div class="section-title">Last Read</div>
      <div class="metadata-row">
        <span class="label">When:</span>
        <span class="value">{formatDate(lastRead.timestamp)}</span>
      </div>
      <div class="metadata-row">
        <span class="label">By:</span>
        <span class="value">{lastRead.user}</span>
      </div>
      <div class="metadata-row">
        <span class="label">Model:</span>
        <span class="value">{lastRead.model}</span>
      </div>
      <div class="metadata-row">
        <span class="label">Prompt:</span>
        <span class="value">{truncate(lastRead.prompt, 100)}</span>
      </div>
    </div>
  {/if}
  
  {#if lastWrite}
    <div class="metadata-section">
      <div class="section-title">Last Write</div>
      <div class="metadata-row">
        <span class="label">When:</span>
        <span class="value">{formatDate(lastWrite.timestamp)}</span>
      </div>
      <div class="metadata-row">
        <span class="label">By:</span>
        <span class="value">{lastWrite.user}</span>
      </div>
      <div class="metadata-row">
        <span class="label">Model:</span>
        <span class="value">{lastWrite.model}</span>
      </div>
      <div class="metadata-row">
        <span class="label">Prompt:</span>
        <span class="value">{truncate(lastWrite.prompt, 100)}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .file-metadata-tooltip {
    font-size: 0.75rem;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border-radius: 4px;
    max-width: 300px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  .metadata-section {
    margin-bottom: 0.5rem;
  }
  
  .section-title {
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.25rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.25rem;
  }
  
  .metadata-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .label {
    font-weight: 500;
    color: var(--color-text-secondary);
    min-width: 50px;
  }
  
  .value {
    color: var(--color-text);
    word-break: break-word;
  }
</style>
```

**Size Estimate:** ~100 lines

---

## 5. Visual Layout

### File Tree - Collapsed State

```
┌──────────────────────────────────────────────────────────────┐
│ [+ Folder] [↻ Refresh]                                       │
├──────────────────────────────────────────────────────────────┤
│ 📁 src/                                                      │
│ 📁 components/                                               │
│ 📁 lib/                                                      │
│ 📄 README.md                                  5.2 KB         │
│ 📄 package.json                              1.1 KB         │
│ 📄 tsconfig.json                             0.8 KB         │
└──────────────────────────────────────────────────────────────┘
```

### File Tree - Expanded with Selection

```
┌──────────────────────────────────────────────────────────────┐
│ [+ Folder] [↻ Refresh]                                       │
├──────────────────────────────────────────────────────────────┤
│ 📁 src/
│   ├─ 📁 components/
│   │  ├─ 📄 Button.svelte               2.5 KB
│   │  └─ 📄 Input.svelte                3.1 KB
│   ├─ 📁 lib/
│   │  ├─ 📄 utils.ts                    1.8 KB
│   │  └─ 📄 types.ts                    4.2 KB
│   └─ 📄 main.ts                        0.5 KB
│ 📄 README.md                             5.2 KB
│ 📄 package.json ← selected              1.1 KB
│ 📄 tsconfig.json                        0.8 KB
└──────────────────────────────────────────────────────────────┘
```

### Metadata Tooltip Example

```
┌─────────────────────────────────────┐
│ Last Read                           │
│ When: Jan 30, 2026 2:34 PM         │
│ By: alice                           │
│ Model: gpt-4o                       │
│ Prompt: Create a utility function.. │
├─────────────────────────────────────┤
│ Last Write                          │
│ When: Jan 29, 2026 11:22 AM        │
│ By: bob                             │
│ Model: claude-3                     │
│ Prompt: Refactor the type system... │
└─────────────────────────────────────┘
```

---

## 6. Context Menu Actions

### Folder Context Menu

| Action | Trigger | Result |
|--------|---------|--------|
| Create Folder | Right-click folder | Prompt for name, create subfolder |
| Rename | Right-click folder | Inline edit mode |
| Delete | Right-click folder | Confirmation dialog if non-empty |
| Expand All | Right-click folder | Recursively expand all children |
| Collapse All | Right-click folder | Recursively collapse all children |

### File Context Menu

| Action | Trigger | Result |
|--------|---------|--------|
| Open | Left-click or menu | Load file, display in editor/viewer |
| Open With... | Right-click file | Show available editors |
| Rename | Right-click file | Inline edit mode |
| Move To | Right-click file | Show folder browser, move file |
| Copy | Right-click file | Copy file path to clipboard |
| Delete | Right-click file | Confirmation dialog |
| Properties | Right-click file | Show metadata tooltip |

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate files/folders |
| `→` | Expand folder |
| `←` | Collapse folder |
| `Enter` | Open selected file |
| `F2` | Rename selected item |
| `Delete` | Delete selected item |
| `Ctrl+N` | Create new folder |
| `Ctrl+F` | Focus search input (future) |

---

## 8. File Metadata Structure

### File Object with Metadata

```typescript
interface FileMetadata {
  id: string;                          // Unique file ID
  name: string;                        // File or folder name
  type: 'file' | 'folder';            // Type discriminator
  path: string;                        // Full path from project root
  size?: number;                       // File size in bytes
  extension?: string;                  // File extension (.ts, .md, etc.)
  
  lastRead?: {
    prompt: string;                    // Prompt that triggered read
    model: string;                     // Model name
    user: string;                      // User who triggered read
    timestamp: number;                 // Unix timestamp
  };
  
  lastWrite?: {
    prompt: string;                    // Prompt that triggered write
    model: string;                     // Model name
    user: string;                      // User who triggered write
    timestamp: number;                 // Unix timestamp
  };
}
```

---

## 9. IPC API Contract

**Methods required from Electron backend:**

```typescript
// File operations
window.electronAPI.files.getProjectFiles(projectId: string): Promise<FileMetadata[]>
window.electronAPI.files.createFolder(projectId: string, parentPath: string, name: string): Promise<void>
window.electronAPI.files.deleteFolder(projectId: string, folderPath: string): Promise<void>
window.electronAPI.files.renameFolder(projectId: string, folderPath: string, newName: string): Promise<void>

window.electronAPI.files.readFile(projectId: string, filePath: string): Promise<string>
window.electronAPI.files.writeFile(projectId: string, filePath: string, content: string): Promise<void>
window.electronAPI.files.moveFile(projectId: string, fromPath: string, toFolderPath: string): Promise<void>
window.electronAPI.files.renameFile(projectId: string, filePath: string, newName: string): Promise<void>
window.electronAPI.files.deleteFile(projectId: string, filePath: string): Promise<void>
window.electronAPI.files.updateFileMetadata(projectId: string, fileId: string, metadata: Partial<FileMetadata>): Promise<void>
```

---

## 10. Implementation Notes

**Folder Expansion:**
- Folders expand/collapse independently
- Expansion state persists in localStorage per project
- Recursive expansion on context menu action

**File Drag-Drop:**
- Drag file onto folder to move
- Supports multi-file selection (future enhancement)

**Metadata Tracking:**
- Last read/write tracked by Holo Audit Service
- Associated with prompt, model, user context
- Displayed in tooltip on file hover

**File Icons:**
- Determined by extension: .ts, .js, .md, .json, .html, etc.
- Folder icon for directories
- Generic file icon for unknown types

**Rename Validation:**
- Prevents empty names
- Validates against duplicate names in same folder
- Prevents special characters in names

---

## 11. Integration Points

| Component | Integration |
|-----------|-------------|
| **ThreadFileView** | Mounted in layout as fifth view type |
| **File Editor** | Opens files for editing (separate component) |
| **Holo Audit Service** | Tracks read/write operations |
| **Project Repository** | Provides file structure and metadata |
| **IPC Layer** | Communicates with Electron file system |

---

**End of Document**
