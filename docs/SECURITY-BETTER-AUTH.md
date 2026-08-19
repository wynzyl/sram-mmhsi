# SRAMS better-auth Integration Plan

## Overview

Migrate SRAMS from custom JWT-based authentication (jose library) to better-auth framework while preserving all existing security features, 10 roles with 60+ permissions, and business-specific functionality.

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Password Storage | Migrate to `account` table (better-auth standard) |
| RBAC Approach | Keep existing `hasPermission()` system, wrap better-auth session |
| Rollout Strategy | Phased with `USE_BETTER_AUTH` feature flag |

## Current State

| Component | Implementation |
|-----------|----------------|
| JWT Library | `jose` (HS256) |
| Password Hashing | bcrypt cost 12 |
| Session Storage | PostgreSQL `sessions` table |
| Session Duration | 10 hours |
| Rate Limiting | Custom per-IP (10/15min) + per-username (5/15min) with exponential backoff |
| RBAC | 10 roles, 60+ permissions in flat map (`src/lib/rbac/permissions.ts`) |
| Session Binding | UA hard-fail, IP soft-log |

## Integration Approach

**Strategy: Incremental migration with backward compatibility wrappers**

better-auth will handle:
- Session creation/validation (replaces jose JWT logic)
- Password hashing/verification (keep bcrypt cost 12)
- User lookup (username plugin)
- Database operations via Drizzle adapter

SRAMS will retain:
- Custom rate limiting (Sentinel requires paid API)
- RBAC permission checks (`hasPermission` function)
- Audit logging via better-auth hooks
- Force password change gate

---

## Phase 1: Schema Preparation

### 1.1 New Tables Required

```sql
-- Migration: XXXX_better_auth_tables.sql

-- Account table (required by better-auth for credential storage)
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX account_user_id_idx ON account(user_id);

-- Verification table (for password reset, email verification)
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX verification_identifier_idx ON verification(identifier);

-- Add better-auth required columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;

-- Populate name from username for existing users
UPDATE users SET name = username WHERE name IS NULL;
```

### 1.2 Password Migration

```sql
-- One-time migration: copy passwords to account table
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  id::text,
  'credential',
  id,
  password_hash,
  created_at,
  COALESCE(updated_at, created_at)
FROM users
WHERE password_hash IS NOT NULL AND deleted_at IS NULL;
```

---

## Phase 2: better-auth Configuration

### 2.1 Core Configuration

**New file: `src/lib/auth/better-auth.ts`**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { admin as adminPlugin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { users, sessions, account, verification } from "@/lib/db/schema";
import { hash, compare } from "bcryptjs";
import { ac, roles } from "./access-control";
import { logAudit } from "@/lib/utils/audit-logger";

const BCRYPT_COST = 12;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: users, session: sessions, account, verification },
  }),

  session: {
    expiresIn: 10 * 60 * 60, // 10 hours
    updateAge: 60 * 60,
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: async (password) => hash(password, BCRYPT_COST),
      verify: async ({ hash, password }) => compare(password, hash),
    },
  },

  user: {
    additionalFields: {
      username: { type: "string", required: true, unique: true },
      role: { type: "string", required: true, defaultValue: "student" },
      isActive: { type: "boolean", required: true, defaultValue: true },
      forcePasswordChange: { type: "boolean", required: true, defaultValue: false },
      defaultBookletId: { type: "string", required: false },
      deletedAt: { type: "date", required: false },
      deletedBy: { type: "string", required: false },
    },
  },

  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 50 }),
    adminPlugin({ ac, roles, defaultRole: "student" }),
    nextCookies(), // Must be last
  ],

  databaseHooks: {
    session: {
      create: {
        before: async (session, ctx) => {
          // Capture IP/UA for session binding
          const headers = ctx.context?.request?.headers;
          return {
            data: {
              ...session,
              ipAddress: headers?.get("x-forwarded-for")?.split(",")[0]?.trim(),
              userAgent: headers?.get("user-agent"),
            },
          };
        },
        after: async (session) => {
          await logAudit({
            actor: session.userId,
            actorRole: "system",
            action: "auth:login_success",
            targetEntity: "sessions",
            targetId: session.id,
          });
        },
      },
    },
  },
});
```

### 2.2 Access Control Mapping

**New file: `src/lib/auth/access-control.ts`**

```typescript
import { createAccessControl } from "better-auth/plugins/access";

// Map SRAMS permission structure to better-auth
const statement = {
  students: ["read", "create", "update", "delete"],
  registrations: ["read", "create", "review"],
  curriculums: ["read", "create", "edit", "publish", "archive", "adopt"],
  subjects: ["manage"],
  enrollments: ["read", "create", "update", "confirm", "cancel", "cancel_with_balance", "override_enroll"],
  assessments: ["read", "create", "update", "reverse_transfer", "cancel", "cancel_with_balance"],
  payments: ["read", "post", "void", "void_request", "void_approve"],
  invoices: ["read", "send"],
  grades: ["read", "encode", "submit", "principal_review", "publish", "lock", "unlock"],
  advisers: ["read", "manage"],
  booklets: ["manage"],
  reports: ["view", "finance", "academic"],
  discounts: ["read", "request", "review", "manage", "apply"],
  clearances: ["read", "create", "resolve"],
  archive: ["read", "manage"],
  documents: ["read", "create", "process", "release"],
  sections: ["assign", "manage"],
  strands: ["read", "manage"],
  subject_offerings: ["read", "generate", "create", "assign_teacher"],
  student_subject_enrollments: ["read", "manage"],
  users: ["manage"],
  school_years: ["manage"],
  fee_schedules: ["manage"],
  assignments: ["manage"],
  system: ["manage"],
} as const;

