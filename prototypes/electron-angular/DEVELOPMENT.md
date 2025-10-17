# Development Guide

## Important: WSL (Windows Subsystem for Linux) Users

**⚠️ Electron cannot run directly in WSL bash** because it's a GUI application that requires native Windows libraries.

### Solution for WSL Users:

**Use Windows PowerShell or Command Prompt instead:**
```powershell
# Open PowerShell or CMD (not WSL)
cd C:\Projects\repos\holokai\desktop-prototypes\electron-angular
npm run electron:dev
```

**Or use this hybrid approach:**
- **WSL bash**: For Angular-only development with `npm start` (runs in browser at http://localhost:4200)
- **Windows PowerShell/CMD**: For Electron testing with `npm run electron:dev`

If you see an error like `libgbm.so.1: cannot open shared object file`, you're trying to run Electron from WSL. Switch to Windows PowerShell/CMD.

---

## Quick Start

### Recommended: Two-Terminal Approach

This is the most reliable way to develop, especially on Windows:

**Step 1: Install Dependencies**
```bash
cd C:\Projects\repos\holokai\desktop-prototypes\electron-angular
npm install
```

**Step 2: Open Two Terminals**

**Terminal 1 - Angular Dev Server:**
```bash
npm start
```

Wait for the message: `Application bundle generation complete`
The Angular app will be running at http://localhost:4200

**Terminal 2 - Electron:**
```bash
# Build Electron main process (first time only, or after changes)
npm run build:electron

# Start Electron
npm run electron
```

**Now you're ready to develop!**
- Angular changes: Auto-reload in the Electron window (hot reload)
- Electron main process changes: Close Electron and run `npm run electron` again

### Alternative: Automated Mode (Linux/Mac Only)

```bash
npm run electron:dev
```

**Note:** This doesn't work reliably on Windows. Use the two-terminal approach above.

## Development Workflow

### Working on UI (Angular)

If you're only working on the Angular UI without needing Electron features:

```bash
npm start
```

This runs just the Angular dev server in your browser. Electron APIs will not be available, but you can develop the UI faster.

### Working on Electron Integration

To test Electron features (IPC, file system, etc.):

```bash
npm run electron:dev
```

### Debugging

#### Angular DevTools
- In Electron window, the DevTools will open automatically in development mode
- Use `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac) to toggle DevTools

#### Main Process Debugging
Add `console.log` statements in `src-electron/**/*.ts` files. Output appears in the terminal where you ran `npm run electron:dev`.

#### Renderer Process Debugging  
Add `console.log` statements in `src/app/**/*.ts` files. Output appears in the Electron DevTools console.

## Architecture Patterns

### Adding a New Feature

Example: Adding a "Users" feature

1. **Define the API** in `src-electron/preload.ts`:
```typescript
export interface UserAPI {
  getAll: () => Promise<User[]>;
  create: (user: CreateUserData) => Promise<User>;
  // ...
}

// In exposeInMainWorld:
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  user: {
    getAll: () => ipcRenderer.invoke('user:getAll'),
    create: (user) => ipcRenderer.invoke('user:create', user),
    // ...
  } as UserAPI
});
```

2. **Create IPC Handler** in `src-electron/ipc-handlers/user-handler.ts`:
```typescript
export function registerUserHandlers() {
  ipcMain.handle('user:getAll', async () => {
    // Implementation
    return users;
  });

  ipcMain.handle('user:create', async (_event, userData) => {
    // Implementation
    return newUser;
  });
}
```

3. **Register Handler** in `src-electron/main.ts`:
```typescript
import { registerUserHandlers } from './ipc-handlers/user-handler';

