# Authentication Test Key E2E Test

## Overview
Simple test to verify authentication using the test key mechanism with `PLAYWRIGHT_TEST_TOKENS`.

## What This Test Does

1. **Launches Electron app** with `PLAYWRIGHT_TEST_TOKENS` environment variable set
2. **Waits for page load** and checks current location
3. **Handles two scenarios:**
   - If on login page → clicks "Login With Key" button
   - If already authenticated → verifies home page content
4. **Verifies authentication** by checking:
   - Threads and Projects navigation items are visible
   - `isAuthenticated()` returns true
   - User profile matches test data

## Running the Test

### Prerequisites
- Electron app must be built: `npm run build:prod`
- Test uses hardcoded tokens (valid until 2035)

### Command
```bash
# Run just this test
npx playwright test tests/e2e/auth-test-key.spec.ts

# Run with headed mode to see what's happening
npx playwright test tests/e2e/auth-test-key.spec.ts --headed

# Run with debug mode
npx playwright test tests/e2e/auth-test-key.spec.ts --debug
```

## Expected Output

```
Running 1 test using 1 worker

[Test] Current URL: file:///C:/Projects/repos/holokai/desktop/dist/index.html#/
[Test] Already authenticated - not on login page
[Test] ✓ Successfully authenticated with test key
[Test] ✓ isAuthenticated() returned true
[Test] Auth state: { isAuthenticated: true, userName: 'Peter Baxter' }

  ✓ 1 auth-test-key.spec.ts:56:3 › Auth with Test Key › should authenticate with test key and access home page (2s)

  1 passed (3s)
```

## How It Works

### 1. Test Tokens Loaded at Startup
```typescript
env: {
  PLAYWRIGHT_TEST_TOKENS: testTokens,
}
```

### 2. AuthService Loads Tokens
- `AuthService.constructor()` calls `loadTestTokens()`
- Tokens stored in-memory only (not encrypted storage)

### 3. Frontend Syncs Auth State
- `App.svelte` calls `getAuthState()` on mount
- Updates `authStore` with test tokens
- Login page auto-redirects if authenticated

### 4. Fallback: "Login With Key" Button
- If race condition occurs, button provides manual sync
- Re-fetches auth state from backend
- Updates frontend store and redirects

## Test Structure

```typescript
test('should authenticate with test key and access home page', async () => {
  // 1. Get app window
  const page = await getFirstWindow(app);

  // 2. Handle login page if present
  if (currentUrl.includes('#/login')) {
    await keyButton.click();
  }

  // 3. Verify authenticated UI elements
  await expect(page.getByRole('menuitem', { name: 'Threads' })).toBeVisible();

  // 4. Verify auth state via IPC
  const authState = await page.evaluate(async () => {
    return await window.electronAPI.auth.getAuthState();
  });

});
```

## Troubleshooting

### Test fails with "Login With Key button not found"
- Check that the button exists in the login page
- Verify app is on login page (check URL in console output)

### Test fails with "Threads menuitem not visible"
- Authentication didn't work - check logs
- Verify test tokens are valid (not expired)
- Check that PLAYWRIGHT_TEST_TOKENS is being passed correctly

### Authentication not working
- Verify test tokens are valid (not expired)
- Check that PLAYWRIGHT_TEST_TOKENS is being passed correctly
- Check AuthService logs for "Test tokens loaded successfully (TEST MODE)"

## Related Files

- `tests/e2e/auth-test-key.spec.ts` - This test file
- `src-electron/services/auth.service.ts` - Contains `loadTestTokens()` method
- `src/routes/login/+page.svelte` - Login page with "Login With Key" button
- `src/App.svelte` - Loads initial auth state on startup

## Security Note

The test tokens are hardcoded for convenience but:
- Only work in test environment
- Do not overwrite real user credentials
- Exist in-memory only when `PLAYWRIGHT_TEST_TOKENS` is set
- Real tokens remain in encrypted storage untouched
