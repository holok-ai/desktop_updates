# Desktop SSO - Exchange Code Flow

## Summary

The desktop app spawns a browser with a Moku web URL that indicates a desktop user is logging in. The Moku web login page authenticates via OAuth2. After login, Moku web generates a one-time-use exchange code and redirects the user back to the desktop app with the exchange code. The desktop will call a new Moku API endpoint to exchange the code for a JWT token (psuedo PKCE). Desktop calls the refresh endpoint to obtain the access token with app permissions.

## Steps

**Step 1:** Desktop detects no token and spawns browser to `moku.holokai.app/login/desktop`

**Step 2:** User logs in via OAuth2; Moku web calls `POST /api/auth/apiKey` to generate JWT token for the authenticated user

**Step 3:** Moku web calls `POST /api/auth/generate-exchange-code` with the apiKey to generate a one-time-use code (valid ~5 minutes)

**Step 4:** Moku web redirects desktop browser to `holokai://home?code=xyz` (custom protocol callback)

**Step 5:** Desktop extracts code from URI and calls `POST /api/auth/exchange-code` with the code to retrieve the apiKey

**Step 6:** Desktop calls `POST /api/auth/token/refresh` with the apiKey to obtain the final accessToken with app permissions and stores it securely

---

## Flow Diagram

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    DESKTOP SSO - EXCHANGE CODE FLOW                        ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────┐                                                  ┌─────────────┐
│   DESKTOP   │                                                  │  MOKU WEB   │
└──────┬──────┘                                                  └──────┬──────┘
       │                                                                 │
       │ 1. No token detected                                           │
       ├─────────────────────────────────────────────────────────────→ │
       │        Spawn browser to                                        │
       │  moku.holokai.app/login/desktop                               │
       │                                                                 │
       │                                                    2. User logs in (OAuth2)
       │                                                                 │
       │                                    3. POST /api/auth/apiKey     │
       │                              ┌────────────────────────────────→│
       │                              │      (generates JWT token)       │
       │                              │                                  │
       │                              │    Returns: { apiKey: "jwt" }   │
       │                              │←────────────────────────────────┤
       │                              │                                  │
       │                       4. POST /api/auth/generate-exchange-code │
       │                              ┌────────────────────────────────→│
       │                              │      (apiKey in request)         │
       │                              │                                  │
       │                              │    Returns: { code: "xyz" }     │
       │                              │←────────────────────────────────┤
       │                              │                                  │
       │    5. Redirect: holokai://home?code=xyz                        │
       │←─────────────────────────────────────────────────────────────│
       │                                                                 │
       │ 6. Parse code from URI                                         │
       │                                                                 │
       │ 7. POST /api/auth/exchange-code                              │
       ├────────────────────────────────────────────────────────────→ │
       │        { code: "xyz" }                                         │
       │                                                                 │
       │           Returns: { apiKey: "jwt" }                          │
       │←────────────────────────────────────────────────────────────┤
       │                                                                 │
       │ 8. POST /api/auth/token/refresh                              │
       ├────────────────────────────────────────────────────────────→ │
       │        { apiKey: "jwt" }                                       │
       │                                                                 │
       │    Returns: { accessToken: "jwt-with-app-access" }           │
       │←────────────────────────────────────────────────────────────┤
       │                                                                 │
       │ 9. Store accessToken securely                                  │
       │ ✓ Done - Use for all API calls                               │
       │                                                                 │

═══════════════════════════════════════════════════════════════════════════════
```

---

## Endpoint Summary

| Endpoint                           | Method | Input               | Output                   | Called By   | Notes                                                 |
| ---------------------------------- | ------ | ------------------- | ------------------------ | ----------- | ----------------------------------------------------- |
| `/api/auth/apiKey`                 | GET    | None                | `{ apiKey: "jwt" }`      | Moku Web    | Existing endpoint; user must be authenticated         |
| `/api/auth/generate-exchange-code` | POST   | `{ apiKey: "jwt" }` | `{ code: "xyz" }`        | Moku Web    | **NEW ENDPOINT**; generates one-time code (5 min TTL) |
| `/api/auth/exchange-code`          | POST   | `{ code: "xyz" }`   | `{ apiKey: "jwt" }`      | Desktop App | **NEW ENDPOINT**; invalidates code after use          |
| `/api/auth/token/refresh`          | POST   | `{ apiKey: "jwt" }` | `{ accessToken: "jwt" }` | Desktop App | Existing endpoint; adds app permissions to token      |

---

## Key Points

✅ **Token never visible in browser** — Only exchange code passes through URL  
✅ **One-time-use code** — Code becomes invalid after first exchange (security)  
✅ **No localhost listener needed** — Desktop uses custom protocol callback  
✅ **Minimal backend changes** — Only 2 new endpoints required  
✅ **Secure token handoff** — Custom protocol is OS-managed  
✅ **Stateless desktop** — No session cookies or complex state management  
✅ **Cross-platform** — Works on Windows, macOS, and Linux
