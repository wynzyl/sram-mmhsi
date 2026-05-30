# SRAMS Security Audit — Authentication, Session & RBAC Layer

| | |
|---|---|
| **System** | School Registration and Accounts Monitoring System (SRAMS) |
| **Scope** | Authentication, session management, middleware/routing (`proxy.ts`), and RBAC execution |
| **Audit basis** | `docs/SECURITY/AUDIT-SKILL.md` checklist (4 areas) |
| **Date** | 2026-05-30 |
| **Branch / commit** | `master` @ `09af9f9` |
| **Method** | Manual code review + targeted source verification (read-only). No code was modified — all fixes below are recommendations. |
| **Stack reviewed** | Next.js 16 App Router · `jose` JWT · Drizzle ORM · PostgreSQL · `bcryptjs` |

> **Note on the migration context.** This audit was requested after a migration to a pure Next.js
> fullstack auth approach intended to resolve infinite redirect loops and RBAC failures. The single
> highest-value finding (**A-1**) is a *latent* version of exactly that redirect-loop class, still
> reachable under a specific condition. Fixing it closes out the original motivation.

---

## 1. Executive Summary

The authentication and session layer is **well-built and largely production-ready**. It uses
signed JWTs with a **dual-layer verification model** (cryptographic signature *plus* a database
session row, enabling true server-side revocation), correct cookie hardening, a granular RBAC
matrix enforced redundantly at the middleware, page, action, *and* API-route layers, timing-neutral
rate-limited login, and a forced-password-change gate. Session fixation, password hashing, and SQL
injection in this layer are **not** material concerns.

The findings below are mostly **hardening** items. One latent **High** issue (redirect loop on an
unrecognised role) should be fixed because it reproduces the exact failure class this codebase
migrated to escape. A separate **Critical** item — unrelated to the auth layer but discovered during
review — is called out in §6: a full database dump (`srams_backup.sql`) is committed to git history.

### Severity counts (auth/session/RBAC scope)

| Severity | Count | IDs |
|---|---|---|
| High | 1 | A-1 |
| Medium | 2 | A-2, A-3 |
| Low / Informational | 4 | A-4, A-5, A-6, A-7 |
| Out-of-scope Critical (see §6) | 1 | X-1 |

---

## 2. Findings at a Glance

| ID | Severity | Checklist area | Location | Status |
|---|---|---|---|---|
| A-1 | **High** | 1. Middleware / redirect loops | `proxy.ts:60-67` | Open |
| A-2 | Medium | 2. Session persistence | `session.ts:48-93, 97-116` (+ `schema.ts:195-196`) | Open |
| A-3 | Medium | 1. Middleware validation | `proxy.ts:42-49` | Accepted trade-off / document |
| A-4 | Low | 4. CSRF | `session.ts:89,160` | Hardening |
| A-5 | Low | 4. Vulnerability check | `api/cron/cleanup-sessions/route.ts:69-71` | Hardening |
| A-6 | Low | 4. Password hashing | login/user actions (`bcryptjs`, cost 10) | Optional |
| A-7 | Info | 3. RBAC 403 behaviour | `requireSession()` + actions | By design |

---

## 3. Detailed Findings

### A-1 — Latent infinite redirect loop when an authenticated session has an unrecognised role · **High**

**Checklist area:** 1 (protected routes must not trigger infinite redirect loops).

**What happens.** In `proxy.ts`, the public-route branch is evaluated *before* the invalid-role
branch. For an authenticated request whose `role` normalises to `null`, the landing target collapses
to `/login`, and `/login` is itself a public route — so the user is redirected `/login → /login`
forever.

```ts
// proxy.ts
const role = normalizeRole(session?.role);              // → null for a removed/renamed role

if (isAuthenticated && isPublic) {                      // line 60: evaluated FIRST
  const landing = role ? ROLE_LANDING[role] : "/login"; // role is null ⇒ landing = "/login"
  return NextResponse.redirect(new URL(landing, req.nextUrl)); // /login → /login → …
}

if (isAuthenticated && !role) {                         // line 65: UNREACHABLE on the /login path
  return NextResponse.redirect(new URL("/login", req.nextUrl));
}
```