function registerIpcHandlers(): void {
  registerThreadHandlers();
  registerSystemHandlers();
  registerUserHandlers(); // Add this
}
```

4. **Create Angular Service** in `src/app/core/services/user.service.ts`:
```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor(private electronService: ElectronService) {}

  async loadUsers(): Promise<void> {
    const users = await this.electronService.api.user.getAll();
    this.usersSubject.next(users);
  }

  async createUser(userData: CreateUserData): Promise<User> {
    return this.electronService.api.user.create(userData);
  }
}
```

5. **Create Page Component** in `src/app/pages/users/`:
```typescript
@Component({
  selector: 'app-users',
  // ...
})
export class UsersComponent implements OnInit {
  users$ = this.userService.users$;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.userService.loadUsers();
  }
}
```

6. **Add Route** in `src/main.ts`:
```typescript
const routes: Routes = [
  {
    path: '',
    component: AppLayout,
    children: [
      // ... existing routes
      { path: 'users', component: UsersComponent }
    ]
  }
];
```

7. **Add Navigation Item** in `src/app/layout/components/navbar.component.ts`:
```typescript
navigationItems = [
  // ... existing items
  {
    label: 'Users',
    icon: 'pi pi-users',
    route: '/users'
  }
];
```

### Event Broadcasting Pattern

For real-time updates across windows:

**Main Process** (`src-electron/ipc-handlers/user-handler.ts`):
```typescript
function broadcast(channel: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send(channel, ...args);
  });
}

ipcMain.handle('user:create', async (_event, userData) => {
  const newUser = createUser(userData);
  broadcast('user:created', newUser); // Broadcast to all windows
  return newUser;
});
```

**Preload** (`src-electron/preload.ts`):
```typescript
user: {
  // ...
  onUserCreated: (callback: (user: User) => void) => {
    const subscription = (_event, user) => callback(user);
    ipcRenderer.on('user:created', subscription);
    return () => ipcRenderer.removeListener('user:created', subscription);
  }
}
```

**Service** (`src/app/core/services/user.service.ts`):
```typescript
constructor(private electronService: ElectronService) {
  const cleanup = this.electronService.api.user.onUserCreated((user) => {
    const currentUsers = this.usersSubject.value;
    this.usersSubject.next([...currentUsers, user]);
  });
  this.cleanupFunctions.push(cleanup);
}
```

## TypeScript Configuration

- `tsconfig.json` - Base TypeScript config
- `tsconfig.app.json` - Angular app TypeScript config
- `tsconfig.electron.json` - Electron main process config

## Building for Production

```bash
# Build everything
npm run build:prod

# Package as executable
npm run package
```

This creates installers in the `release/` directory.

## Common Issues

### "electronAPI is not defined"

You're likely running in browser mode (`npm start`). Use `npm run electron:dev` to run in Electron.

### Changes not reflecting

- For Angular changes: They should hot-reload automatically
- For Electron main process changes: Restart `npm run electron:dev`
- If stuck, delete `dist/` and `dist-electron/` folders and restart

### Port 4200 already in use

Stop any other Angular dev servers running on port 4200, or modify the port in `angular.json`.

## Code Style

- Use TypeScript strict mode
- Prefer `async/await` over callbacks
- Use RxJS for reactive state management
- Follow Angular style guide for components
- Add JSDoc comments to complex functions
- Keep IPC handlers focused and single-purpose

## Testing

Currently, this is a prototype without tests. In a production app, you should add:

- Unit tests for services using Jasmine/Karma
- E2E tests for Electron using Spectron or Playwright
- Mock the Electron API for testing components

## Security Checklist

✓ Node integration disabled  
✓ Context isolation enabled  
✓ Remote module disabled  
✓ Secure IPC via context bridge  
✓ No `eval()` or similar dangerous functions  
✓ Validate all IPC inputs  
✓ Use prepared statements for database queries  
✓ Sanitize user inputs before displaying

## Performance Tips

- Use OnPush change detection for better performance
- Lazy load routes when app grows
- Use virtual scrolling for large lists (PrimeNG VirtualScroller)
- Debounce expensive operations
- Use Web Workers for heavy computations
- Profile with Angular DevTools

## Resources

- [Electron Security Best Practices](https://www.electronjs.org/docs/tutorial/security)
- [Angular Best Practices](https://angular.io/guide/styleguide)
- [PrimeNG Documentation](https://primeng.org)
- [RxJS Documentation](https://rxjs.dev)
