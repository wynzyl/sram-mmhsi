# Implementation Plan: Separate Admin and Academic Portals (Containerized)

## Overview

Split SRAMS into two separate containers with distinct subdomains:

| Container | Subdomain | Roles | Routes |
|-----------|-----------|-------|--------|
| **Admin** | `admin.srams.com` | super_admin, admin, registrar, finance_officer, cashier | `/login`, `/admin/*`, `/staff/*` |
| **Portal** | `portal.srams.com` | teacher, coordinator, principal, student, parent_guardian | `/login`, `/portal/*` |

## Deployment Architecture

```
                         Internet
                            │
                    ┌───────┴───────┐
                    │  Cloudflared  │  (Cloudflare Tunnel)
                    │   Tunnel      │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │ Nginx Proxy   │  (proxy-network)
                    │   Manager     │
                    └───────┬───────┘
              ┌─────────────┴─────────────┐
              │                           │
    ┌─────────┴─────────┐       ┌─────────┴─────────┐
    │  srams_app_admin  │       │  srams_app_portal │
    │ (admin.srams.com) │       │(portal.srams.com) │
    │                   │       │                   │
    │  - /login         │       │  - /login         │
    │  - /admin/*       │       │  - /portal/*      │
    │  - /staff/*       │       │  - /portal/grades │
    └─────────┬─────────┘       └─────────┬─────────┘
              │                           │
              └───────────┬───────────────┘
                          │  (srams-network)
                   ┌──────┴──────┐
                   │  srams_db   │
                   │ (PostgreSQL)│
                   └─────────────┘
```

### Network Topology
- **proxy-network**: External network shared with NPM (both app containers)
- **srams-network**: Internal network for database access
- **npm-network**: NPM's internal network (Portainer, Cloudflared)

### Key Decisions
- **Shared codebase** - Same repo, different builds via `APP_MODE` env var
- **Subdomains** - `admin.srams.com` and `portal.srams.com`
- **Isolated sessions** - Each subdomain has its own session cookie
- **Shared database** - Both containers connect to same PostgreSQL

## Build Configuration

### Environment Variable
```bash
APP_MODE=admin   # For admin container
APP_MODE=portal  # For portal container
```

### Docker Build
```bash
# Admin container
docker build --build-arg APP_MODE=admin -t srams-admin .

# Portal container
docker build --build-arg APP_MODE=portal -t srams-portal .
```

### Route Inclusion per Build

**Admin Build (`APP_MODE=admin`):**
- `/login` - Operations login
- `/admin/*` - Admin dashboard, users, settings
- `/staff/*` - Registrar, finance, cashier workflows
- `/change-password` - Staff password change
- `/api/*` - All API routes

**Portal Build (`APP_MODE=portal`):**
- `/login` - Academic login (teachers + students)
- `/portal/*` - All portal routes including grades
- `/api/*` - All API routes

---

## Implementation Tasks

### Phase 1: Build Configuration

**File: `next.config.ts`**

Add build-time route filtering based on `APP_MODE`:

```typescript
const appMode = process.env.APP_MODE || 'admin'; // default to admin

const nextConfig: NextConfig = {
  // ... existing config

  // Exclude routes not needed for this build
  experimental: {
    // ... existing experimental options
  },

  // Custom webpack config to set APP_MODE at build time
  env: {
    APP_MODE: appMode,
  },
};
```

**File: `src/lib/constants/app-mode.ts` (NEW)**

```typescript
export type AppMode = 'admin' | 'portal';

export const APP_MODE: AppMode = (process.env.APP_MODE as AppMode) || 'admin';

export const isAdminBuild = APP_MODE === 'admin';
export const isPortalBuild = APP_MODE === 'portal';
```

---

### Phase 2: Role Constants

**File: `src/lib/constants/roles.ts`**

Add new role groupings:
```typescript
// Operations staff (admin container only)
export const ADMIN_BUILD_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.REGISTRAR,
  ROLES.FINANCE_OFFICER,
  ROLES.CASHIER,
];

// Academic staff (portal container, users table)
export const ACADEMIC_STAFF_ROLES: Role[] = [
  ROLES.TEACHER,
  ROLES.COORDINATOR,
  ROLES.PRINCIPAL,
];

// All portal container users
export const PORTAL_BUILD_ROLES: Role[] = [
  ...ACADEMIC_STAFF_ROLES,
  ROLES.STUDENT,
  ROLES.PARENT_GUARDIAN,
];
```

Update `ROLE_LANDING` to be build-aware:
```typescript
import { APP_MODE } from './app-mode';

// Landings relative to each container's root
export const ROLE_LANDING: Record<Role, string> = {
  // Admin container landings
  super_admin: "/admin/dashboard",
  admin: "/admin/dashboard",
  registrar: "/staff/dashboard",
  finance_officer: "/staff/finance",
  cashier: "/staff/payments",
  // Portal container landings
  teacher: "/portal/grades",
  coordinator: "/portal/grades",
  principal: "/portal/grades",
  student: "/portal/dashboard",
  parent_guardian: "/portal/dashboard",
};
```