**Trigger condition.** A session is authenticated (valid JWT + live DB row) but its `role` claim is
no longer a recognised value — e.g. a role is renamed/removed, or a session is still circulating
after a roles refactor, within the ~10h token lifetime. Narrow, but it is a *hard lockout* with a
browser `ERR_TOO_MANY_REDIRECTS`, and it is the precise failure mode the migration set out to kill.

**Impact.** Denial of access (self-inflicted loop) for affected users; confusing to diagnose.

**Fix.** Treat "authenticated but no valid role" as a broken session: clear the cookie and let the
user land on `/login` cleanly. Evaluate this *before* the public-route redirect.

```ts
const isAuthenticated = !!session;
const role = normalizeRole(session?.role);

// Broken/zombie session: valid token, unusable role → clear cookie, allow /login, never loop.
if (isAuthenticated && !role) {
  if (isPublic) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }
  const res = NextResponse.redirect(new URL("/login", req.nextUrl));
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}

// (existing) authenticated user on a public route → send to their landing
if (isAuthenticated && isPublic) {
  return NextResponse.redirect(new URL(ROLE_LANDING[role], req.nextUrl));
}
```

> Defence in depth: a loop counter is unnecessary once the `!role` case clears the cookie, because
> the next request is unauthenticated and falls through to the normal public `/login` render.

---

### A-2 — Session IP / User-Agent are captured but never validated · **Medium**

**Checklist area:** 2 (session persistence / hijack resistance).

The `sessions` table stores `ipAddress` and `userAgent`, and `createSession()` populates them — but
`getCurrentSession()` never compares them against the current request. A stolen session cookie can
therefore be replayed from any IP/device for the full 10-hour lifetime with no signal.

```ts
// schema.ts — columns exist
ipAddress: text("ip_address"),
userAgent: text("user_agent"),

// session.ts:97-116 — getCurrentSession verifies signature + DB row + expiry,
// but does NOT compare ipAddress / userAgent. The captured data is unused for defence.
```

**Impact.** Undetected session hijacking / cookie replay.

**Fix (pragmatic — bind on User-Agent, log on IP change).** Full IP pinning breaks mobile/roaming
and proxies, so prefer a soft model: hard-fail on UA change, log/optionally step-up on IP change.

```ts
// session.ts — getCurrentSession(), after the dbSession lookup
import { headers } from "next/headers";

const h = await headers();
const ua = h.get("user-agent") ?? "";
if (dbSession.userAgent && dbSession.userAgent !== ua) {
  // UA mismatch is a strong tampering signal → invalidate
  await db.delete(sessions).where(eq(sessions.id, dbSession.id));
  return null;
}
// IP change is noisy (mobile/NAT); record it rather than hard-failing.
```

> If you adopt this, pass the request IP/UA explicitly where `cookies()`/`headers()` are available,
> and document the mobile-roaming caveat so support doesn't chase false "logged out" reports.

---

### A-3 — Middleware uses optimistic JWT-only verification (revocation lag) · **Medium → document as accepted**

**Checklist area:** 1.

`proxy.ts` decodes the JWT (`decryptSessionJwt`) **without** hitting the database, for Edge
performance. A session revoked in the DB (logout elsewhere, forced revocation) remains accepted *by
the middleware* until the JWT expires (~10h).

```ts
// proxy.ts:42-49 — signature/expiry only; no DB session-row check here
session = await decryptSessionJwt(token);
```

**Why this is largely OK.** Every server action and every data API route calls the DB-verified
`getCurrentSession()` / `getCurrentUser()` (see §5), so a revoked session cannot actually *read or
mutate* protected data — it can only pass the routing gate. The exposure is limited to page-shell
navigation.

**Recommendation.** Accept and **document** the trade-off, or add a lightweight revocation check
(e.g. a short-TTL cache of revoked `sessionId`s, or a per-user `tokenVersion` claim compared against
the DB) if instant logout-everywhere becomes a requirement.

---

### A-4 — Session cookie is `SameSite=Lax`; consider `Strict` · **Low (hardening)**

**Checklist area:** 4 (CSRF).

CSRF posture is already good: all mutations are **Server Actions**, which Next.js protects with an
Origin/Host same-origin check, and the data API routes are read-only `GET`s. The session cookie is
correctly `httpOnly` + `secure` (prod). The remaining lever is `sameSite`:

