# Authentication Implementation - SSO Flow Mock

This document explains the authentication implementation in the Holokai Desktop prototype, which demonstrates **Steps 1 and 2** of the SSO flow described in `OPTIONS-COMPARISON-sso.md` (Option 1).

## Overview

The implementation provides a **working mock** of the authentication flow that would be used in production, with secure token storage using Electron's `safeStorage` API.

## Architecture

### Main Process (Electron)

**Location:** `src-electron/`

1. **AuthService** (`services/auth.service.ts`)
   - Handles SSO flow initiation
   - Manages token storage using `safeStorage` (encrypted)
   - Provides mock authentication for testing
   - Never exposes tokens to renderer process

2. **Auth IPC Handler** (`ipc-handlers/auth-handler.ts`)
   - Registers IPC handlers for auth operations
   - Bridges renderer requests to AuthService
   - Ensures tokens never reach renderer

3. **Preload Script** (`preload.ts`)
   - Exposes auth API via Context Bridge
   - Type-safe interface for renderer
   - `AuthAPI`, `UserProfile`, and `AuthState` interfaces

### Renderer Process (Angular)

**Location:** `src/app/`

1. **AuthService** (`core/services/auth.service.ts`)
   - Angular service wrapping Electron auth API
   - Reactive state management with RxJS
   - Observables for auth state changes

2. **Login Component** (`pages/login/`)
   - User-facing authentication UI
   - Mock login buttons for testing
   - SSO flow demonstration

3. **Home Component** (`pages/home/`)
   - Displays authenticated user info
   - Logout functionality
   - Auth guard (redirects to login if not authenticated)

## SSO Flow (Production)

The production flow follows **Option 1** from `OPTIONS-COMPARISON-sso.md`:

### Step 1: Initiate OAuth
```typescript
// User clicks "Sign in with SSO"
authService.startOAuthFlow()
```

Constructs URL:
```
https://moku.holokai.com/auth/desktop?redirect_uri=holokai://callback&state=XXX&code_challenge=YYY
```

### Step 2: Open Browser
```typescript
// Main process opens system browser
shell.openExternal(authUrl)
```

User sees:
- Real Moku web domain with SSL certificate
- Provider options (Microsoft, Google, OAuth2.0)
- Provider's login page

### Step 3-4: User Authenticates
- User selects provider and completes authentication
- Moku web validates credentials
- Moku web redirects to: `holokai://callback?code=XXXX&state=YYYY`

### Step 5: Exchange Code for Tokens
```typescript
// Custom protocol handler captures code
authService.exchangeCode(code, codeVerifier)

// Main process calls Moku API
POST https://moku.holokai.com/api/auth/token
Body: { code: "XXXX", grant_type: "authorization_code" }

// Response contains tokens and user profile
// Tokens stored securely in main process
```

## Mock Implementation (Current)

For development and testing, the implementation includes a **mock flow** that simulates all 5 steps:

```typescript
// One-click mock authentication
await authService.mockLogin('microsoft')
```

This:
1. Simulates network delay (1 second)
2. Generates mock tokens
3. Creates mock user profile
4. Stores in encrypted storage
5. Updates UI state

## Security Features

### Token Storage
- Uses Electron's `safeStorage.encryptString()` for encryption
- Tokens stored only in main process
- Renderer process never receives tokens
- Storage keys: `holokai.auth.tokens`, `holokai.auth.user`

### PKCE Support
- Code verifier and challenge generation
- SHA-256 hashing for challenge
- Prevents authorization code interception

### State Parameter
- Random string for CSRF protection
- Validated on callback

### Context Isolation
- Renderer process sandboxed
- No direct access to Node.js APIs
- All IPC through secure Context Bridge

## API Reference

### Main Process

```typescript
class AuthService {
  // Start OAuth flow (Steps 1-2)
  startOAuthFlow(): Promise<{ authUrl: string }>
  
  // Exchange code for tokens (Step 5)
  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<AuthState>
  
  // Mock login (testing only)
  mockLogin(provider: 'microsoft' | 'google' | 'oauth2'): Promise<AuthState>
  
  // Get current auth state
  getAuthState(): AuthState
  
  // Check if authenticated
  isAuthenticated(): boolean
  
  // Get user profile
  getUser(): UserProfile | null
  
  // Logout
  logout(): Promise<void>
  
  // Refresh token
  refreshToken(): Promise<AuthTokens>
}
```

### Renderer Process

