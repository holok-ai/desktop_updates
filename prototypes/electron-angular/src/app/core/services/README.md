# MenuNavigationService

## Overview

The `MenuNavigationService` is a centralized service that handles all Electron menu commands and translates them into Angular Router navigation. This service acts as an "interceptor" between menu events from the main process and Angular routing, ensuring that components remain completely menu-agnostic.

## Architecture Pattern

```
Electron Menu Click (Main Process)
    ↓
webContents.send('menu:command')
    ↓
Context Bridge (Preload)
    ↓
MenuNavigationService listens
    ↓
Translates to Router navigation
    ↓
Component activates (via ngOnInit)
    ↓
Component has NO menu-specific code!
```

## Key Benefits

✅ **Separation of Concerns**: Menu logic separate from component logic  
✅ **Menu-Agnostic Components**: Components work in any context (web, Electron, tests)  
✅ **Centralized Menu Handling**: All menu logic in one service  
✅ **Easy Testing**: Components don't need to mock menu events  
✅ **Maintainability**: Menu changes don't affect components  

## Usage

### 1. Service is Auto-Initialized

The service is automatically initialized at app startup via `APP_INITIALIZER` in `main.ts`. No manual initialization is needed.

```typescript
// main.ts - Already configured
{
  provide: APP_INITIALIZER,
  useFactory: (menuNavigationService: MenuNavigationService) => () => {},
  deps: [MenuNavigationService],
  multi: true
}
```

### 2. Components Remain Simple

Components don't need to listen to menu events. They just load data in `ngOnInit()`:

```typescript
@Component({ ... })
export class ThreadListComponent implements OnInit {
  threads: Thread[] = [];
  loading = false;

  constructor(private threadService: ThreadService) {}

  ngOnInit() {
    // Simple: Just load data
    // Works for both route navigation AND menu commands
    this.loadThreads();
  }

  async loadThreads() {
    this.loading = true;
    this.threads = await this.threadService.getThreads();
    this.loading = false;
  }
}
```

### 3. Menu Commands Trigger Navigation

When a user clicks a menu item, MenuNavigationService handles it:

**Scenario 1: Navigate to new route**
```
User clicks "File → Get Threads"
    ↓
MenuNavigationService: router.navigate(['/threads'])
    ↓
Component created
    ↓
ngOnInit() loads data
```

**Scenario 2: Refresh current route**
```
User already on /threads, clicks "File → Refresh"
    ↓
MenuNavigationService: reloadCurrentRoute()
    ↓
Component destroyed and recreated
    ↓
ngOnInit() loads fresh data
```

## Adding New Menu Handlers

To add a new menu command handler:

### 1. Update Context Bridge (Preload)

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('electron', {
  menu: {
    // Existing handlers...
    onGetThreads: (callback: () => void) => {
      ipcRenderer.on('menu:get-threads', () => callback());
      return () => ipcRenderer.removeListener('menu:get-threads', callback);
    },
    
    // NEW: Add your handler
    onOpenSettings: (callback: () => void) => {
      ipcRenderer.on('menu:open-settings', () => callback());
      return () => ipcRenderer.removeListener('menu:open-settings', callback);
    }
  }
});
```

### 2. Update MenuNavigationService

```typescript
// menu-navigation.service.ts
private setupFileMenuHandlers(): void {
  // Existing handlers...
  
  // NEW: Add your handler
  window.electron.menu.onOpenSettings(() => {
    this.router.navigate(['/settings']);
  });
}
```

### 3. Main Process Menu

```typescript
// main/menu.ts
{
  label: 'Settings',
  accelerator: 'CmdOrCtrl+,',
  click: () => {
    mainWindow.webContents.send('menu:open-settings');
  }
}
```

That's it! Your component doesn't need any changes.

## Advanced Patterns

### Passing State to Components

Use router state to pass data when needed:

```typescript
// MenuNavigationService
window.electron.menu.onNewThread(() => {
  this.router.navigate(['/threads'], {
    state: { openCreateDialog: true }
  });
});

