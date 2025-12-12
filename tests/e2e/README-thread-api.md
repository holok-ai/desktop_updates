# Thread API E2E Test

## Overview
This E2E test verifies that thread creation and listing works end-to-end with the real Moku API backend using pre-seeded authentication tokens.

## Test Coverage
1. **Create thread via API** - Creates a thread through the Electron app which calls the real Moku API
2. **Verify in thread list** - Confirms the thread appears in both API response and UI
3. **Thread with metadata** - Tests creating threads with custom description and tags
4. **Cleanup** - Deletes test threads after verification

## Setup

### 1. Obtain Valid Authentication Tokens

You need a valid access token for the Moku API. You can obtain this by:

**Option A: Extract from logged-in Desktop app**
1. Launch the Desktop app normally and log in
2. Open DevTools (`Ctrl+Shift+I` or `F12`)
3. Go to Console tab
4. Run: `await window.electronAPI.auth.getAuthState()`
5. Copy the `accessToken` value (and optionally `user` profile)

**Option B: Use API directly** (if you have credentials)
1. Authenticate with the Moku API using your credentials
2. Extract the access token from the response

### 2. Set Environment Variable

Create a `.env.test` file or set the environment variable:

```bash
# Windows PowerShell
$env:PLAYWRIGHT_TEST_TOKENS='{"accessToken":"your-token-here","user":{"id":"user-id","email":"test@example.com","name":"Test User"},"expiresAt":1735689600000}'

# Windows CMD
set PLAYWRIGHT_TEST_TOKENS={"accessToken":"your-token-here","user":{"id":"user-id","email":"test@example.com","name":"Test User"},"expiresAt":1735689600000}

# Linux/Mac
export PLAYWRIGHT_TEST_TOKENS='{"accessToken":"your-token-here","user":{"id":"user-id","email":"test@example.com","name":"Test User"},"expiresAt":1735689600000}'
```

**Token Format:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "apiKey": "optional-api-key-for-refresh",
  "user": {
    "id": "user-123",
    "email": "test@example.com",
    "name": "Test User",
    "organizationId": "org-456"
  },
  "expiresAt": 1735689600000
}
```

**Required fields:**
- `accessToken` - Valid JWT token for Moku API
- `user.id` - User ID
- `user.email` - User email
- `user.name` - User name

**Optional fields:**
- `apiKey` - API key for token refresh
- `user.organizationId` - Organization ID
- `expiresAt` - Token expiration timestamp (defaults to 24h from now if not provided)

## Running the Test

### Prerequisites
- Electron app must be built: `npm run build:prod`
- Valid `PLAYWRIGHT_TEST_TOKENS` environment variable set
- Moku API must be accessible

### Command
```bash
# Set environment variable first, then run test
npm run test:e2e tests/e2e/thread-api.spec.ts
```

Or directly with Playwright:
```bash
npx playwright test tests/e2e/thread-api.spec.ts
```

### What Happens

1. Test launches Electron app with `PLAYWRIGHT_TEST_TOKENS` in environment
2. AuthService automatically loads tokens from environment variable
3. App starts in authenticated state (no login required!)
4. Test verifies authentication
5. Test creates threads via real Moku API
6. Test verifies threads in UI
7. Test cleans up by deleting test threads

**No manual interaction required!**

## Expected Output

```
Thread API E2E
  ✓ Authenticated successfully via test tokens
  ✓ should create thread via API and verify in thread list (5-8s)
  ✓ should handle thread creation with metadata (3-5s)

Test Files  1 passed (1)
     Tests  2 passed (2)
```

## Troubleshooting

### "PLAYWRIGHT_TEST_TOKENS environment variable is required"
- Make sure you set the environment variable before running the test
- Check that the JSON is valid (use a JSON validator)
- Ensure quotes are properly escaped for your shell

### "Authentication failed"
- Verify the access token is valid and not expired
- Check that the token has the correct format (JWT)
- Ensure the Moku API URL is correct
- Test the token manually: `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.holok.ai/api/threads`

### Thread creation fails with 401
- Token is expired - generate a new one
- Token doesn't have necessary permissions
- Moku API URL is incorrect

### Thread creation fails with network error
- Verify Moku API is running and accessible
- Check network connectivity
- Verify firewall settings

### Token expires during test
- Set a longer `expiresAt` value in the token JSON
- Use a fresh token before running tests
- Consider using `apiKey` for automatic token refresh

## Security Notes

**IMPORTANT:** Never commit actual tokens to version control!

- Add `.env.test` to `.gitignore`
- Use different tokens for testing vs production
- Rotate tokens regularly
- Consider using short-lived tokens for E2E tests
- Use environment variables or secrets management in CI/CD

## CI/CD Integration

For automated testing in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run E2E Tests
  env:
    PLAYWRIGHT_TEST_TOKENS: ${{ secrets.PLAYWRIGHT_TEST_TOKENS }}
  run: npm run test:e2e tests/e2e/thread-api.spec.ts
```

Store the token JSON in your CI/CD secrets management system.

## How It Works

### Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Test sets PLAYWRIGHT_TEST_TOKENS env var             │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 2. Electron app launches with env var                   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 3. AuthService.constructor() runs                       │
│    ├─ loadStoredAuth() (checks encrypted storage)      │
│    └─ loadTestTokens() (reads PLAYWRIGHT_TEST_TOKENS)  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 4. Test tokens loaded into auth state                   │
│    ├─ accessToken set                                   │
│    ├─ user profile set                                  │
│    └─ isAuthenticated = true                            │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 5. App renders in authenticated state                   │
│    (Threads and Projects visible in sidebar)            │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 6. Test execution begins                                │
│    ├─ Verify auth state                                 │
│    ├─ Create threads                                    │
│    ├─ Verify in UI                                      │
│    └─ Cleanup                                           │
└──────────────────────────────────────────────────────────┘
```

### Why This Approach?

**Advantages:**
- ✅ No manual interaction required
- ✅ Fully automated E2E testing
- ✅ Works in CI/CD pipelines
- ✅ Bypasses encryption/protocol handler issues
- ✅ Tests with real API authentication
- ✅ Fast test execution

**Trade-offs:**
- ⚠️ Requires valid tokens to be managed
- ⚠️ Tokens can expire
- ⚠️ Not testing the actual OAuth flow (tested separately)

## Related Files

- `src-electron/services/auth.service.ts` - Contains `loadTestTokens()` method
- `tests/e2e/thread-api.spec.ts` - The E2E test implementation
- `src-electron/services/mokuapi/thread-api.service.ts` - Thread API service
- `src-electron/repository/thread-repository.ts` - Thread repository with API integration