---

### Phase 3: Authentication Actions

**File: `src/features/auth/auth.actions.ts`**

Update `loginAction` to validate roles based on `APP_MODE`:

```typescript
import { APP_MODE } from '@/lib/constants/app-mode';
import { ADMIN_BUILD_ROLES, PORTAL_BUILD_ROLES, ACADEMIC_STAFF_ROLES } from '@/lib/constants/roles';

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  // ... existing validation

  if (APP_MODE === 'admin') {
    // Admin container: reject portal users
    if (isStudentReferenceNumber(username)) {
      return { message: "Student accounts cannot log in here. Please use the student portal." };
    }
    return handleAdminLogin(username, password, clientIp);
  } else {
    // Portal container: accept teachers + students
    return handlePortalLogin(username, password, clientIp);
  }
}

async function handleAdminLogin(...): Promise<LoginFormState> {
  // Lookup user, validate password
  // REJECT if role NOT in ADMIN_BUILD_ROLES
  if (!ADMIN_BUILD_ROLES.includes(normalizedRole)) {
    return { message: "Your account does not have access to this portal." };
  }
  // Create session with accountSource: "staff"
}

async function handlePortalLogin(...): Promise<LoginFormState> {
  // If 7-digit: existing portalAccounts flow
  // Else: lookup users table
  //   REJECT if role NOT in ACADEMIC_STAFF_ROLES
  // Create session with accountSource: "portal"
}
```

---

### Phase 4: Unified Login Page

**File: `src/app/login/page.tsx`**

Single login page that adapts to build mode:

```typescript
import { APP_MODE } from '@/lib/constants/app-mode';

export default function LoginPage() {
  return (
    <div className="...">
      <h1>{APP_MODE === 'admin' ? 'SRAMS Operations' : 'SRAMS Academic Portal'}</h1>
      <LoginForm />
      {APP_MODE === 'portal' && (
        <p className="text-sm text-muted-foreground">
          Teachers: Use your staff username. Students: Use your 7-digit reference number.
        </p>
      )}
    </div>
  );
}
```

---

### Phase 5: Route Protection (proxy.ts)

**File: `proxy.ts`**

Simplified protection since each container only has its routes:

```typescript
import { APP_MODE } from '@/lib/constants/app-mode';
import { ADMIN_BUILD_ROLES, PORTAL_BUILD_ROLES } from '@/lib/constants/roles';

export async function proxy(req: NextRequest) {
  // ... existing session validation

  // Build-specific route validation
  if (isAuthenticated && role) {
    if (APP_MODE === 'admin' && !ADMIN_BUILD_ROLES.includes(role)) {
      // Non-admin role on admin container - clear session, redirect to login
      const res = NextResponse.redirect(new URL('/login', req.nextUrl));
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (APP_MODE === 'portal' && !PORTAL_BUILD_ROLES.includes(role)) {
      // Non-portal role on portal container - clear session, redirect to login
      const res = NextResponse.redirect(new URL('/login', req.nextUrl));
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
  }

  // ... rest of existing logic
}
```

---

### Phase 6: Move Teacher Grade Routes to Portal

**Move routes from `/staff/grades/*` to `/portal/grades/*`:**

| From | To |
|------|-----|
| `src/app/staff/grades/page.tsx` | `src/app/portal/grades/page.tsx` |
| `src/app/staff/grades/loading.tsx` | `src/app/portal/grades/loading.tsx` |
| `src/app/staff/grades/sections/[sectionId]/*` | `src/app/portal/grades/sections/[sectionId]/*` |
| `src/app/staff/grades/sheets/[sheetId]/*` | `src/app/portal/grades/sheets/[sheetId]/*` |
| `src/app/staff/grades/approvals/*` | `src/app/portal/grades/approvals/*` |
| `src/app/staff/grades/publish/*` | `src/app/portal/grades/publish/*` |
| `src/app/staff/grades/published/*` | `src/app/portal/grades/published/*` |
| `src/app/staff/grades/locked/*` | `src/app/portal/grades/locked/*` |

**Update all imports and navigation links in moved files.**

---

### Phase 7: Layout Updates

**File: `src/app/portal/layout.tsx`**

Update to accept both academic staff and student sessions:

```typescript
async function PortalLayoutContent({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  // Get user based on session type
  const user = session.portalAccountId
    ? await getPortalUser()  // Student/parent (portalAccounts table)
    : await getStaffUser();  // Teacher/coordinator/principal (users table)

  if (!user) redirect(INVALID_SESSION_REDIRECT);

  // Display name differs by user type
  const displayName = session.portalAccountId
    ? `${user.student.firstName} ${user.student.lastName}`
    : user.username;

  // ... rest of layout
}
```

