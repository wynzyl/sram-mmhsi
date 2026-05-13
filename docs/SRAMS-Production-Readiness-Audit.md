# SRAMS Production Readiness Audit - DevOps/SRE/QA Review

## Executive Summary

**Overall Readiness Score: 6.5/10 - Ready for staging, NOT production ready**

The SRAMS application has solid architectural foundations with good RBAC, structured audit logging, and proper layer separation. However, critical gaps in security, monitoring, and error handling must be addressed before production deployment.

---

## Critical Issues (Must Fix Before Production)

### 1. SECURITY - Secrets Exposed in Git (SEVERITY: CRITICAL)

**Problem:** `.env.local` contains actual credentials committed to version control:
- AUTH_SECRET, GMAIL_APP_PASSWORD, DATABASE_URL with real passwords

**Files:**
- `.env.local` (lines 9, 12, 19)
- `docker-compose.yml` (line 14 - hardcoded DB password)

**Immediate Actions:**
1. Rotate all secrets immediately (AUTH_SECRET, GMAIL credentials, DB password)
2. Add `.env.local` to `.gitignore`
3. Remove from git history: `git filter-branch --tree-filter 'rm -f .env.local' HEAD`
4. Regenerate all credentials before any deployment

---

### 2. INFRASTRUCTURE - Missing Health/Readiness Endpoints (SEVERITY: HIGH)

**Problem:** Dockerfile references `/api/health` (line 46) but endpoint doesn't exist.

**Impact:** Container health checks will fail, causing restarts in orchestration (Kubernetes/ECS).

**Solution:** Create two endpoints:

```
src/app/api/health/route.ts       - Liveness check (returns 200 if app running)
src/app/api/readiness/route.ts    - Readiness check (validates DB connection)
```

**Implementation:**
```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "healthy", timestamp: Date.now() });
}

// src/app/api/readiness/route.ts
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: "ready", database: "connected" });
  } catch {
    return Response.json({ status: "not_ready", database: "disconnected" }, { status: 503 });
  }
}
```

---

### 3. SECURITY - Rate Limiter Not Integrated (SEVERITY: HIGH)

**Problem:** `src/lib/security/rateLimit.ts` exists with proper implementation but is NOT wired into login endpoint.

**Impact:** No protection against brute-force password attacks.

**Solution:** Integrate in `src/features/auth/auth.actions.ts`:
```typescript
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/security/rateLimit";

export async function loginAction(prevState, formData) {
  const identifier = formData.get("email") as string;

  if (isLoginRateLimited(identifier)) {
    return { message: "Too many login attempts. Please try again later." };
  }

  // ... existing login logic

  recordLoginAttempt(identifier); // On failed attempt
}
```

---

### 4. DATABASE - Connection Pool Too Small (SEVERITY: HIGH)

**Problem:** `src/lib/db/index.ts` sets `max: 10` connections only.

**Impact:** Under concurrent load (12+ simultaneous requests), connections queue causing timeouts.

**Solution:** Update pool configuration:
```typescript
postgres(connectionString, {
  max: 20,                        // Increase pool size
  idle_timeout: 30,               // 30s idle timeout
  connect_timeout: 10,            // 10s connect timeout
  max_lifetime: 3600,             // 1hr max connection age
});
```

Also add to connection string: `statement_timeout=30000&lock_timeout=5000`

---

### 5. ERROR HANDLING - Unhandled Promise Rejections (SEVERITY: HIGH) ✅ FIXED

**Problem:** `src/features/enrollments/enrollments-queue.queries.ts` uses `.then()` chains without `.catch()`.

**Impact:** Silent failures in pagination queries; stats may be wrong.

**Solution:** Add `.catch()` handlers or refactor to async/await with try/catch.

**Status:** ✅ Fixed on 2026-05-13. All `.then()` chains now have `.catch()` handlers with error logging.

---

### 6. AUDIT LOGGING - Missing throwOnFail (SEVERITY: HIGH) ✅ FIXED

**Problem:** 32 audit log calls don't use `throwOnFail: true`, only 3 in payments do.

