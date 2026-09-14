# System Monitoring Feature Design Plan

**Feature:** System Uptime & Logs Monitoring for Super Admin
**Status:** Design Complete — Ready for Implementation Planning
**Date:** 2026-09-07

---

## Overview

Implement a System Monitoring module for `super_admin` users in SRAMS to monitor:
- Application-level health indicators (DB connectivity, server status, memory)
- Suspicious login attempts (rate limit violations + pattern detection)
- Active sessions with force logout capability
- Full audit log exploration

---

## Requirements Summary

| Aspect | Decision |
|--------|----------|
| System Uptime | Application-level health (DB, server status, memory) |
| Suspicious Login | Rate limit violations + pattern-based detection |
| Audit Logs | Security Events dashboard + Full Audit Log explorer |
| Sessions | View all active sessions + Force logout |
| Alerting | Dashboard indicators only (no email/notifications) |

---

## Section 1: Route Structure & Access Control ✅

**Routes:**
```
/admin/monitoring              → Overview dashboard (health + alerts summary)
/admin/monitoring/security     → Security events (suspicious logins, rate limits)
/admin/monitoring/sessions     → Active sessions with force logout
/admin/monitoring/audit-logs   → Full audit log explorer
```

**Access Control:**
- All routes restricted to `super_admin` role only (not regular `admin`)
- Layout-level guard in `/admin/monitoring/layout.tsx` using `requireSession()` + role check
- Server actions verify `role === 'super_admin'` before executing
- All monitoring actions logged to `audit_logs`

**Navigation:**
- Add "System Monitoring" item to admin sidebar (visible only to `super_admin`)
- Sub-navigation within monitoring section for the 4 pages

---

## Section 2: Database Changes ✅

**New Table: `login_attempts`**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID, PK | Primary key |
| username | text | Attempted username |
| ipAddress | text | SHA-256 hashed for privacy |
| userAgent | text | Browser/device info |
| success | boolean | Login succeeded or failed |
| failureReason | text, nullable | "invalid_password", "account_locked", "rate_limited" |
| attemptedAt | timestamp | When attempt occurred |
| userId | UUID, nullable, FK → users | Populated on successful staff login |
| portalAccountId | UUID, nullable, FK → portalAccounts | For portal logins |

**Indexes:** `(ipAddress, attemptedAt)`, `(username, attemptedAt)`, `attemptedAt`, `success`

**New Table: `security_events`**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID, PK | Primary key |
| eventType | enum | 'rate_limit_exceeded', 'brute_force_detected', 'unusual_login_time', 'success_after_failures', 'session_terminated' |
| severity | enum | 'low', 'medium', 'high', 'critical' |
| ipAddress | text | Hashed IP |
| username | text, nullable | Target username |
| userId | UUID, nullable, FK → users | Staff user if applicable |
| portalAccountId | UUID, nullable, FK → portalAccounts | Portal account if applicable |
| metadata | jsonb | Event-specific details |
| acknowledged | boolean, default false | Marked as reviewed |
| acknowledgedBy | UUID, nullable, FK → users | Who acknowledged |
| acknowledgedAt | timestamp, nullable | When acknowledged |
| createdAt | timestamp | When event was created |

**Retention:** `login_attempts` 90 days, `security_events` 365 days

---

## Section 3: Application Health Indicators ✅

| Indicator | Method | Status Values |
|-----------|--------|---------------|
| Database | `SELECT 1` + response time | ✅ Connected (<100ms) / ⚠️ Slow / ❌ Down |
| Server | `process.uptime()` | ✅ Online + uptime duration |
| Memory | `process.memoryUsage()` | ✅ Normal (<80%) / ⚠️ High / ❌ Critical |
| Active Sessions | Count from `sessions` table | Count displayed |

**Overview Dashboard displays:**
- 4 health status cards
- Recent security alerts (last 24h) with "View All" link
- Quick stats: failed logins, successful logins, unacknowledged alerts

---

## Section 4: Security Events & Suspicious Login Detection ✅

**Detection Rules:**

| Event Type | Trigger | Severity |
|------------|---------|----------|
| `rate_limit_exceeded` | IP/username hits rate limit | Medium |
| `brute_force_detected` | 10+ failed attempts from same IP in 15 min | High |
| `unusual_login_time` | Successful login outside 6 AM - 10 PM | Low |
| `success_after_failures` | Login succeeds after 5+ consecutive failures | Medium |
| `session_terminated` | Super_admin force-logged out a session | Low |

**Hook Points:**
- `auth.actions.ts` login flow → insert `login_attempts`, check patterns
- On rate limit hit → create security event
- On successful login → check for unusual time / success after failures

**School Hours:** Configurable in `src/lib/constants/system-values.ts`

---

## Section 5: Session Management ✅

**Sessions Table Columns:**
- User (email or portal username)
- Role (staff role or "Portal")
- IP Address (masked)
- Device (parsed user-agent)
- Started / Last Active
- Status (Active / Idle)
- Actions (Force Logout button)