**File: `src/components/layout/AppSidebar.tsx`**

Update navigation for portal roles:
- Teachers: `/portal/grades`, `/portal/grades/sections`, etc.
- Students: `/portal/dashboard`, `/portal/assessments`, `/portal/payments`, `/portal/grades` (view only)

---

### Phase 8: Session Handling

**File: `src/lib/auth/session.ts`**

Ensure session cookie is subdomain-specific (default behavior):

```typescript
// Session cookie should NOT have domain attribute
// This makes it subdomain-specific: admin.srams.com and portal.srams.com have separate cookies
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // NO domain attribute - cookies are subdomain-specific
};
```

---

### Phase 9: Docker Configuration

**File: `Dockerfile`**

Add `APP_MODE` build arg to builder and runner stages:

```dockerfile
# --- Builder stage ---
FROM node:24-alpine AS builder
WORKDIR /app

# Build argument for portal separation
ARG APP_MODE=admin

# ... existing apk install, npm install, COPY ...

ENV NEXT_PUBLIC_SKIP_ENV_VALIDATION="true"
ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/srams_build"
# Pass APP_MODE to Next.js build
ENV APP_MODE=${APP_MODE}

# ... existing RUN block for postgres + build ...

# --- Runtime stage ---
FROM node:24-alpine AS runner
WORKDIR /app

# Runtime APP_MODE (must match build-time value)
ARG APP_MODE=admin
ENV APP_MODE=${APP_MODE}

# ... rest of existing runner stage ...
```

**File: `docker-compose.prod.yml`**

Update to run two app containers (admin + portal):

```yaml
name: sram-mmhsi

networks:
  srams-network:
    driver: bridge
  proxy-network:
    external: true
    driver: bridge

services:
  srams_db:
    # ... existing database config (unchanged) ...

  migrate:
    # ... existing migrate config (unchanged) ...

  # Admin container (operations staff)
  app-admin:
    image: sram-mmhsi-app:admin
    build:
      context: .
      target: runner
      args:
        APP_MODE: admin
    container_name: srams_app_admin
    restart: always
    deploy:
      resources:
        limits:
          memory: 1024M
          cpus: '1'
        reservations:
          memory: 384M
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      HOSTNAME: "0.0.0.0"
      APP_MODE: admin
      SESSION_COOKIE_SECURE: ${SESSION_COOKIE_SECURE:-true}
    volumes:
      - uploads_data:/app/public/uploads
    depends_on:
      srams_db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    networks:
      - srams-network
      - proxy-network

  # Portal container (teachers + students)
  app-portal:
    image: sram-mmhsi-app:portal
    build:
      context: .
      target: runner
      args:
        APP_MODE: portal
    container_name: srams_app_portal
    restart: always
    deploy:
      resources:
        limits:
          memory: 1024M
          cpus: '1'
        reservations:
          memory: 384M
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      HOSTNAME: "0.0.0.0"
      APP_MODE: portal
      SESSION_COOKIE_SECURE: ${SESSION_COOKIE_SECURE:-true}
    volumes:
      - uploads_data:/app/public/uploads
    depends_on:
      srams_db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    networks:
      - srams-network
      - proxy-network

volumes:
  db-data:
  uploads_data:
    driver: local
```

**Nginx Proxy Manager Configuration:**