**Impact:** If audit write fails, operations continue but audit trail is incomplete - compliance risk.

**Status:** ✅ Fixed on 2026-05-13. Added `{ throwOnFail: true }` to 27 audit calls across:
- `students.actions.ts` (2 calls)
- `enrollments.actions.ts` (1 call)
- `users.actions.ts` (4 calls)
- `school-years.actions.ts` (4 calls)
- `invoices.actions.ts` (2 calls)
- `fee-item-types.actions.ts` (3 calls)
- `fee-templates.actions.ts` (7 calls)
- `subjects.actions.ts` (4 calls)

**Note:** Auth login/logout audit calls intentionally left without `throwOnFail` to avoid blocking user authentication if audit write fails.

---

### 7. REACT - No Error Boundaries (SEVERITY: MEDIUM) ✅ ALREADY IMPLEMENTED

**Problem:** No `error.tsx` files exist anywhere in `src/app/`.

**Impact:** Client-side errors crash entire route without graceful fallback.

**Status:** ✅ Already implemented. Error boundaries exist at:
- `src/app/error.tsx` - Global error boundary
- `src/app/not-found.tsx` - 404 page
- `src/app/admin/error.tsx` - Admin section error boundary
- `src/app/staff/error.tsx` - Staff section error boundary
- `src/app/portal/error.tsx` - Portal section error boundary

---

### 8. SECURITY - Missing Security Headers (SEVERITY: MEDIUM)

**Problem:** No CSP, X-Frame-Options, or X-Content-Type-Options headers configured.

**Solution:** Add to `next.config.ts`:
```typescript
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ]
  }]
}
```

---

## High Priority Issues (Fix Before Production)

### 9. Performance - Ready-to-Enroll Memory Spike

**File:** `src/features/enrollments/enrollments-queue.queries.ts:182-379`

**Problem:** Loads ALL approved registrations + ALL previous enrollments into memory, then filters in JavaScript.

**Impact:** 5,000 students = ~47MB per page load (estimated 10KB per student).

**Solution:** Apply LIMIT/OFFSET at SQL level, not post-query filtering.

---

### 10. Database - Missing Indexes

**Schema file:** `src/lib/db/schema.ts`

Add indexes for:
- `audit_logs.action` - For compliance reporting queries
- `sessions.expiresAt` - For cleanup queries
- `parents_guardians.email` - For portal login
- `fee_schedule_overrides.feeTemplateItemId` - For reverse lookups

---

### 11. Monitoring - No APM Integration

**Problem:** No Sentry, DataDog, or New Relic integration.

**Solution:** Add Sentry SDK:
```bash
npm install @sentry/nextjs
```

Configure in `sentry.client.config.ts`, `sentry.server.config.ts`, and `instrumentation.ts`.

---

### 12. CI/CD - No Pipeline

**Problem:** No GitHub Actions workflows exist.

**Solution:** Create `.github/workflows/ci.yml`:
- Lint check (ESLint)
- Type check (tsc --noEmit)
- Build test (next build)
- Unit tests (vitest)
- Migration validation

---

### 13. Environment - validateEnv() Not Called

**Problem:** `src/lib/utils/env.ts` has validation function but it's never invoked at startup.

**Solution:** Call in `src/app/layout.tsx` or create `instrumentation.ts` hook.

---

## Medium Priority Issues (Improve Post-Launch)

| Issue | File | Description |
|-------|------|-------------|
| No Redis caching | - | Add Redis for grade levels, school year cache |
| Console.log in code | `src/lib/email/sender.ts:7-9` | Replace with logger |
| No request correlation IDs | `proxy.ts` | Add tracing for request flows |
| Session duration hardcoded | `src/lib/auth/session.ts:29` | Make configurable via env |
| Grade levels fetched fresh | `enrollments-queue.queries.ts:305` | Cache for 24 hours |
| Transaction lock ordering | `payments.actions.ts` | Document and enforce order |

---

## Implementation Plan