// Component
constructor(private router: Router) {
  const nav = this.router.getCurrentNavigation();
  if (nav?.extras?.state?.['openCreateDialog']) {
    this.displayCreateDialog = true;
  }
}
```

### Smart Navigation (Navigate or Refresh)

```typescript
private navigateOrRefresh(path: string): void {
  if (this.router.url === path) {
    // Already there - refresh
    this.reloadCurrentRoute();
  } else {
    // Navigate to new route
    this.router.navigate([path]);
  }
}
```

### Programmatic Menu Actions

In rare cases, components can trigger menu actions programmatically:

```typescript
constructor(private menuNav: MenuNavigationService) {}

onButtonClick() {
  // Simulate "File → Get Threads" menu click
  this.menuNav.triggerGetThreads();
}
```

## Design Principles

### Components Should Be Trigger-Agnostic

A component should work identically whether activated by:
- Angular route navigation
- Electron menu command
- Deep link (custom protocol)
- Programmatic navigation
- Test environment

**Bad Pattern ❌:**
```typescript
ngOnInit() {
  if (activatedByMenu) {
    this.loadDataFromMenu();
  } else if (activatedByRoute) {
    this.loadDataFromRoute();
  }
}
```

**Good Pattern ✅:**
```typescript
ngOnInit() {
  this.loadData(); // Works for all activation sources
}
```

### Single Responsibility

- **MenuNavigationService**: Menu → Router translation
- **Router**: Route management and component activation
- **Component**: Display data and handle user interaction
- **Service**: Data fetching via IPC

Don't mix these concerns.

### Menu Commands ≠ IPC Calls

Menu commands should trigger **navigation**, not directly call IPC handlers.

**Bad Pattern ❌:**
```typescript
window.electron.menu.onGetThreads(() => {
  // Don't load data directly from menu service
  const threads = await window.electron.threads.getAll();
  // Where do we put this data?
});
```

**Good Pattern ✅:**
```typescript
window.electron.menu.onGetThreads(() => {
  // Just navigate - component will load data
  this.router.navigate(['/threads']);
});
```

## Troubleshooting

### Menu command not working

1. Check main process menu is sending event: `webContents.send('menu:command')`
2. Check preload has listener: `window.electron.menu.onCommand()`
3. Check MenuNavigationService is registered: Look for "Initializing menu handlers" in console
4. Check router configuration allows same-route reload: `onSameUrlNavigation: 'reload'`

### Component loads twice

This can happen if menu both navigates AND sends signal. Solution:

```typescript
// Menu should check current route
if (currentRoute === targetRoute) {
  send('menu:refresh'); // Just refresh signal
} else {
  send('menu:navigate', targetRoute); // Navigate (no extra signal)
}
```

### Menu state out of sync

Send current route to main process after navigation:

```typescript
// app.component.ts
this.router.events
  .pipe(filter(e => e instanceof NavigationEnd))
  .subscribe((e: NavigationEnd) => {
    window.electron.navigation.setCurrentRoute(e.url);
  });
```

## Testing

Components remain easy to test because they don't depend on menu events:

```typescript
describe('ThreadListComponent', () => {
  it('should load threads on init', async () => {
    const component = TestBed.createComponent(ThreadListComponent);
    component.ngOnInit();
    
    // No need to mock menu events!
    expect(component.threads.length).toBeGreaterThan(0);
  });
});
```

To test MenuNavigationService:

```typescript
describe('MenuNavigationService', () => {
  it('should navigate to threads on menu command', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    
    // Simulate menu event
    window.electron.menu.onGetThreads.simulateCall();
    
    expect(router.navigate).toHaveBeenCalledWith(['/threads']);
  });
});
```

## Related Documentation

- [Architecture Overview](../../../desktop/ai/analysis/architecture.md) - Section 5.2
- [Angular Router Documentation](https://angular.dev/guide/routing)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