Configure via NPM web UI (http://localhost:81):

1. **Admin Proxy Host:**
   - Domain: `admin.srams.com` (or your domain)
   - Forward Hostname: `srams_app_admin`
   - Forward Port: `3000`
   - Enable SSL via Let's Encrypt or Cloudflare

2. **Portal Proxy Host:**
   - Domain: `portal.srams.com` (or your domain)
   - Forward Hostname: `srams_app_portal`
   - Forward Port: `3000`
   - Enable SSL via Let's Encrypt or Cloudflare

**Cloudflare Tunnel Configuration:**

If using Cloudflare tunnel, update the tunnel config to route:
- `admin.yourdomain.com` → `http://nginx-proxy-manager:80`
- `portal.yourdomain.com` → `http://nginx-proxy-manager:80`

NPM handles the subdomain routing to the correct container.

---

## Files Summary

### New Files
1. `src/lib/constants/app-mode.ts` - APP_MODE constant and helpers
2. `docker-compose.yml` - Multi-container orchestration (if not exists)

### Modified Files
1. `next.config.ts` - Add APP_MODE env variable
2. `src/lib/constants/roles.ts` - Add ADMIN_BUILD_ROLES, PORTAL_BUILD_ROLES
3. `src/features/auth/auth.actions.ts` - Build-aware login validation
4. `proxy.ts` - Build-aware route protection
5. `src/app/login/page.tsx` - Build-aware branding/hints
6. `src/app/portal/layout.tsx` - Accept academic staff sessions
7. `src/components/layout/AppSidebar.tsx` - Update navigation for portal roles
8. `Dockerfile` - Add APP_MODE build arg to builder and runner stages
9. `docker-compose.prod.yml` - Split `app` into `app-admin` and `app-portal` services

### Moved Files (staff/grades → portal/grades)
- `src/app/staff/grades/page.tsx` → `src/app/portal/grades/page.tsx`
- `src/app/staff/grades/loading.tsx` → `src/app/portal/grades/loading.tsx`
- `src/app/staff/grades/sections/*` → `src/app/portal/grades/sections/*`
- `src/app/staff/grades/sheets/*` → `src/app/portal/grades/sheets/*`
- `src/app/staff/grades/approvals/*` → `src/app/portal/grades/approvals/*`
- `src/app/staff/grades/publish/*` → `src/app/portal/grades/publish/*`
- `src/app/staff/grades/published/*` → `src/app/portal/grades/published/*`
- `src/app/staff/grades/locked/*` → `src/app/portal/grades/locked/*`

### Deleted Files (after move)
- `src/app/staff/grades/*` - All files (moved to portal)

---

## Verification Plan

### Build Verification
```bash
# Build admin container
APP_MODE=admin npm run build
# Verify: Build should succeed with admin/staff routes

# Build portal container
APP_MODE=portal npm run build
# Verify: Build should succeed with portal routes
```

### Admin Container Testing (`admin.srams.com`)

**Login:**
- [ ] Admin can log in → redirects to `/admin/dashboard`
- [ ] Registrar can log in → redirects to `/staff/dashboard`
- [ ] Finance officer can log in → redirects to `/staff/finance`
- [ ] Cashier can log in → redirects to `/staff/payments`
- [ ] Teacher CANNOT log in → shows "does not have access" error
- [ ] Student reference number CANNOT log in → shows "use student portal" error

**Routes:**
- [ ] `/admin/dashboard` loads correctly
- [ ] `/staff/finance` loads correctly
- [ ] `/staff/payments` loads correctly
- [ ] `/staff/students` loads correctly

### Portal Container Testing (`portal.srams.com`)

**Login:**
- [ ] Teacher can log in with username → redirects to `/portal/grades`
- [ ] Coordinator can log in → redirects to `/portal/grades`
- [ ] Principal can log in → redirects to `/portal/grades`
- [ ] Student can log in with ref number → redirects to `/portal/dashboard`
- [ ] Admin CANNOT log in → shows "does not have access" error
- [ ] Cashier CANNOT log in → shows "does not have access" error

**Routes:**
- [ ] `/portal/dashboard` loads correctly for students
- [ ] `/portal/grades` loads correctly for teachers
- [ ] `/portal/grades/sections/[id]` loads correctly for teachers
- [ ] `/portal/assessments` loads correctly for students
- [ ] `/portal/payments` loads correctly for students

### Session Isolation
- [ ] Login on admin.srams.com does NOT create session on portal.srams.com
- [ ] Login on portal.srams.com does NOT create session on admin.srams.com
- [ ] Logout on one subdomain does NOT affect the other

### Docker Verification
```bash
# Build both container images
docker compose -f docker-compose.prod.yml build app-admin app-portal

# Start all services (db, migrate, both apps)
docker compose -f docker-compose.prod.yml up -d

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Verify admin container directly
docker exec srams_app_admin wget -qO- http://127.0.0.1:3000/api/health

# Verify portal container directly
docker exec srams_app_portal wget -qO- http://127.0.0.1:3000/api/health

# Check logs for startup issues
docker compose -f docker-compose.prod.yml logs app-admin
docker compose -f docker-compose.prod.yml logs app-portal
```

### NPM Configuration Steps
1. Access NPM at `http://localhost:81`
2. Add Proxy Host for admin subdomain → forward to `srams_app_admin:3000`
3. Add Proxy Host for portal subdomain → forward to `srams_app_portal:3000`
4. Configure SSL certificates (Let's Encrypt or Cloudflare origin)

---

## Rollback Plan

If issues arise:
1. Revert `APP_MODE` logic in auth.actions.ts - restore original loginAction
2. Revert proxy.ts changes
3. Move grade routes back to `/staff/grades/*`
4. Deploy single container with original configuration

---

## Future Considerations

1. **Shared session option** - If needed later, set cookie domain to `.srams.com`
2. **Route exclusion** - Consider using Next.js route groups with build-time exclusion
3. **Health checks** - Update container health checks to verify correct APP_MODE
4. **Logging** - Add APP_MODE to all log entries for debugging