```ts
// session.ts:89 and :160
sameSite: "lax",   // sends the cookie on top-level cross-site GET navigations
```

`Lax` is a sensible default, but `Strict` removes even the top-level-GET vector at negligible UX cost
for an internal back-office app (the only friction is that following an external deep link lands the
user on `/login` once).

**Fix.** `sameSite: "strict"` in both `createSession()` and `renewSession()`. No CSRF tokens are
needed on top of Server-Action origin checks.

---

### A-5 — Destructive session-cleanup endpoint is reachable via `GET` · **Low (hardening)**

**Checklist area:** 4.

```ts
// api/cron/cleanup-sessions/route.ts:69-71
export async function GET(req: NextRequest) {
  return DELETE(req); // GET performs a destructive DELETE FROM sessions WHERE expired
}
```

It is gated by a `CRON_SECRET` Bearer header (and disabled with `503` if the secret is unset — a good
fail-safe), so it is **not** CSRF-exploitable and the secret isn't in the URL. But exposing a
state-changing operation over `GET` is a smell: `GET` is cacheable/prefetchable and invites the
secret being passed as a query param later.

**Fix.** Drop the `GET` alias (keep `DELETE`/`POST` only). If a manual trigger is wanted, keep it
behind the same secret but use `POST`.

---

### A-6 — bcrypt cost factor 10 · **Low (optional)**

**Checklist area:** 4 (password hashing).

Password hashing uses `bcryptjs` at cost factor 10 — acceptable today. Consider raising to **12** for
margin (≈4× work) if login latency budget allows; re-hash transparently on next successful login.

---

### A-7 — Insufficient-role denials are "soft" at the page/action layer (no hard 403) · **Informational / by design**

**Checklist area:** 3.

- **Middleware:** an authenticated user hitting a route their role can't access is **redirected to
  their own landing page** (`proxy.ts:69-87`) — graceful, no crash, no `/login` bounce, no loop. Good.
- **Server actions:** return `{ message: "You do not have permission…" }` rather than throwing a 403.
  Graceful and correct for the `useActionState` form contract.
- **Data API routes:** these *do* return a real HTTP **403** (see §5).

This is internally consistent and safe; there is simply no hard HTTP 403 at the page/action layer.
Noting it so the "403 vs redirect" checklist item is explicitly closed: **redirect-to-landing is the
chosen UX for page access; 403 JSON is used at the API boundary.** No change required.

---

## 4. Checklist Coverage (from `AUDIT-SKILL.md`)

| # | Checklist item | Result |
|---|---|---|
| 1 | Public routes (`/login`) explicitly bypassed | ✅ Pass (`proxy.ts:9,35,54`) |
| 1 | `/register` public | ⚪ N/A — no public `/register`; only `/staff/register`, correctly protected. Registration is staff-driven. |
| 1 | Protected routes intercept unauth users, no infinite loop | ⚠️ Mostly pass; **A-1** latent loop on unrecognised role |
| 1 | Server Actions + API routes have redundant session validation | ✅ Pass — see §5 |
| 2 | `userId` + `role` properly serialized at login | ✅ Pass (`session.ts:70-76`) |
| 2 | Cookies `HttpOnly` + `Secure` (prod) + `SameSite` | ✅ Pass; `Lax` → consider `Strict` (**A-4**) |
| 2 | Session table indexed on token + expiry | ✅ Pass — `uniqueIndex(token)`, `index(expiresAt)`, `index(userId)` (`schema.ts:200-202`) |
| 3 | RBAC reads role from validated session | ✅ Pass (`getCurrentUser()` → `hasPermission()`) |
| 3 | Insufficient role → graceful, no crash/login-bounce | ✅ Pass (redirect-to-landing / 403 JSON; **A-7**) |
| 4 | CSRF on mutations | ✅ Pass (Server-Action origin checks + `Lax`); harden via **A-4** |
| 4 | Password hashing | ✅ Pass (`bcryptjs`); optional **A-6** |
| 4 | Session fixation | ✅ Pass — fresh DB row + fresh token per login (`session.ts:48-93`); no pre-auth session to fixate |

---

## 5. Strengths (verified)

- **Dual-layer session verification.** `getCurrentSession()` validates the JWT signature/expiry
  *and* confirms a live `sessions` row (`session.ts:106-114`) — enabling real server-side
  revocation, which JWT-only designs lack.
