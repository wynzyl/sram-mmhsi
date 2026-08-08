# SRAMS Security Architecture

This document describes the security architecture, controls, and best practices implemented in the SRAMS (School Registration and Accounts Monitoring System) application.

## Table of Contents

1. [Authentication](#authentication)
2. [Session Management](#session-management)
3. [Authorization (RBAC)](#authorization-rbac)
4. [CSRF Protection](#csrf-protection)
5. [Rate Limiting](#rate-limiting)
6. [Input Validation](#input-validation)
7. [Audit Logging](#audit-logging)
8. [Password Security](#password-security)
9. [SQL Injection Prevention](#sql-injection-prevention)
10. [XSS Prevention](#xss-prevention)
11. [Deployment Security](#deployment-security)
12. [Known Limitations & Trade-offs](#known-limitations--trade-offs)
13. [Security Contacts](#security-contacts)

---

## Authentication

### JWT-Based Sessions

SRAMS uses JWT (JSON Web Tokens) for session management via the `jose` library.

**Implementation:**
- `src/lib/auth/session-token.ts` - JWT creation and verification
- `src/lib/auth/session.ts` - Session lifecycle management

**Token Structure:**
```typescript
type SessionPayload = {
  sessionId: string;        // UUID linking to DB session record
  userId: string;           // User identifier
  role: Role;               // User role for RBAC
  expiresAt: Date;          // Token expiration
  forcePasswordChange?: boolean; // Password change gate flag
};
```

**Security Features:**
- **Signed JWTs:** All tokens are signed with HS256 using AUTH_SECRET
- **Short-lived:** 10-hour session duration per engineering spec
- **Server-side verification:** Tokens are verified against database records
- **Revocable:** Sessions can be invalidated server-side by deleting from DB

### Force Password Change Gate

Users with `forcePasswordChange: true` are redirected to `/change-password` and cannot access any other routes until they change their password.

**Implementation:** `proxy.ts` intercepts requests and redirects users who must change their password.

---

## Session Management

### Session Storage

Sessions are stored in the PostgreSQL `sessions` table with:
- `id` - Session identifier (UUID)
- `userId` - Foreign key to users table
- `token` - The JWT token (for server-side revocation)
- `expiresAt` - Expiration timestamp
- `ipAddress` - Client IP (for auditing)
- `userAgent` - Client user agent (for auditing)

### Session Cleanup

Expired sessions are cleaned up via:
1. **Cron endpoint:** `DELETE /api/cron/cleanup-sessions` (protected by CRON_SECRET)
2. **Manual script:** `npx tsx scripts/cleanup-sessions.ts`

**Recommended schedule:** Run cleanup every 6 hours.

### Audit Log Retention

`audit_logs` rows are purged after **365 days** (`AUDIT_LOG_RETENTION_DAYS` in
`src/lib/utils/audit-logger.ts`) so the audit trail does not become a permanent
PII-bearing store.

1. **Cron endpoint:** `DELETE /api/cron/cleanup-audit-logs` (protected by CRON_SECRET)

**Recommended schedule:** Daily — retention granularity is days.

**Client IP handling:** `audit_logs.ip_address` never stores a raw IP. `logAudit()`
passes every value through `anonymizeIpAddressForAuditLog()`, which stores a
SHA-256 digest, and the column is nullable. Note this is an unsalted digest of a
low-entropy value, so it is a correlation fingerprint rather than an irreversible
anonymisation — a known IP can still be confirmed by hashing it. Raw client IPs
*are* retained separately in `sessions.ip_address` for session-hijack detection
(`src/lib/auth/session.ts`); that store is out of scope of this retention job.

### Session Cookie

```typescript
{
  httpOnly: true,           // Prevents XSS access
  secure: true,             // HTTPS only in production
  sameSite: "lax",          // CSRF protection with redirect compatibility
  path: "/",                // Available site-wide
}
```

**Note on SameSite=Lax:** We use `Lax` instead of `Strict` because `Strict` can cause issues with server action redirects in Next.js. `Lax` still provides CSRF protection by blocking cross-site POST requests while allowing top-level navigations.

### Session Binding Validation (A-2)

Sessions are bound to the original User-Agent to detect session hijacking:

- **User-Agent mismatch:** Session is immediately invalidated (strong tampering signal)
- **IP address change:** Logged but not blocked (mobile networks/NAT cause legitimate changes)

```typescript
// In getCurrentSession()
if (dbSession.userAgent && dbSession.userAgent !== currentUA) {
  logger.warn("[session] User-Agent mismatch - possible session hijack");
  await db.delete(sessions).where(eq(sessions.id, dbSession.id));
  return null;
}
```

---

## Authorization (RBAC)

### Three-Level Enforcement

SRAMS enforces Role-Based Access Control at three levels:

1. **Route Guard (proxy.ts)**
   - Redirects unauthenticated users to login
   - Enforces role-based route access (staff vs portal routes)
   - Implements force password change gate

2. **Server Action Validation**
   - Every server action calls `requireSession()` and `hasPermission()`
   - Permissions are checked before any data mutation

3. **Audit Logging**
   - All sensitive operations are logged with actor, action, and target

### User Roles

| Role | Description | Access |
|------|-------------|--------|
| `super_admin` | System administrator | Full access including user management |
| `admin` | Business administrator | All business operations |
| `registrar` | Student records | Student CRUD, enrollments |
| `finance_officer` | Fee management | Fee schedules, assessments, OR booklets |
| `cashier` | Payment processing | Payment posting only |
| `teacher` | Grade encoding | Only assigned subjects/sections |
| `student` | Portal access | View own records only |
| `parent_guardian` | Portal access | View linked student records |

### Permission System

Permissions are defined in `src/lib/rbac/permissions.ts`:

```typescript
hasPermission(role: Role, permission: string): boolean
```

Example permissions: `students:create`, `payments:post`, `grades:encode`, `users:manage`

---

## CSRF Protection

### Next.js Server Actions

SRAMS uses Next.js Server Actions for all mutations, which provide built-in CSRF protection:

1. **Action tokens:** Server Actions include encrypted tokens validated by Next.js
2. **Same-origin enforcement:** Actions can only be called from the same origin
3. **No manual tokens needed:** Unlike traditional forms, no CSRF tokens are required

### Cookie Configuration

The `sameSite: "lax"` cookie attribute provides CSRF protection by preventing cross-site cookie sending for non-GET requests (form submissions, AJAX calls). Top-level navigations are allowed for better UX with external links.

---

## Rate Limiting

### Implementation

SRAMS implements in-memory sliding window rate limiting in `src/lib/security/rateLimit.ts` with secure IP extraction in `src/lib/security/ipExtraction.ts`.

### Security Enhancements (D-1)

1. **Secure IP Extraction:** Trusts only the Nth IP from the right in `X-Forwarded-For` based on `TRUSTED_PROXY_COUNT` environment variable
2. **Per-Account Throttling:** Username-based rate limiting alongside IP-based
3. **Exponential Backoff:** Lockout duration doubles after consecutive failures
4. **No Shared Buckets:** Never uses a shared "unknown" bucket that could be exploited

### Rate Limit Contexts

| Context | Window | Max Attempts | Notes |
|---------|--------|--------------|-------|
| Login (IP) | 15 minutes | 10 | Per IP address |
| Login (Username) | 15 minutes | 5 | Per account (stricter) |
| Admin Actions | 1 minute | 10 | Per user session |

### Exponential Backoff

After 3 consecutive failures, lockout duration increases:

| Consecutive Failures | Lockout Window |
|---------------------|----------------|
| 1-3 | 15 minutes (base) |
| 4 | 30 minutes (2x) |
| 5 | 60 minutes (4x) |
| 6+ | 120 minutes (8x max) |

### Usage

```typescript
import { extractClientIPForRateLimit } from "@/lib/security/ipExtraction";
import { checkLoginRateLimits, recordLoginFailures, resetLoginRateLimits } from "@/lib/security/rateLimit";

// Get secure client IP
const clientIp = extractClientIPForRateLimit(headers, username);

// Check both IP and username limits
const limits = checkLoginRateLimits(clientIp, username);
if (limits.blocked) {
  return { message: limits.message };
}

// On failure: record for exponential backoff
recordLoginFailures(clientIp, username);

// On success: reset limits
resetLoginRateLimits(clientIp, username);
```

### Limitations

- **Single-instance only:** Rate limits are stored in memory and don't persist across restarts or scale across multiple instances
- **No distributed locking:** For multi-instance deployments, implement Redis-backed rate limiting (see `src/lib/security/rateLimit.store.ts` interface)

---

## Input Validation

### Zod Schema Validation

All user inputs are validated using Zod schemas before processing:

- Form inputs via `formData.get()` are parsed through Zod schemas
- API request bodies are validated before database operations
- Type safety is enforced at compile time

**Location:** `src/lib/validators/` and `src/features/*/` directories

### Example

```typescript
const parsed = CreateUserSchema.safeParse({
  email: formData.get("email"),
  username: formData.get("username"),
  // ...
});

if (!parsed.success) {
  return { errors: parsed.error.flatten().fieldErrors };
}
```

---

## Audit Logging

### Privacy & retention posture

SRAMS publishes audit event records through the centralized audit helper in `src/lib/utils/audit-logger.ts`.
The audit-log schema still exposes the legacy shape of `audit_logs.ip_address`, but the current implementation is privacy-safe:

- The application does not persist a raw client IP string in `audit_logs.ip_address`.
- `logAudit()` normalizes an inbound request IP using the SHA-256 fingerprint helper before account storage.
- The column remains nullable so older records or call sites that do not supply the request context can still insert without a privacy liability.
- The operational retention goal is a 365-day lifecycle for audit-log rows; this should be enforced by a scheduled cleanup job / SQL TTL or a bespoke archival workflow coordinated with records management.

This is a legitimate business/operational use under the system’s internal control requirements. The legal basis for processing is security incident investigation, access-control accountability, and auditability for financial and enrollment workflows. A user-facing privacy notice should explain that request metadata may be used for security monitoring and retained for a limited period.

### Coverage

All security-sensitive operations are logged:

| Category | Actions Logged |
|----------|----------------|
| Authentication | Login success/failure, logout, password change |
| User Management | Create, update, deactivate users |
| Financial | Payment posting, voiding, OR consumption |
| Academic | Grade submission, locking |
| Enrollment | Status changes, cancellations |

### Log Structure

```typescript
await logAudit({
  actor: session.userId,
  actorRole: session.role,
  action: "payments:post",
  targetEntity: "payments",
  targetId: paymentId,
  context: "OR: AP-00001, Amount: 5000",
});
```

### Storage

Audit logs are stored in the `audit_logs` table with:
- Actor identification
- Action performed
- Target entity and ID
- Previous and new state (for updates)
- Timestamp
- Request context

---

## Password Security

### Password Hashing

- **Algorithm:** bcrypt
- **Cost factor:** 12 rounds (A-6)
- **Library:** bcryptjs

### Transparent Hash Upgrade (A-6)

Existing passwords with lower cost factors (e.g., cost 10) are automatically upgraded on successful login:

```typescript
const currentCost = getRounds(user.passwordHash);
if (currentCost < BCRYPT_COST) {
  const upgradedHash = await hash(password, BCRYPT_COST);
  await db.update(users).set({ passwordHash: upgradedHash });
}
```

This ensures all passwords eventually use the current security standard without requiring forced password resets.

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Must differ from current password (when changing)

### Timing Attack Prevention

Login always performs password comparison (even for non-existent users) to prevent timing-based user enumeration:

```typescript
const dummyHash = "$2b$12$dummyhashfortimingneutralityXXXXXXXXXXXXXXXX";
const isValid = await compare(password, user?.passwordHash ?? dummyHash);
```

---

## SQL Injection Prevention

### Drizzle ORM

SRAMS uses Drizzle ORM exclusively for database operations, which provides:

- **Parameterized queries:** All values are bound as parameters
- **No raw SQL in application code:** Prevents injection vulnerabilities
- **Type-safe queries:** TypeScript ensures query correctness

### No Raw SQL

Application code never constructs SQL strings directly. All queries use Drizzle's query builder:

```typescript
// Safe - uses parameterized query
await db.query.users.findFirst({
  where: eq(users.email, userInput),
});
```

---

## XSS Prevention

### React's Built-in Protection

React automatically escapes content rendered in JSX, preventing XSS:

- String interpolation is automatically escaped
- No `dangerouslySetInnerHTML` usage in the codebase
- User content is never rendered as raw HTML

### Content Security Policy

For additional protection, consider adding CSP headers in production deployment configuration.

---

## Deployment Security

### TLS Configuration (D-2)

SRAMS requires TLS (HTTPS) in production for secure cookie transmission.

**Recommended Architecture:**
```
[Client] → HTTPS → [Reverse Proxy (nginx/Caddy)] → HTTP → [SRAMS Container]
                    ↑ TLS termination here
```

**nginx Configuration Example:**
```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # HSTS - tell browsers to always use HTTPS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://srams-app:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

**Environment Variables:**
```bash
# Number of reverse proxies between client and app (for IP extraction)
TRUSTED_PROXY_COUNT=1
```

### Session Cleanup Cron (A-5)

The cleanup endpoint uses:
- **DELETE method only** - no GET alias (prevents CSRF/accidental triggers)
- **Timing-safe secret comparison** - prevents timing attacks on the CRON_SECRET

```bash
# Call with DELETE method only
curl -X DELETE https://your-app/api/cron/cleanup-sessions \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Docker Security (D-4)

See `docs/SECURITY/DEPLOYMENT-HARDENING.md` for:
- PostgreSQL internal network binding
- Docker secrets management
- Image pinning by SHA256 digest
- Health check configuration

---

## Known Limitations & Trade-offs

### Session Revocation Lag (A-3) - Accepted Trade-off

The route middleware (`proxy.ts`) validates JWT signatures without database lookup for Edge runtime performance. This means:

- A revoked session can still pass the routing layer until the JWT expires (~10h)
- The revoked session CANNOT read or mutate data (all actions/queries check DB)
- This is a deliberate performance trade-off

**If instant logout-everywhere is required:**
- Option 1: Add per-user `tokenVersion` claim, compare against DB in middleware
- Option 2: Maintain short-TTL cache of revoked sessionIds in Redis
- Option 3: Reduce JWT lifetime (increases renewal frequency)

### Authorization Denial Behavior (A-7)

| Layer | Insufficient Permission Response |
|-------|----------------------------------|
| Route middleware (proxy.ts) | Redirect to role's landing page |
| Server actions | `{ message: "You do not have permission..." }` |
| Data API routes | HTTP 403 Forbidden JSON |

This is intentional UX design - page-level denials are graceful redirects, API-level denials are proper HTTP status codes.

### Zombie Session Handling (A-1)

Sessions with valid JWT tokens but unrecognized roles (e.g., corrupted data) are handled gracefully:
- Cookie is cleared
- User is redirected to login
- No infinite redirect loop

### Current Architecture Constraints

### Current Architecture Constraints

1. **Single-Instance Rate Limiting**
   - Rate limits use in-memory storage
   - Does not persist across server restarts
   - Does not scale across multiple instances
   - **Mitigation:** Implement Redis-backed rate limiting for horizontal scaling (see D-3)

2. **No Permanent Account Lockout**
   - Failed login attempts use exponential backoff but accounts are not permanently locked
   - **Rationale:** Permanent lockout can be used for DoS against legitimate users
   - **Mitigation:** Exponential backoff (up to 2 hours) provides sufficient protection

### Operational Security

1. **Secrets Management**
   - AUTH_SECRET must be at least 32 bytes
   - CRON_SECRET required for cleanup endpoints
   - Never commit secrets to version control

2. **Database Security**
   - Use strong database credentials
   - Limit database network access
   - Enable SSL for database connections in production

---

## Security Contacts

For security issues or vulnerabilities:

1. **Internal:** Contact system administrators
2. **Development:** File issues in the project repository (private disclosure)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-18 | Initial security documentation |
| 2026-05-18 | Added force password change gate |
| 2026-05-18 | Added grade encoding teacher validation |
| 2026-05-18 | Added user creation rate limiting |
| 2026-05-18 | Added session cleanup mechanism |
| 2026-05-30 | (A-1) Fixed zombie session redirect loop |
| 2026-05-30 | (A-2) Added session User-Agent binding validation |
| 2026-05-30 | (A-4) Evaluated SameSite=Strict, kept Lax for redirect compatibility |
| 2026-05-30 | (A-5) Removed GET alias on cron endpoint, added timing-safe comparison |
| 2026-05-30 | (A-6) Increased bcrypt cost factor to 12 with transparent re-hash |
| 2026-05-30 | (D-1) Added secure IP extraction and per-account rate limiting |
| 2026-05-30 | (D-2) Added TLS/deployment security documentation |