```typescript
class AuthService {
  // Observables
  authState$: Observable<AuthState>
  loading$: Observable<boolean>
  error$: Observable<string | null>
  
  // Methods
  startOAuthFlow(): Promise<{ authUrl: string }>
  exchangeCode(code: string, codeVerifier: string): Promise<void>
  mockLogin(provider: 'microsoft' | 'google' | 'oauth2'): Promise<void>
  isAuthenticated(): Promise<boolean>
  getUser(): Promise<UserProfile | null>
  logout(): Promise<void>
  refreshToken(): Promise<void>
}
```

## Usage Examples

### Login Component

```typescript
// Start production OAuth flow
async onStartOAuthFlow() {
  const result = await this.authService.startOAuthFlow();
  console.log('Browser would open to:', result.authUrl);
  // In production: browser opens automatically
  // User authenticates on Moku web
  // Custom protocol handler calls exchangeCode()
}

// Mock login for testing
async onMockLogin(provider: 'microsoft') {
  await this.authService.mockLogin(provider);
  this.router.navigate(['/home']);
}
```

### Protected Component

```typescript
async ngOnInit() {
  // Check authentication
  const isAuthenticated = await this.authService.isAuthenticated();
  if (!isAuthenticated) {
    this.router.navigate(['/login']);
    return;
  }
  
  // Load user data
  this.currentUser = await this.authService.getUser();
}
```

### Logout

```typescript
async onLogout() {
  await this.authService.logout();
  this.router.navigate(['/login']);
}
```

## Testing

### Run the Application

```bash
# Terminal 1: Start Angular dev server
npm start

# Terminal 2: Start Electron with watch mode
npm run electron:dev
```

### Test Authentication

1. **Mock Login**: Click any "Mock Sign in with [Provider]" button
2. **View User Info**: See authenticated user on home page
3. **Logout**: Click logout button to clear session
4. **Persistence**: Close and reopen app - session persists

### Test OAuth Flow Demo

1. Click "Sign in with SSO" button
2. Check console for OAuth URL and flow explanation
3. In production, browser would open automatically

## Files Created/Modified

### New Files
- `src-electron/services/auth.service.ts` - Main process auth service
- `src-electron/ipc-handlers/auth-handler.ts` - IPC handlers
- `src/app/core/services/auth.service.ts` - Angular auth service
- `src/app/pages/login/login.component.ts` - Login component
- `src/app/pages/login/login.component.html` - Login template
- `src/app/pages/login/login.component.css` - Login styles
- `AUTH_IMPLEMENTATION.md` - This documentation

### Modified Files
- `src-electron/preload.ts` - Added auth API
- `src-electron/main.ts` - Registered auth handlers
- `src/main.ts` - Added login route
- `src/app/pages/home/home.component.ts` - Added auth check and logout
- `src/app/pages/home/home.component.html` - Added user info display
- `src/app/pages/home/home.component.css` - Added user welcome styles

## Production Requirements

To make this production-ready:

1. **Custom Protocol Registration**
   - Register `holokai://` protocol with OS
   - Implement protocol handler in main process

2. **Moku Web Endpoints**
   - `/auth/desktop` - SSO entry point
   - `/api/auth/token` - Token exchange
   - `/api/auth/refresh` - Token refresh
   - `/api/auth/revoke` - Logout

3. **Remove Mock Methods**
   - Remove `mockLogin()` from all services
   - Remove mock login buttons from UI

4. **Environment Configuration**
   - Moku web URL from environment
   - OAuth client ID
   - Redirect URI configuration

5. **Error Handling**
   - Network error recovery
   - Invalid token handling
   - Session expiration handling

6. **Token Refresh**
   - Automatic token refresh before expiry
   - Background refresh on app startup

## Security Considerations

✅ **Implemented:**
- Tokens encrypted with `safeStorage`
- Tokens never exposed to renderer
- Context isolation enabled
- Sandbox enabled
- PKCE support for OAuth
- State parameter for CSRF protection

⚠️ **For Production:**
- Implement token rotation
- Add rate limiting for refresh attempts
- Implement secure token revocation
- Add session timeout
- Implement multi-factor authentication support
- Add audit logging for auth events

## References

- **Architecture**: `ai/analysis/ARCHITECTURE.md`
- **SSO Options**: `ai/analysis/OPTIONS-COMPARISON-sso.md`
- **Electron Security**: https://www.electronjs.org/docs/latest/tutorial/security
- **OAuth 2.0 for Native Apps**: RFC 8252

## Support

For questions or issues:
1. Check the console logs for detailed error messages
2. Review the architecture documentation
3. Test with mock login first before implementing full OAuth
4. Verify `safeStorage.isEncryptionAvailable()` returns true on your platform