- **Redundant authorization at every layer.** Middleware (routing) → server actions
  (`requireSession()` + `hasPermission()`) → **data API routes** return genuine `401`/`403`
  (`api/students/route.ts:13-21`, `api/portal/payments/route.ts:10-16`). UI hiding is not relied on
  for security.
- **Correct cookie hardening.** `httpOnly: true`, `secure` in production, `path:"/"`, explicit
  `expires` (`session.ts:86-92`).
- **Strong JWT setup.** HS256 via `jose` with an enforced ≥32-byte `AUTH_SECRET`; payload carries
  `sessionId`, `userId`, `role`, `forcePasswordChange`.
- **Session-fixation resistant.** Every login inserts a new `sessions` row and mints a new token; no
  anonymous pre-auth session exists to be fixed.
- **Login anti-abuse.** Timing-neutral comparison (dummy-hash path for unknown users) + IP-based
  rate limiting, defeating user enumeration and brute force.
- **Forced-password-change gate** enforced in middleware (`proxy.ts:89-98`).
- **Session table is correctly indexed** for both lookup (`token` unique) and cleanup (`expiresAt`).
- **Cron cleanup endpoint** is secret-gated and fails safe (`503`) when unconfigured.
- **`.env*` is gitignored** — no live secrets committed (verified against `.gitignore:36-37`).

---

## 6. Out-of-Scope but Critical — flagged for visibility · **X-1**

> Outside the auth/session/RBAC scope of this audit, but too serious to omit.

**A full database dump, `srams_backup.sql`, is committed to git history** (introduced in commit
`77c4a08`; the working-tree copy is staged for deletion, which does **not** remove it from history).
A school DB dump almost certainly contains student/guardian **PII**, medical history, and likely
**password hashes**. Anyone with repository (or fork/clone) access can recover it.

**Remediate before any external sharing of the repo:**
1. Purge the file from history (`git filter-repo --path srams_backup.sql --invert-paths`, or BFG),
   then force-push and have all collaborators re-clone.
2. **Rotate** anything the dump may have exposed — at minimum `AUTH_SECRET` (invalidates all live
   sessions) and DB credentials; consider forcing a password reset for seeded/admin accounts.
3. Add `*.sql` (or `*backup*.sql`) to `.gitignore` to prevent recurrence.

A standalone deep-dive on financial-integrity findings (hard-deletes of `payments`/`assessmentItems`,
mutable `audit_logs`, discount `studentId`/enrollment validation) is recommended as a follow-up audit
— it is outside this report's auth-layer scope.

---

## 7. Remediation Roadmap

**Immediate**
- **X-1** — purge `srams_backup.sql` from git history + rotate `AUTH_SECRET`/DB creds.
- **A-1** — fix the unrecognised-role redirect loop in `proxy.ts`.

**Short-term (hardening)**
- **A-2** — bind sessions to User-Agent (hard-fail) and log IP changes.
- **A-4** — switch the session cookie to `SameSite=Strict`.
- **A-5** — remove the `GET` alias on the cron cleanup endpoint.
- **A-3** — document the optimistic-middleware trade-off (or add a revocation check).

**Backlog / optional**
- **A-6** — raise bcrypt cost to 12 with transparent re-hash on login.
- Commission the financial-integrity follow-up audit referenced in §6.

---

## 8. Appendix

**Primary files reviewed:** `proxy.ts` · `src/lib/auth/session.ts` · `src/lib/auth/session-token.ts`
· `src/lib/db/schema.ts` (`sessions`) · `src/lib/rbac/permissions.ts` · `src/lib/constants/roles.ts`
· `src/app/api/students/route.ts` · `src/app/api/portal/payments/route.ts` ·
`src/app/api/cron/cleanup-sessions/route.ts`.

**Severity rubric:** *High* = exploitable or causes lockout under a realistic condition; *Medium* =
weakens a control / requires a precondition or additional access; *Low* = hardening / defence-in-depth;
*Informational* = no change required, documented for completeness. *Critical (X-1)* = direct exposure
of sensitive data.

**Limitations:** static read-only review; no dynamic testing, fuzzing, or dependency-CVE scan was
performed. All fixes are recommendations and were **not** applied to the codebase.