export const ac = createAccessControl(statement);

// Define all 10 roles with their permissions
export const roles = {
  super_admin: ac.newRole({ /* all permissions */ }),
  admin: ac.newRole({ /* admin permissions */ }),
  registrar: ac.newRole({ /* registrar permissions */ }),
  finance_officer: ac.newRole({ /* finance permissions */ }),
  cashier: ac.newRole({ /* cashier permissions */ }),
  teacher: ac.newRole({ /* teacher permissions */ }),
  coordinator: ac.newRole({ /* coordinator permissions */ }),
  principal: ac.newRole({ /* principal permissions */ }),
  student: ac.newRole({ /* student permissions */ }),
  parent_guardian: ac.newRole({ /* parent permissions */ }),
};
```

### 2.3 API Route Handler

**New file: `src/app/api/auth/[...all]/route.ts`**

```typescript
import { auth } from "@/lib/auth/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

---

## Phase 3: Session Management Migration

### 3.1 Update Session Module

**Modify: `src/lib/auth/session.ts`**

Keep the same API surface (`getCurrentSession`, `requireSession`, `getCurrentUser`, etc.) but delegate to better-auth internally:

```typescript
import { auth } from "./better-auth";
import { headers } from "next/headers";
import { cache } from "react";

export const getCurrentSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Validate session binding (preserve existing UA/IP logic)
  const isValid = await validateSessionBinding(session.session);
  if (!isValid) return null;

  // Return payload in existing format for backward compatibility
  return {
    sessionId: session.session.id,
    userId: session.user.id,
    role: session.user.role,
    expiresAt: session.session.expiresAt,
    forcePasswordChange: session.user.forcePasswordChange,
  };
});
```

---

## Phase 4: Auth Actions Migration

### 4.1 Login Action

**Modify: `src/features/auth/auth.actions.ts`**

```typescript
export async function loginAction(prevState: LoginFormState, formData: FormData) {
  const { username, password } = parseFormData(formData);

  // 1. Apply SRAMS rate limiting (keep custom implementation)
  const clientIp = extractClientIPForRateLimit(await headers());
  const rateLimitCheck = checkLoginRateLimits(clientIp, username);
  if (rateLimitCheck.blocked) {
    return { message: rateLimitCheck.message };
  }

  // 2. Call better-auth
  try {
    const result = await auth.api.signIn.username({ body: { username, password } });
    resetLoginRateLimits(clientIp, username);

    // 3. Handle forcePasswordChange
    if (result.user.forcePasswordChange) {
      redirect("/change-password");
    }

    redirect(ROLE_LANDING[result.user.role]);
  } catch {
    recordLoginFailures(clientIp, username);
    return { message: "Invalid credentials." };
  }
}
```

---

## Phase 5: Middleware Migration

### 5.1 Update Proxy

**Modify: `proxy.ts`**

```typescript
import { auth } from "@/lib/auth/better-auth";

export async function proxy(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  // Keep all existing route protection logic
  // Replace payload structure references with better-auth session structure
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/auth/better-auth.ts` | Core better-auth configuration |
| `src/lib/auth/access-control.ts` | RBAC statement and role definitions |
| `src/app/api/auth/[...all]/route.ts` | better-auth API handler |
| `drizzle/XXXX_better_auth_tables.sql` | Schema migration |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/auth/session.ts` | Wrap better-auth, keep API surface |
| `src/lib/db/schema.ts` | Add account, verification tables |
| `src/features/auth/auth.actions.ts` | Use better-auth for login/logout |
| `proxy.ts` | Use better-auth session validation |

## Files to Keep Unchanged

| File | Reason |
|------|--------|
| `src/lib/rbac/permissions.ts` | Keep `hasPermission()` for server actions |
| `src/lib/security/rateLimit.ts` | Keep custom rate limiting |
| `src/lib/utils/audit-logger.ts` | Keep existing audit system |

---

## Verification Plan

1. **Login Flow**
   - Test all 10 roles can login with username
   - Test login with email (should also work)
   - Verify rate limiting blocks after threshold
   - Verify exponential backoff activates

2. **Session Security**
   - Verify UA mismatch invalidates session
   - Verify IP change is logged (soft-fail)
   - Verify 10-hour expiration works

3. **RBAC**
   - Test `hasPermission()` for all 60+ permissions
   - Verify server actions check permissions correctly

4. **Force Password Change**
   - Verify gate redirects to `/change-password`
   - Verify flag clears after password change

5. **Audit Logging**
   - Verify login success/failure logged
   - Verify user operations logged via hooks

---

## Rollback Strategy

1. Keep `passwordHash` column in users table for 30 days
2. Feature flag: `USE_BETTER_AUTH=true|false`
3. Dual-path session validation during transition

```typescript
const USE_BETTER_AUTH = process.env.USE_BETTER_AUTH === "true";

export async function getCurrentSession() {
  return USE_BETTER_AUTH
    ? getCurrentSessionBetterAuth()
    : getCurrentSessionLegacy();
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Active sessions invalidated | Schedule migration during off-hours |
| Password migration fails | Keep dual read from users.passwordHash |
| Permission mapping errors | Comprehensive permission test coverage |
| Rate limiting bypass | Keep custom implementation (not Sentinel) |

---

## Estimated Effort

- Phase 1 (Schema): 1 day
- Phase 2 (better-auth config): 2 days
- Phase 3 (Session migration): 1 day
- Phase 4 (Auth actions): 1 day
- Phase 5 (Middleware): 1 day
- Testing: 2 days
- **Total: ~8 days**
