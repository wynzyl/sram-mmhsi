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
11. [Known Limitations](#known-limitations)
12. [Security Contacts](#security-contacts)

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

### Session Cookie

```typescript
{
  httpOnly: true,           // Prevents XSS access
  secure: true,             // HTTPS only in production
  sameSite: "lax",          // CSRF protection
  path: "/",                // Available site-wide
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

The `sameSite: "lax"` cookie attribute provides additional CSRF protection by preventing cross-site cookie sending for non-GET requests.

---

## Rate Limiting

### Implementation

SRAMS implements in-memory sliding window rate limiting in `src/lib/security/rateLimit.ts`.

### Rate Limit Contexts

| Context | Window | Max Attempts | Purpose |
|---------|--------|--------------|---------|
| Login | 15 minutes | 10 | Prevent brute force attacks |
| Admin Actions | 1 minute | 10 | Prevent abuse of sensitive operations |

### Usage

```typescript
// Login rate limiting
if (isLoginRateLimited(clientIp)) {
  return { message: "Too many attempts..." };
}

// Admin action rate limiting
if (isAdminActionRateLimited(session.userId)) {
  return { message: "Too many requests..." };
}
```

### Limitations

- **Single-instance only:** Rate limits are stored in memory and don't persist across restarts or scale across multiple instances
- **No distributed locking:** For multi-instance deployments, replace with Redis-backed rate limiting

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
- **Cost factor:** 10 rounds
- **Library:** bcryptjs

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Must differ from current password (when changing)

### Timing Attack Prevention

Login always performs password comparison (even for non-existent users) to prevent timing-based user enumeration:

```typescript
const dummyHash = "$2b$10$dummyhashfortimingneutralityXXXXXXXXXXXXXXXX";
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

## Known Limitations

### Current Architecture Constraints

1. **Single-Instance Rate Limiting**
   - Rate limits use in-memory storage
   - Does not persist across server restarts
   - Does not scale across multiple instances
   - **Mitigation:** Use Redis for multi-instance deployments

2. **Session Metadata Validation**
   - Session does not validate IP address or user agent changes
   - **Status:** Documented as optional future hardening
   - **Risk:** Low - tokens are short-lived and require valid JWT signature

3. **No Account Lockout**
   - Failed login attempts are rate-limited but accounts are not locked
   - **Mitigation:** Rate limiting provides sufficient protection for most use cases

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
