# E2E Test: Authentication with Test Tokens

## Overview

Simple test to verify authentication using the centralized test token mechanism with `PLAYWRIGHT_TEST_TOKENS`.

## What This Test Does

1. **Launches Electron app** with `PLAYWRIGHT_TEST_TOKENS` environment variable set (via `launchAuthenticatedApp()`)
2. **Waits for page load** and checks current location
3. **Verifies authentication** by checking:
   - Navigation items are visible (Home, Threads, Projects)
   - `verifyAuthenticated()` returns true
   - Auth state contains correct user information
   - Test mode flag is set (`isTestMode: true`)

## Key Changes from Previous Version

### Before (Old Implementation)

- Hardcoded Peter Baxter's tokens directly in test file
- Manual Electron launch with custom environment setup
- Manual login flow handling (clicking "Login With Key" button)
- Duplicated authentication logic

### After (Current Implementation)

- Uses centralized `launchAuthenticatedApp()` fixture
- Uses Kong Pham's tokens from `tests/fixtures/electron-auth.ts`
- Automatic authentication (no UI interaction needed)
- Reuses helper functions (`getFirstWindow`, `verifyAuthenticated`)
- Consistent with other E2E tests

## Test Token Configuration

Test tokens are defined in `tests/fixtures/electron-auth.ts`:

```typescript
export const TEST_TOKENS = {
  accessToken: 'eyJhbGci...', // Valid for http://moku.holokai.dev
  apiKey: 'eyJhbGci...', // Valid for http://moku.holokai.dev
  user: {
    id: '19451f75-d9f6-4da2-b17b-af3b649e6fe8',
    email: 'kong.pham@nkk.com.vn',
    name: 'Kong Pham',
    organizationId: '00000000-0000-0000-0000-000000000001',
  },
  expiresAt: 2084776367000, // 2036
};
```

## Running the Test

```bash
# Run this specific test
npm run test:e2e -- tests/e2e/auth-test-key.spec.ts

# Run with debug output
DEBUG=pw:api npm run test:e2e -- tests/e2e/auth-test-key.spec.ts
```

## Expected Behavior

### Success Flow

1. ✅ App launches with test tokens injected
2. ✅ Authentication happens automatically (no login UI)
3. ✅ Navigation items appear in sidebar
4. ✅ `verifyAuthenticated()` returns true
5. ✅ Auth state shows:
   - `isAuthenticated: true`
   - `isTestMode: true`
   - `user.name: "Kong Pham"`
   - `user.email: "kong.pham@nkk.com.vn"`

### Console Output

```
[Test] App launched with test tokens
[Test] Current URL: file:///.../index.html#/home
[Test] Navigating to Threads to verify authentication
[Test] ✓ Navigation items visible
[Test] ✓ verifyAuthenticated() returned true
[Test] Auth state: {
  isAuthenticated: true,
  userName: 'Kong Pham',
  userEmail: 'kong.pham@nkk.com.vn',
  isTestMode: true
}
[Test] ✓ Successfully authenticated with test tokens
```

## Troubleshooting

### Test fails with "Navigation items not visible"

**Cause:** Test tokens are invalid or expired.

**Solution:**

1. Generate fresh tokens from `http://moku.holokai.dev`
2. Update `tests/fixtures/electron-auth.ts`
3. See `tests/e2e/README-environment-config.md` for details

### Test fails with "isTestMode: false"

**Cause:** `PLAYWRIGHT_TEST_TOKENS` environment variable not set correctly.

**Solution:**

- Verify `launchAuthenticatedApp()` is being used
- Check that `TEST_TOKENS` are defined in fixture
- Ensure no environment variable override

### Wrong user name/email in auth state

**Cause:** Test tokens don't match expected user.

**Solution:**

- Update test expectations to match tokens in fixture
- Or update tokens in fixture to match test expectations

## Architecture

### How It Works

```
Test starts
  ↓
launchAuthenticatedApp() from tests/fixtures/electron-auth.ts
  ↓
Sets PLAYWRIGHT_TEST_TOKENS + MOKU_API_URL env vars
  ↓
Electron launches with test environment
  ↓
AuthService.loadTestTokens() reads PLAYWRIGHT_TEST_TOKENS
  ↓
Sets auth state with isTestMode: true
  ↓
App starts authenticated (no login needed)
  ↓
Test verifies authentication state
```

### Code Flow

```
tests/e2e/auth-test-key.spec.ts
  ↓ calls launchAuthenticatedApp()
tests/fixtures/electron-auth.ts
  ↓ sets PLAYWRIGHT_TEST_TOKENS from TEST_TOKENS
src-electron/services/auth.service.ts
  ↓ loadTestTokens() reads process.env.PLAYWRIGHT_TEST_TOKENS
  ↓ sets currentAuthState.isTestMode = true
App launches authenticated
```

## Related Files

- `tests/fixtures/electron-auth.ts` - Centralized authentication fixture
- `src-electron/services/auth.service.ts` - Test token loading logic
- `tests/e2e/README-environment-config.md` - Environment configuration guide
- `docs/issues/e2e-chat-test-token-fix.md` - Token troubleshooting guide

## Security Note

**Test tokens are for development/testing only:**

- Valid for `http://moku.holokai.dev` environment
- Should NOT be production tokens
- Expire in 2036 (long-lived for convenience)
- Only work when `PLAYWRIGHT_TEST_TOKENS` is set
