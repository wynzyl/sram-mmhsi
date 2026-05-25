# Activity Monitor Dashboard Implementation Plan

## Overview

Create an **Activity Monitor** dashboard that provides role-aware audit trail visibility for the SRAMS K-12 school management system. The dashboard displays operational activities with severity classification, real-time alerts, and detailed drill-down capabilities.

---

## Design Direction

**Aesthetic**: *Institutional Command Center* — Clean, professional monitoring interface with subtle depth. Dark-tinged surface cards with sharp red accent indicators for critical items. Monospace typography for timestamps and IDs. Staggered entrance animations for visual polish.

**Key Visual Elements**:
- Deep red (#db0000) severity badges for critical alerts
- Amber (#f59e0b) for warnings, blue-gray for informational
- Module-specific icons (Receipt, UserPlus, Calculator, Shield)
- Drawer slides in from right with backdrop blur
- Cards use existing `animate-fade-up` + `stagger-children` pattern

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Access | All staff roles with filtered views | Each role sees activities relevant to their domain |
| Routing | `/admin/activity-monitor` + `/staff/activity-monitor` | Admin sees all; staff sees role-filtered view |
| Real-time | Manual refresh button only | Simple, predictable; avoids polling complexity |
| Severity Storage | Derive at query time (NOT stored in DB) | No migration needed; rules can change without data changes |
| Component Pattern | Server components for data + Client for interactions | Follow existing dashboard patterns |

---

## File Structure

```
src/
├── features/
│   └── activity-monitor/
│       ├── index.ts                           # Barrel exports
│       ├── activity-monitor.queries.ts        # Server queries for audit logs
│       ├── activity-monitor.schema.ts         # Zod schemas for filters
│       └── components/
│           ├── ActivitySummaryCards.tsx       # 5 summary stat cards
│           ├── ActivityLogTable.tsx           # Main logs table (Client)
│           ├── AlertsPanel.tsx                # Critical alerts sidebar
│           ├── ActivityDetailDrawer.tsx       # Side drawer for details
│           ├── SeverityBadge.tsx              # Severity indicator component
│           ├── ActivityFilters.tsx            # Filter controls
│           └── ModuleIcon.tsx                 # Module-specific icons
│
├── app/
│   ├── admin/
│   │   └── activity-monitor/
│   │       └── page.tsx                       # Admin activity monitor
│   ├── staff/
│   │   └── activity-monitor/
│   │       └── page.tsx                       # Staff activity monitor
│   └── api/
│       └── activity-monitor/
│           └── [id]/
│               └── route.ts                   # Detail fetch API
│
└── lib/
    └── constants/
        └── activity-types.ts                  # Severity rules & module mapping
```

---

## Critical Files to Modify/Reference

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts:876-898` | `auditLogs` table definition |
| `src/lib/utils/audit-logger.ts` | Action naming conventions reference |
| `src/app/admin/dashboard/page.tsx` | Pattern for StatCard layout |
| `src/features/enrollments/components/EnrollmentConfirmationDrawer.tsx` | Drawer component pattern |
| `src/components/ui/stat-card.tsx` | Extend with new icon types |
| `src/components/shared/StatusBadge.tsx` | Pattern for SeverityBadge |

---

## Severity Classification Rules

```typescript
// src/lib/constants/activity-types.ts

export const ACTIVITY_SEVERITY = {
  critical: [
    // Security events
    "auth:login_failed",
    "users:delete",
    "users:role_change",
    // Financial risk
    "payment_voided",
    "payment_reversed",
    "void_request_approved",
    "discount_reversed",
    "enrollment_cancelled_with_balance",
  ],
  warning: [
    "void_request_created",
    "discount_request_created",
    "enrollment_cancelled",
    "students:delete",
    "grades_submitted",
    "grade_records:lock",
  ],
  info: [
    // Everything else defaults to info
  ],
} as const;

export function getSeverity(action: string): "critical" | "warning" | "info" {
  if (ACTIVITY_SEVERITY.critical.some(a => action.includes(a))) return "critical";
  if (ACTIVITY_SEVERITY.warning.some(a => action.includes(a))) return "warning";
  return "info";
}
```

---

## Role-Based Filtering

| Role | Target Entities | Focus Area |
|------|-----------------|------------|
| super_admin | All entities | Security + system risk (login failures, role changes, voids) |
| admin | payments, enrollments, assessments, students | Business operations |
| finance_officer | assessments, payments, discounts, fee_schedules | Accounts & ledger control |
| registrar | students, registrations, enrollments | Student records & enrollment |
| cashier | payments, receipt_booklets (own activity only) | Collections & OR accountability |
| teacher | grade_records (own activity only) | Grade encoding |

---

## UI Components

### 1. ActivitySummaryCards (5 cards)
- **Payments Today**: Count + total amount
- **New Enrollments**: Count for today
- **Voided Payments**: Count (critical indicator if > 0)
- **Edited Assessments**: Count for today
- **Critical Alerts**: Count with red indicator

### 2. ActivityLogTable Columns
| Column | Content |
|--------|---------|
| Time | Formatted timestamp (10:15 AM) |
| Severity | SeverityBadge (Critical/Warning/Info) |
| Module | ModuleIcon + name (Enrollment, Assessment, Cashier) |
| User | Username who performed action |
| Activity | Human-readable action description |
| Reference | Student ID, OR No., Assessment No. |
| Amount/Status | If applicable |
| Action | "View Details" button |

### 3. AlertsPanel (Right sidebar)
- Shows critical + warning items from today
- Examples: Failed logins, Payment voided, Assessment edited
- Click to open detail drawer

### 4. ActivityDetailDrawer
- **Header**: Activity summary + severity badge
- **User Details**: Name, role, IP address
- **Affected Record**: Entity type, target ID
- **State Changes**: Before/After JSON diff
- **Context/Reason**: If provided
- **Timestamp**: Exact date/time + correlation ID

### 5. Filters
- Date Range: Today (default), Week, Month
- Module: Enrollment, Assessment, Cashier, etc.
- Severity: Critical, Warning, Info
- Search: Student ID, OR number, name
- User: Staff activity filter

---

## Database Queries

### Summary Metrics Query
```typescript
getActivitySummaryMetrics(roleFilter): Promise<{
  paymentsToday: number;
  newEnrollmentsToday: number;
  voidedPaymentsToday: number;
  editedAssessmentsToday: number;
  criticalAlertsToday: number;
}>
```

### Activity Logs Query
```typescript
getActivityLogs(params: {
  roleFilter: RoleActivityFilter;
  dateRange: "today" | "week" | "month";
  module?: string;
  severity?: "critical" | "warning" | "info";
  userId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  logs: ActivityLogRow[];
  totalCount: number;
}>
```

### Activity Detail Query
```typescript
getActivityDetail(logId: string): Promise<ActivityDetail | null>
```

---

## Implementation Sequence

### Phase 1: Foundation
1. Create `src/lib/constants/activity-types.ts`
   - Severity classification rules
   - Module icon mapping
   - Action label mapping
   - Role filter configurations

2. Create `src/features/activity-monitor/activity-monitor.schema.ts`
   - ActivityFiltersSchema (Zod)
   - Type exports

3. Create `src/features/activity-monitor/activity-monitor.queries.ts`
   - `getActivitySummaryMetrics()`
   - `getActivityLogs()`
   - `getActivityDetail()`
   - `getCriticalAlerts()`

### Phase 2: Components
4. Create `SeverityBadge.tsx`
   - Uses existing Badge component
   - Maps severity to variant (danger/warning/info)

5. Create `ModuleIcon.tsx`
   - Maps entity names to Lucide icons
   - Receipt, UserPlus, Calculator, Shield, Server

6. Extend `stat-card.tsx`
   - Add new icon types: `activity`, `alert`, `void`

7. Create `ActivitySummaryCards.tsx`
   - Server component with 5 StatCards
   - Grid layout with stagger animation

8. Create `AlertsPanel.tsx`
   - Server component for sidebar
   - List of critical/warning items

### Phase 3: Main Table & Drawer
9. Create `ActivityFilters.tsx`
   - Client component for filter controls
   - Date range, module, severity, search inputs

10. Create `ActivityLogTable.tsx`
    - Client component using DataTable
    - Column definitions with formatters
    - "View Details" button with onClick handler

11. Create `ActivityDetailDrawer.tsx`
    - Client component (modal/drawer pattern)
    - Fetches detail via API route
    - Before/After state diff display

12. Create `src/features/activity-monitor/index.ts`
    - Barrel exports

### Phase 4: Pages & API
13. Create `/api/activity-monitor/[id]/route.ts`
    - GET handler for detail fetch
    - Permission check (staff roles only)

14. Create `/admin/activity-monitor/page.tsx`
    - Full access view for super_admin/admin
    - All summary cards + table + alerts panel

15. Create `/staff/activity-monitor/page.tsx`
    - Role-filtered view
    - Permission check via hasPermission()

16. Update navigation
    - Add "Activity Monitor" to admin nav config
    - Add to staff nav for applicable roles

### Phase 5: Polish
17. Add loading states
    - Skeleton loaders for cards
    - Table loading overlay

18. Add empty states
    - "No activities found" message
    - Contextual empty state per filter

19. Test all role views
    - Verify filter logic per role
    - Confirm drawer functionality

---

## Verification Steps

1. **Build Check**: `npm run build` passes without errors
2. **Lint Check**: `npm run lint` passes
3. **Visual Test**:
   - Navigate to `/admin/activity-monitor` as admin
   - Verify 5 summary cards display
   - Verify activity log table loads
   - Click "View Details" on a row
   - Confirm drawer opens with correct data
4. **Role Test**:
   - Login as cashier, verify only payment activities visible
   - Login as registrar, verify only student/enrollment activities
5. **Filter Test**:
   - Change date range, verify table updates
   - Filter by severity, verify correct rows shown
   - Search by student ID, verify matching results
6. **Responsive Test**:
   - View on mobile width
   - Verify drawer is full-width on mobile
   - Verify cards stack vertically

---

## Notes

- No database migration required (derives severity from action type)
- Uses existing `auditLogs` table and indexes
- Follows existing component patterns from codebase
- Cache tags: `['activity-monitor']` for revalidation
- Default view: Today + Latest 20 Important Logs
