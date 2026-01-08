# Backend: Update SecurityContextHelper for JWT organizationId

## Problem

When desktop app calls `/api/applications` with JWT Bearer token, `SecurityContextHelper` expects `OAuth2User` but receives regular `User` principal:

```
Principal is not OAuth2User: User
```

This causes RLS filtering to exclude all data because `organizationId` context is missing.

## Solution

The JWT token **already contains** `organizationId` claim. Update `SecurityContextHelper.java` to:
1. Accept both `OAuth2User` AND JWT-authenticated `User` principals
2. Extract `organizationId` from JWT claims when User is not OAuth2User
3. Set organizationId in security context for RLS filtering

## Desktop App Changes (COMPLETED ✅)

Desktop app now:
- Extracts `organizationId` from JWT token
- Logs organizationId to verify it exists
- Stores it in `UserProfile`

## Backend Changes Needed

### 1. Update SecurityContextHelper.java

```java
@Component
public class SecurityContextHelper {

    private static final Logger log = LoggerFactory.getLogger(SecurityContextHelper.class);

    /**
     * Get organizationId from current authentication context
     * Supports both OAuth2User (web app) and JWT User (desktop app)
     */
    public String getOrganizationId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            log.warn("No authenticated user in security context");
            return null;
        }

        Object principal = authentication.getPrincipal();

        // Case 1: OAuth2User (web app with social login)
        if (principal instanceof OAuth2User) {
            OAuth2User oauth2User = (OAuth2User) principal;
            String orgId = oauth2User.getAttribute("organizationId");
            log.debug("Extracted organizationId from OAuth2User: {}", orgId);
            return orgId;
        }

        // Case 2: JWT User (desktop app)
        if (principal instanceof User || principal instanceof UserDetails) {
            String orgId = extractOrganizationIdFromJwt(authentication);
            if (orgId != null) {
                log.debug("Extracted organizationId from JWT: {}", orgId);
                return orgId;
            }
        }

        // Case 3: String principal (username only)
        if (principal instanceof String) {
            String orgId = extractOrganizationIdFromJwt(authentication);
            if (orgId != null) {
                log.debug("Extracted organizationId from JWT token: {}", orgId);
                return orgId;
            }
        }

        log.warn("Principal is not OAuth2User or JWT-authenticated User: {}",
                 principal.getClass().getName());
        return null;
    }

    /**
     * Extract organizationId from JWT token in authentication details
     */
    private String extractOrganizationIdFromJwt(Authentication authentication) {
        // Check if authentication has JWT token
        if (authentication instanceof JwtAuthenticationToken) {
            JwtAuthenticationToken jwtAuth = (JwtAuthenticationToken) authentication;
            Jwt jwt = jwtAuth.getToken();

            // Extract organizationId claim from JWT
            String orgId = jwt.getClaimAsString("organizationId");
            if (orgId != null) {
                return orgId;
            }
        }

        // Alternative: Check if details contain JWT claims
        Object details = authentication.getDetails();
        if (details instanceof Map) {
            Map<?, ?> detailsMap = (Map<?, ?>) details;
            Object orgId = detailsMap.get("organizationId");
            if (orgId != null) {
                return orgId.toString();
            }
        }

        // Another alternative: Parse JWT from credentials/principal
        Object credentials = authentication.getCredentials();
        if (credentials instanceof Jwt) {
            Jwt jwt = (Jwt) credentials;
            return jwt.getClaimAsString("organizationId");
        }

        return null;
    }
}
```

### 2. Verify JWT Configuration

Ensure your JWT configuration includes `organizationId` claim when generating tokens:

```java
// In your JWT token generation service
public String generateAccessToken(User user) {
    Map<String, Object> claims = new HashMap<>();
    claims.put("userId", user.getId());
    claims.put("email", user.getEmail());
    claims.put("name", user.getName());
    claims.put("organizationId", user.getOrganizationId()); // Must include this

    return Jwts.builder()
        .setClaims(claims)
        .setSubject(user.getId())
        .setIssuedAt(new Date())
        .setExpiration(new Date(System.currentTimeMillis() + accessTokenExpiration))
        .signWith(SignatureAlgorithm.HS512, jwtSecret)
        .compact();
}
```

### 3. Update RLS Queries

Ensure all RLS queries use `SecurityContextHelper.getOrganizationId()`:

```java
@Repository
public class ApplicationRepository {

    @Autowired
    private SecurityContextHelper securityContextHelper;

    public Page<Application> findAll(Pageable pageable) {
        String orgId = securityContextHelper.getOrganizationId();

        if (orgId == null) {
            log.error("Cannot query applications - no organizationId in context");
            throw new SecurityException("Organization context required");
        }

        // RLS query with organization filter
        return applicationRepository.findByOrganizationId(orgId, pageable);
    }
}
```

### 4. Add Logging

Add debug logging to verify organizationId extraction:

```java
@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    @GetMapping
    public Page<ApplicationSummary> getApplications(Pageable pageable) {
        String orgId = securityContextHelper.getOrganizationId();
        log.info("Getting applications for organizationId: {}", orgId);

        if (orgId == null) {
            log.error("No organizationId found - authentication type: {}",
                     SecurityContextHolder.getContext().getAuthentication().getClass());
        }

        return applicationService.findAll(pageable);
    }
}
```

## Testing Steps

1. **Desktop app login**:
   - Login via desktop app
   - Check logs for: `[AuthService] Extracted organizationId: <id>`
   - Should NOT see warning: `organizationId not found in JWT token`

2. **Backend receives request**:
   - Desktop calls `/api/applications`
   - Backend logs: `Extracted organizationId from JWT: <id>`
   - Backend logs: `Getting applications for organizationId: <id>`

3. **Verify RLS works**:
   - Applications returned should belong to user's organization
   - Should NOT be empty (assuming org has applications)

4. **Compare with web app**:
   - Same organizationId for same user
   - Same applications returned

## Dependencies

May need to add JWT dependencies if not already present:

```xml
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-oauth2-resource-server</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-oauth2-jose</artifactId>
</dependency>
```

## Related Files

**Desktop (Completed ✅)**:
- `src-electron/services/auth.service.ts` - Now extracts organizationId from JWT
- `src-electron/services/mokuapi/moku.service.ts` - Sends Bearer token

**Backend (Pending)**:
- `SecurityContextHelper.java` - Needs update per above
- JWT token generation service - Verify includes organizationId
- `ApplicationController.java` - Add logging
- Application repository - Verify RLS queries

## Acceptance Criteria

- [ ] SecurityContextHelper accepts both OAuth2User and JWT User
- [ ] organizationId correctly extracted from JWT claims
- [ ] `/api/applications` returns data for desktop app
- [ ] RLS filtering works correctly
- [ ] No "Principal is not OAuth2User" error
- [ ] Web app still works (OAuth2User path)
- [ ] Desktop app works (JWT path)