### Phase 1: Critical Security Fixes (Day 1)
1. Rotate all secrets
2. Update .gitignore
3. Remove .env.local from git history
4. Wire rate limiter to login

### Phase 2: Infrastructure Fixes (Day 1-2)
5. Create health/readiness endpoints
6. Update database pool configuration
7. Add security headers to next.config.ts
8. Create error boundary components

### Phase 3: Code Quality (Day 2-3)
9. Fix unhandled promise rejections
10. Add throwOnFail to all audit logs
11. Add missing database indexes
12. Call validateEnv() at startup

### Phase 4: Monitoring & CI/CD (Day 3-4)
13. Integrate Sentry for error tracking
14. Create GitHub Actions CI pipeline
15. Replace console.log with logger
16. Add request correlation IDs

### Phase 5: Performance (Week 2)
17. Fix ready-to-enroll SQL pagination
18. Add NextJS caching layer
19. Cache grade levels and school year

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/health/route.ts` | Liveness probe |
| `src/app/api/readiness/route.ts` | Readiness probe (with DB check) |
| `src/app/error.tsx` | Global error boundary |
| `src/app/not-found.tsx` | 404 page |
| `src/app/admin/error.tsx` | Admin error boundary |
| `src/app/staff/error.tsx` | Staff error boundary |
| `src/app/portal/error.tsx` | Portal error boundary |
| `.github/workflows/ci.yml` | CI pipeline |
| `sentry.client.config.ts` | Sentry client config |
| `sentry.server.config.ts` | Sentry server config |

---

## Files to Modify

| File | Changes |
|------|---------|
| `.gitignore` | Add `.env.local` |
| `next.config.ts` | Add security headers |
| `src/lib/db/index.ts` | Update pool config, add timeouts |
| `src/lib/db/schema.ts` | Add 4 missing indexes |
| `src/features/auth/auth.actions.ts` | Wire rate limiter |
| `src/features/students/students.actions.ts` | Add throwOnFail to audit |
| `src/features/enrollments/enrollments.actions.ts` | Add throwOnFail to audit |
| `src/features/assessments/assessments.actions.ts` | Add throwOnFail to audit |
| `src/features/enrollments/enrollments-queue.queries.ts` | Fix promise rejections, SQL pagination |
| `src/lib/email/sender.ts` | Replace console.log |
| `proxy.ts` | Add correlation ID |
| `src/app/layout.tsx` or `instrumentation.ts` | Call validateEnv() |

---

## Verification Steps

1. **Security**: Run `git log --oneline --all -- .env.local` to confirm history cleaned
2. **Health Endpoints**: `curl http://localhost:3000/api/health` returns 200
3. **Readiness**: `curl http://localhost:3000/api/readiness` returns 200 with DB status
4. **Rate Limiting**: Try 11 failed logins, verify 429 response
5. **Error Boundaries**: Throw error in component, verify graceful error page
6. **Security Headers**: Check response headers in browser DevTools
7. **Build**: `npm run build` succeeds with no errors
8. **Tests**: `npm run test` passes all 13 existing tests
9. **Docker**: `docker build .` completes and health check passes

---

## Summary Scorecard

| Category | Current | Target | Gap |
|----------|---------|--------|-----|
| Docker Configuration | 7/10 | 9/10 | Health endpoints |
| Environment Management | 5/10 | 9/10 | Secrets rotation, validation |
| Security | 6/10 | 9/10 | Rate limiter, headers, CSRF |
| Database | 8/10 | 9/10 | Pool config, indexes |
| Error Handling | **8/10** | 8/10 | ✅ Boundaries implemented, promise handling fixed |
| Logging/Audit | **9/10** | 9/10 | ✅ throwOnFail enforcement complete |
| Monitoring | 2/10 | 7/10 | APM integration |
| CI/CD | 0/10 | 8/10 | Pipeline creation |

**Updates (2026-05-13):**
- Error Handling: 4/10 → 8/10 (Error boundaries already implemented, promise rejections fixed)
- Logging/Audit: 7/10 → 9/10 (throwOnFail added to 27 audit calls)
