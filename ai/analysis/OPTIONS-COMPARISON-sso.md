# Desktop SSO Options - Comparison Analysis

**Project:** Holokai AI Desktop Client  
**Date:** October 15, 2025  
**Purpose:** Compare SSO integration strategies for desktop authentication

---

## Table of Contents

1. [Option 1: Desktop SSO Using Moku Web](#option-1-desktop-sso-using-moku-web)
2. [Option 2: Desktop SSO with Custom Protocol](#option-2-desktop-sso-with-custom-protocol)
3. [Option 3: Desktop SSO with Browser Authentication](#option-3-desktop-sso-with-browser-authentication)
4. [Comparison Matrix](#comparison-matrix)
5. [Recommendation](#recommendation)

---

## Option 1: Desktop SSO Using Moku Web

### Overview

The desktop application delegates all authentication to the existing Moku web SSO system. This allows users to sign in using their Microsoft, Google, or standard OAuth2.0 accounts through the familiar web interface, while the desktop app receives authentication tokens via a secure callback mechanism.

### Authentication Flow

**Step 1: Initiate Authentication**
Desktop app constructs a URL to Moku web's SSO endpoint with a custom redirect URI:
```
https://moku.holokai.com/auth/desktop?redirect_uri=holokai://callback
```

**Step 2: Open System Browser**
Main process uses Electron's `shell.openExternal()` to launch the URL in the user's default browser. This ensures the user sees the real Moku web domain and can verify SSL certificates.

**Step 3: User Authentication on Moku Web**
User is presented with Moku web's existing SSO page showing Microsoft, Google, and OAuth2.0 options. User selects their preferred provider and completes authentication flow entirely within the browser. Moku web backend handles all provider-specific OAuth flows, token exchange, and session creation.

**Step 4: Token Generation**
After successful authentication, Moku web backend generates a desktop-specific authorization code and access/refresh token pair. These tokens are associated with the authenticated user's session and have appropriate scopes for desktop app access.

**Step 5: Redirect to Custom Protocol**
Moku web redirects the browser to:
```
holokai://callback?code=XXXX&state=YYYY
```

**Step 6: Desktop Protocol Handler**
Electron's custom protocol handler (registered during app startup) intercepts the redirect. The main process extracts the authorization code from the URL parameters.

**Step 7: Token Exchange**
Desktop app makes server-to-server call to Moku web's token endpoint:
```
POST https://moku.holokai.com/api/auth/token
{ "code": "XXXX", "grant_type": "authorization_code" }
```

Moku backend validates the code and returns access token, refresh token, and user profile.

**Step 8: Secure Storage**
Main process stores tokens in Electron's `safeStorage` encrypted storage. User profile data is passed to renderer process via IPC, triggering AuthStore update and navigation to main app.

### Moku Web Requirements

**New Endpoint: `/auth/desktop`**
Moku web needs a desktop-specific authentication entry point that:
- Accepts `redirect_uri` parameter (must be `holokai://callback`)
- Displays existing SSO options (Microsoft, Google, OAuth2.0)
- Validates redirect_uri is registered for desktop app
- After authentication, generates authorization code
- Redirects to `holokai://callback?code=XXXX`

**New Endpoint: `/api/auth/token`**
Token exchange endpoint that:
- Accepts authorization code from desktop app
- Validates code hasn't been used (single-use)
- Returns access_token, refresh_token, expires_in, user profile
- Uses same token format as web app for API consistency

**New Endpoint: `/api/auth/refresh`**
Token refresh endpoint that:
- Accepts refresh_token
- Returns new access_token
- Rotates refresh_token (optional but recommended)

**Desktop App Registration**
Moku web backend needs configuration for desktop app:
- Client ID for desktop application
- Allowed redirect URIs: `holokai://callback`
- Token expiration policies
- Scopes: same as web app or subset

### Custom Protocol Registration

**Windows:**
Registry entries created during installation via electron-builder.

**macOS:**
Info.plist configuration declares custom URL scheme in app bundle.

**Linux:**
Desktop entry file registers custom protocol handler with system.

### Security Considerations

**State Parameter:**
Desktop app should generate and validate state parameter to prevent CSRF attacks. State is random string stored temporarily in main process, sent to Moku web, and validated on callback.

**Code Challenge (PKCE):**
Even though Moku web handles OAuth, desktop can add PKCE:
- Generate code_verifier, compute code_challenge
- Send code_challenge to `/auth/desktop`
- Send code_verifier to `/api/auth/token`
- Moku backend validates challenge matches verifier

**Token Security:**
- Access tokens short-lived (15-60 minutes)
- Refresh tokens long-lived (days/weeks) but can be revoked
- All tokens encrypted in Electron safeStorage
- Tokens never exposed to renderer process

**Browser Trust:**
User sees real Moku web URL in browser address bar. SSL certificate visible and verifiable. No embedded browser or webview that could be spoofed.

### Error Handling

**Authentication Cancelled:**
If user closes browser without completing auth, desktop app shows timeout message after 5 minutes. User can retry authentication.

**Network Errors:**
If token exchange fails, desktop app shows error and allows retry. Logs error details for debugging.

**Invalid Tokens:**
If token refresh fails (revoked or expired), desktop forces re-authentication through full SSO flow.

**Moku Web Unavailable:**
If Moku web is down, desktop app shows meaningful error message directing user to status page or support.

### Session Management

**Persistent Sessions:**
Refresh tokens stored in secure storage allow users to remain signed in across app restarts. Desktop app automatically refreshes access token on startup if refresh token valid.

**Multi-Device:**
User can be signed in on multiple devices. Each device has its own token pair. Moku backend tracks active sessions per user.

**Logout:**
Desktop logout makes API call to Moku web to revoke tokens, then clears local storage and shows login screen.

**Forced Logout:**
Moku web can revoke tokens server-side (security incident, password change). Desktop app detects this on next API call (401 response) and forces re-authentication.

### Advantages

✅ **Single Source of Truth:** All authentication logic, provider integrations, and user management centralized in Moku web. Desktop doesn't duplicate OAuth flows.

✅ **Consistent User Experience:** Users see same SSO interface on desktop and web. No learning curve.

✅ **Security:** Sensitive operations (OAuth client secrets, token validation) happen server-side. Desktop never handles provider credentials.

✅ **Easier Maintenance:** Adding new SSO providers (SAML, LDAP, etc.) only requires Moku web changes. Desktop automatically supports them.

✅ **Centralized Session Management:** Admins can view/revoke sessions from single location. Audit logs unified.

✅ **No Embedded Browser:** Uses system browser, avoiding security issues with embedded webviews.

### Disadvantages

❌ **Requires Browser:** User must have functional browser. May be jarring to switch contexts.

❌ **Moku Web Dependency:** Desktop authentication requires Moku web to be available. Offline authentication not possible.

❌ **Backend Changes Required:** Moku web needs new endpoints and desktop app registration.

❌ **Protocol Registration:** Custom protocol must be registered with OS, which can occasionally fail or be blocked by security software.

### Implementation Complexity

**Desktop App:** Medium - Custom protocol handling, token management, IPC communication.

**Moku Web Backend:** Medium - New endpoints, desktop client registration, authorization code flow.

**Testing Effort:** Medium - Must test all SSO providers, error scenarios, and cross-platform protocol registration.

---

## Option 2: Desktop SSO with Custom Protocol

### Overview

Desktop application implements full OAuth flows directly within the app using an embedded browser (BrowserWindow) or system browser with deep linking. Each SSO provider (Microsoft, Google, OAuth2.0) is integrated separately in the desktop app with provider-specific OAuth configurations.

### Authentication Flow

**Step 1: Provider Selection**
User selects authentication provider from desktop app UI (Microsoft, Google, or custom OAuth2.0).

**Step 2: OAuth URL Construction**
Desktop app constructs provider-specific OAuth URL with:
- Client ID (desktop-specific, registered with each provider)
- Redirect URI using custom protocol (`holokai://callback`)
- Scopes requested
- State parameter for CSRF protection
- PKCE code_challenge

**Step 3: Browser Launch**
Desktop opens system browser or embedded BrowserWindow with OAuth URL.

**Step 4: Provider Authentication**
User authenticates directly with provider (Microsoft login, Google login, etc.). Provider redirects to `holokai://callback?code=XXX` upon success.

**Step 5: Protocol Callback**
Desktop protocol handler intercepts redirect and extracts authorization code.

**Step 6: Token Exchange**
Desktop app makes direct API call to provider's token endpoint:
- Microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- Google: `https://oauth2.googleapis.com/token`
- Custom: Provider-specific token endpoint

**Step 7: User Profile Fetch**
Desktop makes additional API call to fetch user profile from provider.

**Step 8: Moku API Registration**
Desktop sends provider token and user profile to Moku API for user registration/linking:
```
POST https://moku.holokai.com/api/users/link-provider
{ "provider": "microsoft", "token": "...", "profile": {...} }
```

**Step 9: Moku Session**
Moku API validates provider token, creates or links user account, returns Moku access/refresh tokens.

### Provider Configuration Requirements

**Microsoft OAuth:**
- App registration in Azure AD
- Client ID and client secret (or use PKCE for public client)
- Redirect URI: `holokai://callback`
- Scopes: `openid profile email User.Read`

**Google OAuth:**
- OAuth 2.0 Client ID in Google Cloud Console
- Desktop app type (no client secret with PKCE)
- Redirect URI: `holokai://callback`
- Scopes: `openid profile email`

**Custom OAuth2.0:**
- Configuration UI for users to input:
  - Authorization endpoint
  - Token endpoint
  - Client ID and secret
  - Scopes
  - User info endpoint

### Security Considerations

**Client Secrets:**
For native apps, use PKCE flow without client secrets. If secrets required, they must be stored securely but are always at risk in desktop apps.

**Token Storage:**
Provider tokens and Moku tokens both stored in Electron safeStorage.

**Provider Trust:**
User must trust each provider's login page. System browser shows real provider domain.

### Advantages

✅ **No Moku Web Dependency:** Authentication works even if Moku web is down (until Moku API call).

✅ **Direct Provider Integration:** Can leverage provider-specific features and APIs.

✅ **Flexible Provider Configuration:** Users can add custom OAuth2.0 providers without backend changes.

### Disadvantages

❌ **Multiple Provider Integrations:** Must implement and maintain separate OAuth flow for each provider.

❌ **Client Secret Management:** Secrets in desktop app are never truly secure.

❌ **Duplicate Logic:** Authentication code duplicated between web and desktop.

❌ **Provider Changes:** Breaking changes in provider APIs require desktop app updates.

❌ **Limited Provider Options:** Adding new providers (SAML, LDAP) requires desktop app changes.

❌ **Complex Error Handling:** Must handle provider-specific errors and edge cases.

❌ **Testing Complexity:** Must test each provider separately across all platforms.

### Implementation Complexity

**Desktop App:** High - Multiple OAuth implementations, provider-specific error handling, token management.

**Moku Web Backend:** Low - Only needs provider token validation endpoint.

**Testing Effort:** High - Must test each provider individually, handle provider-specific quirks.

---

## Option 3: Desktop SSO with Browser Authentication

### Overview

Desktop application uses an embedded Electron BrowserView or BrowserWindow to display Moku web's SSO page directly within the app. User completes authentication without leaving desktop app. Communication between embedded browser and main process happens via JavaScript injection or postMessage.

### Authentication Flow

**Step 1: Launch Embedded Browser**
Desktop app creates BrowserView or BrowserWindow pointing to:
```
https://moku.holokai.com/auth/desktop-embedded
```

**Step 2: Display Moku SSO**
Embedded browser shows Moku web's full SSO interface with all provider options. User selects provider and completes authentication flow within embedded browser.

**Step 3: Post-Authentication Communication**
After successful authentication, Moku web executes JavaScript in embedded browser context:
```javascript
window.postMessage({ type: 'AUTH_SUCCESS', tokens: {...} }, '*')
```

**Step 4: Token Capture**
Desktop app's preload script or webview listener captures postMessage event and extracts tokens.

**Step 5: Token Storage**
Main process receives tokens via IPC, stores in safeStorage, updates AuthStore.

**Step 6: Close Embedded Browser**
Desktop app closes BrowserView/BrowserWindow and navigates to main interface.

### Alternative: JavaScript Injection

Instead of postMessage, desktop could inject JavaScript into embedded browser to access tokens directly:
- BrowserView's `executeJavaScript()` method
- Access localStorage or sessionStorage from Moku web
- Extract tokens directly from page state

### Moku Web Requirements

**New Endpoint: `/auth/desktop-embedded`**
Special authentication page that:
- Shows standard SSO options
- Detects embedded browser context
- After auth, posts message to parent with tokens
- Includes security checks to prevent token exposure

**Token Exposure API:**
Moku web needs secure method to expose tokens to desktop:
- Temporary token exchange endpoint
- One-time-use codes that desktop can exchange for tokens
- Or direct token passing via postMessage with origin validation

### Security Considerations

**Origin Validation:**
Moku web must validate postMessage origin to prevent token theft:
```javascript
if (event.origin !== 'file://') return; // Electron apps use file:// protocol
```

**Token Exposure:**
Tokens passed through JavaScript bridge are temporarily exposed in renderer process. Must immediately transfer to main process.

**Session Isolation:**
Embedded browser should use isolated session (no cookies from main browser) to prevent session fixation.

**HTTPS Enforcement:**
Embedded browser must only load HTTPS content. Desktop should validate SSL certificates.

### Advantages

✅ **No Context Switch:** User stays within desktop app throughout authentication.

✅ **Familiar Interface:** User sees exact same Moku web SSO page they know from web.

✅ **All Providers Supported:** Automatically supports all current and future Moku web providers.

✅ **No Custom Protocol:** Avoids protocol registration issues.

✅ **Simple Desktop Implementation:** Just embed browser and capture tokens.

### Disadvantages

❌ **Embedded Browser Security:** BrowserView/BrowserWindow introduces attack surface. Harder to verify SSL certificates.

❌ **Token Exposure:** Tokens temporarily visible in renderer process JavaScript context.

❌ **Session Complexity:** Managing separate session for embedded browser adds complexity.

❌ **User Trust:** Users may not trust embedded browser (can't see address bar clearly).

❌ **Phishing Risk:** Malicious desktop app could embed fake Moku web page and steal credentials.

❌ **Debugging Difficulty:** Harder to debug embedded browser issues.

❌ **Platform Differences:** BrowserView behavior varies across platforms.

### Implementation Complexity

**Desktop App:** Low-Medium - Embed browser, capture tokens, manage browser lifecycle.

**Moku Web Backend:** Low - Add postMessage or token extraction endpoint for embedded context.

**Testing Effort:** Medium - Test embedded browser across platforms, validate security measures.

---

## Comparison Matrix

| Criteria | Option 1: Moku Web | Option 2: Custom Protocol | Option 3: Browser Embedded |
|----------|-------------------|---------------------------|----------------------------|
| **Implementation Complexity** | Medium | High | Low-Medium |
| **Security** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good | ⭐⭐⭐ Good |
| **User Experience** | ⭐⭐⭐⭐ Very Good | ⭐⭐⭐⭐ Very Good | ⭐⭐⭐⭐⭐ Excellent |
| **Maintenance Effort** | ⭐⭐⭐⭐⭐ Low | ⭐⭐ High | ⭐⭐⭐⭐ Low |
| **Provider Flexibility** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |
| **Moku Web Dependency** | Required | Partial | Required |
| **Custom Protocol Required** | Yes | Yes | No |
| **Code Duplication** | None | High | None |
| **Offline Support** | None | Partial | None |
| **Testing Complexity** | Medium | High | Medium |
| **Cross-Platform Stability** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Very Good | ⭐⭐⭐ Good |

---

## Recommendation

### Primary Recommendation: Option 1 (Desktop SSO Using Moku Web)

**Rationale:**

1. **Best Security Model:** Authentication happens entirely in trusted system browser with visible SSL indicators. No token exposure in renderer process. Provider credentials never touch desktop app.

2. **Lowest Maintenance:** All provider integrations managed in single location (Moku web). Adding new providers or fixing provider issues requires zero desktop changes.

3. **Unified Session Management:** Single session management system across web and desktop. Admins have unified view of all sessions.

4. **Proven Pattern:** This is the standard OAuth flow for native applications recommended by OAuth 2.0 for Native Apps (RFC 8252).

5. **Future-Proof:** Supports any authentication method Moku web adds (SAML, LDAP, WebAuthn, etc.) without desktop updates.

### Secondary Recommendation: Option 3 (Browser Embedded)

Use this option only if:
- Context switching to system browser is unacceptable for UX
- Custom protocol registration consistently fails on target platforms
- Willing to accept slightly higher security risk

### Not Recommended: Option 2 (Custom Protocol)

This option should be avoided because:
- High maintenance burden (multiple provider implementations)
- Security concerns with client secrets in desktop app
- Code duplication between web and desktop
- Limited to OAuth providers only (no SAML, LDAP, etc.)
- Highest testing complexity

### Implementation Approach

**Phase 1: MVP (Option 1)**
Implement Option 1 with system browser and custom protocol. This provides the best balance of security, maintainability, and user experience.

**Phase 2: Enhancement (Optional)**
If user feedback indicates context switching is problematic, add Option 3 as an alternative flow with appropriate security warnings and user consent.

**Recommendation:** Start with Option 1 exclusively. Only implement Option 3 if user research demonstrates clear need.

---

**Document Control**

| Version | Date | Author | Purpose |
|---------|------|--------|---------|
| 1.0 | 2025-10-15 | Architecture Team | Initial comparison |

---

*End of Document*