**Force Logout Flow:**
1. Confirmation dialog
2. Server action `terminateSession(sessionId)`:
   - Verify caller is `super_admin`
   - Delete session from DB
   - Create `security_events` entry
   - Log to `audit_logs`
3. UI updates

**Protection:** Cannot terminate own session (button hidden + server validation)

---

## Section 6: Full Audit Log Explorer ✅

**Filters:**
- Date Range (presets: 24h, 7d, 30d, custom)
- Action Type (multi-select)
- Actor (search autocomplete)
- Entity Type (dropdown)
- Entity ID (text)

**Table Columns:** Timestamp, Actor, Action, Entity, Changes (expandable diff), IP

**Features:**
- Server-side pagination (50 rows/page)
- CSV export (server-generated)
- URL-based filter state (shareable links)
- Expandable state diff view per row

---

## Section 7: Components & UI ✅

**New Components:**

| Component | Purpose |
|-----------|---------|
| `HealthStatusCard` | Single health metric display |
| `SeverityBadge` | Color-coded severity indicator |
| `SecurityEventCard` | Event display with acknowledge action |
| `SessionRow` | Session table row with force logout |
| `AuditLogRow` | Expandable audit entry |
| `StateDiffViewer` | JSON diff display |
| `DateRangeFilter` | Date picker with presets |

**Reuse Existing:** `DataTable`, `StatusBadge`, `StatCard`, `PageHeader`, `ConfirmActionButton`

**Severity Colors:**
- Critical: red-100/800
- High: orange-100/800
- Medium: yellow-100/800
- Low: green-100/800

---

## Section 8: Testing Strategy ✅

**Unit Tests:**
- `securityEventDetector.test.ts` — pattern detection logic
- `healthChecks.test.ts` — health calculations
- `userAgentParser.test.ts` — UA parsing
- `monitoring.schema.test.ts` — Zod validation

**Integration Tests:**
- `loginAttemptLogger.test.ts` — DB persistence
- `sessionTermination.test.ts` — force logout + audit
- `securityEventCreation.test.ts` — event triggers
- `auditLogQueries.test.ts` — filter/pagination

**E2E Tests:**
- `monitoring-access.spec.ts` — RBAC enforcement
- `security-events.spec.ts` — view/acknowledge/filter
- `sessions.spec.ts` — view/force logout
- `audit-logs.spec.ts` — search/filter/export
- `health-dashboard.spec.ts` — indicators display

---

## Files to Create/Modify

### New Files
```
src/features/monitoring/
├── monitoring.actions.ts          # Server actions
├── monitoring.queries.ts          # DB queries
├── monitoring.schema.ts           # Zod schemas
├── health.queries.ts              # Health check queries
├── components/
│   ├── HealthStatusCard.tsx
│   ├── SeverityBadge.tsx
│   ├── SecurityEventCard.tsx
│   ├── SecurityEventsTable.tsx
│   ├── SessionsTable.tsx
│   ├── AuditLogTable.tsx
│   ├── AuditLogFilters.tsx
│   ├── AuditLogRow.tsx
│   ├── StateDiffViewer.tsx
│   └── DateRangeFilter.tsx

src/app/admin/monitoring/
├── layout.tsx                     # Guard + sub-nav
├── page.tsx                       # Overview
├── security/page.tsx              # Security events
├── sessions/page.tsx              # Sessions
└── audit-logs/page.tsx            # Audit explorer
└── audit-logs/export/route.ts     # CSV export

src/lib/security/
├── loginAttemptLogger.ts          # Persist attempts
└── securityEventDetector.ts       # Detection logic

src/lib/constants/
└── monitoring.ts                  # School hours, thresholds
```

### Files to Modify
```
src/lib/db/schema.ts               # Add tables + enums
src/features/auth/auth.actions.ts  # Hook login logging
src/lib/security/rateLimit.ts      # Trigger security events
src/app/admin/layout.tsx           # Add nav item
```

---

## Verification Plan

1. **Build:** `npm run build` passes
2. **Lint:** `npm run lint` passes
3. **Unit Tests:** `npm run test` — all monitoring tests pass
4. **E2E Tests:** `npm run test:e2e` — monitoring specs pass
5. **Manual Verification:**
   - Super_admin can access all 4 monitoring pages
   - Admin/staff get redirected (403)
   - Health indicators show correct status
   - Force logout terminates session + creates audit entry
   - Security events appear after triggering rate limit
   - Audit log filters work correctly
   - CSV export downloads with correct data

---

## Progress Tracker

- [x] Section 1: Route Structure & Access Control
- [x] Section 2: Database Changes
- [x] Section 3: Application Health Indicators
- [x] Section 4: Security Events & Suspicious Login Detection
- [x] Section 5: Session Management
- [x] Section 6: Full Audit Log Explorer
- [x] Section 7: Components & UI
- [x] Section 8: Testing Strategy
- [ ] Create implementation plan (invoke writing-plans)
