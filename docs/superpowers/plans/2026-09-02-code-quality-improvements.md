# Code Quality Improvements Plan

**Created:** 2026-09-02
**Priority:** Production stability first
**Status:** Phases 1-2 complete, Phases 3-4 pending

## Overview

Four phases of improvements identified from the code quality assessment, ordered by production impact. Each phase is independently deployable.

---

## Phase 1: Fix Blocking Cache Operations

**Priority:** CRITICAL
**Risk:** Production freezes on assessment/payment actions
**Estimated Changes:** ~20 lines

### Problem

`forceUpdateTag()` and multiple `revalidatePath()` calls are blocking operations that can cause server actions to hang indefinitely in production Docker. The DB write succeeds but the response never reaches the client, leaving forms stuck on "Saving..." indefinitely.

### Tasks

#### 1.1 Fix assessments.actions.ts cache invalidation

**File:** `src/features/assessments/assessments.actions.ts`

- [x] Line 1022: Replace `forceUpdateTag(CACHE_TAGS.ENROLLMENTS)` with `invalidateTag(CACHE_TAGS.ENROLLMENTS)`
- [x] Lines 1012-1019: Remove all 7 `revalidatePath()` calls in `cancelAssessmentAction()`
- [x] Also fixed: reverseBalanceTransferAction, addSpecialEducationFeeAction, removeSpecialEducationFeeAction
- [x] Verify client component calls `router.refresh()` in `onSuccess` callback (AssessmentLedgerRegister.tsx:164)

**Before:**
```typescript
revalidatePath("/staff/assessments");
revalidatePath(`/staff/assessments/${assessmentId}`);
revalidatePath(`/staff/students/${assessment.enrollment.student.referenceNumber}`);
revalidatePath("/staff/enrollments");
if (assessment.enrollmentId) {
  revalidatePath(`/staff/enrollments/${assessment.enrollmentId}`);
}
revalidatePath("/staff/approvals");
forceUpdateTag(CACHE_TAGS.ENROLLMENTS);
invalidateTag(CACHE_TAGS.DASHBOARD);
```

**After:**
```typescript
invalidateTag(CACHE_TAGS.ENROLLMENTS);
invalidateTag(CACHE_TAGS.ASSESSMENTS);
invalidateTag(CACHE_TAGS.DASHBOARD);
```

#### 1.2 Fix payments.actions.ts cache invalidation

**File:** `src/features/payments/payments.actions.ts`

- [x] Lines 598-601: Remove `revalidatePath()` calls
- [x] Keep only `invalidateTag()` calls
- [x] Verify client handles refresh via TanStack Query invalidation (use-cashier-queue.ts:201-214)

**Before:**
```typescript
revalidatePath(`/staff/assessments/${assessmentId}`);
revalidatePath("/staff/finance/invoices");
revalidatePath("/staff/finance/booklets");
invalidateTag(CACHE_TAGS.DASHBOARD);
```

**After:**
```typescript
invalidateTag(CACHE_TAGS.PAYMENTS);
invalidateTag(CACHE_TAGS.ASSESSMENTS);
invalidateTag(CACHE_TAGS.BOOKLETS);
invalidateTag(CACHE_TAGS.DASHBOARD);
```

### Verification

- [ ] Test assessment cancellation in dev — confirm no hanging response
- [ ] Test payment posting in dev — confirm immediate response
- [x] Verify UI updates after action completes (client refresh works) — confirmed in code review
- [ ] Check no regressions in related workflows

**Status:** ✅ Code changes complete (commit 96e0518). Manual testing pending.

---

## Phase 2: Error Message Centralization

**Priority:** MODERATE
**Risk:** Maintenance burden, inconsistent UX
**Estimated Changes:** ~150 lines

### Problem

100+ hardcoded permission error messages like `"You do not have permission to..."` scattered across action files. This creates maintenance burden and inconsistent user messaging.

### Tasks

#### 2.1 Create error messages constants file

**File to create:** `src/lib/constants/error-messages.ts`

- [x] Create file with `PERMISSION_ERRORS` object
- [x] Add all permission error strings (extract from existing actions) — 89 constants defined
- [ ] Add `VALIDATION_ERRORS` for common validation messages (deferred — lower priority)
- [ ] Add `SYSTEM_ERRORS` for generic fallback messages (deferred — lower priority)
- [x] Export as `const` for type safety

**Template:**
```typescript
/**
 * Centralized error messages for consistent UX and maintainability.
 * All user-facing error strings should be defined here.
 */

export const PERMISSION_ERRORS = {
  // Payments
  PAYMENTS_POST: "You do not have permission to post payments.",
  PAYMENTS_VOID: "You do not have permission to void payments.",
  PAYMENTS_VIEW: "You do not have permission to view payments.",

  // Students
  STUDENTS_CREATE: "You do not have permission to create students.",
  STUDENTS_UPDATE: "You do not have permission to update students.",
  STUDENTS_DELETE: "You do not have permission to delete students.",

  // Enrollments
  ENROLLMENTS_CREATE: "You do not have permission to create enrollments.",
  ENROLLMENTS_CANCEL: "You do not have permission to cancel enrollments.",

  // Assessments
  ASSESSMENTS_CREATE: "You do not have permission to create assessments.",
  ASSESSMENTS_UPDATE: "You do not have permission to update assessments.",
  ASSESSMENTS_CANCEL: "You do not have permission to cancel assessments.",

  // Finance
  BOOKLETS_MANAGE: "You do not have permission to manage receipt booklets.",
  INVOICES_SEND: "You do not have permission to send invoices.",
  FEE_TEMPLATES_MANAGE: "You do not have permission to manage fee templates.",

  // Archive
  ARCHIVE_MANAGE: "You do not have permission to archive students.",
  DOCUMENTS_MANAGE: "You do not have permission to manage document requests.",

  // Users
  USERS_CREATE: "You do not have permission to create users.",
  USERS_UPDATE: "You do not have permission to update users.",

  // Academics
  GRADES_ENCODE: "You do not have permission to encode grades.",
  GRADES_APPROVE: "You do not have permission to approve grades.",
  SECTIONS_MANAGE: "You do not have permission to manage sections.",
  SUBJECTS_MANAGE: "You do not have permission to manage subjects.",

  // Discounts
  DISCOUNTS_REQUEST: "You do not have permission to request discounts.",
  DISCOUNTS_APPROVE: "You do not have permission to approve discounts.",

  // Reports
  REPORTS_VIEW: "You do not have permission to view reports.",
  REPORTS_EXPORT: "You do not have permission to export reports.",

  // Clearances
  CLEARANCES_MANAGE: "You do not have permission to manage clearances.",

  // Generic fallback
  GENERIC: "You do not have permission to perform this action.",
} as const;

export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: "This field is required.",
  INVALID_FORMAT: "Invalid format.",
  DUPLICATE_ENTRY: "This entry already exists.",
  NOT_FOUND: "Record not found.",
  INVALID_STATE: "This action cannot be performed in the current state.",
} as const;

export const SYSTEM_ERRORS = {
  UNEXPECTED: "An unexpected error occurred. Please try again.",
  DATABASE: "A database error occurred. Please contact support.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
} as const;

export type PermissionErrorKey = keyof typeof PERMISSION_ERRORS;
export type ValidationErrorKey = keyof typeof VALIDATION_ERRORS;
export type SystemErrorKey = keyof typeof SYSTEM_ERRORS;
```

#### 2.2 Update action files to use constants

**Files to modify:**

**37 files updated** (see commits 5d4b92d, 2934cb3 for full list)

Key files updated:
- [x] All payment actions (payments, void-requests, booklets, cash-discount)
- [x] All enrollment actions (enrollments, cancellation, confirmation)
- [x] All assessment actions
- [x] All finance actions (invoices, fee-schedules, booklets)
- [x] All discount actions (types, requests, application)
- [x] All academics actions (curriculums, subjects, sections, grades, etc.)
- [x] All other domain actions (archive, documents, clearances, users, etc.)
- [x] API route (photo upload)
- [x] Utility (action-guards.ts)

**Pattern:**
```typescript
// Before
return { message: "You do not have permission to post payments." };

// After
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";
return { message: PERMISSION_ERRORS.PAYMENTS_POST };
```

### Verification

- [x] Run grep to confirm zero hardcoded permission strings in actions — 127 → 3 remaining (special cases)
- [x] Verify TypeScript compilation passes
- [ ] Spot-check 3-4 actions to confirm error messages display correctly (manual testing)

**Status:** ✅ Phase 2 complete (commits 5d4b92d, 2934cb3)

**Remaining special cases (intentionally not converted):**
- `lib/errors/messages.ts` — Part of error codes system
- `lib/errors/transform.ts` — Dynamic template with `${action}` variable
- `ClearancesView.tsx` — JSX display text

---

## Phase 3: Schema Soft Delete Gaps

**Priority:** MODERATE
**Risk:** Audit trail loss, data recovery issues
**Estimated Changes:** ~80 lines + migration

### Problem

Three tables violate the non-negotiable soft delete rule:
- `assessmentItems` — Uses hard delete (line 1337 in assessments.actions.ts)
- `feeScheduleItems` — Missing `deletedAt`/`deletedBy` fields
- `registrations` — Missing `deletedAt`/`deletedBy` fields

### Tasks

#### 3.1 Update schema.ts with soft delete fields

**File:** `src/lib/db/schema.ts`

- [ ] Add `deletedAt` and `deletedBy` to `assessmentItems` table
- [ ] Add `deletedAt` and `deletedBy` to `feeScheduleItems` table
- [ ] Add `deletedAt` and `deletedBy` to `registrations` table
- [ ] Add partial indexes for soft delete queries

**Pattern:**
```typescript
// Add to each table definition
deletedAt: timestamp("deleted_at"),
deletedBy: uuid("deleted_by").references(() => users.id),
```

**Indexes to add:**
```typescript
// For assessmentItems
index("assessment_items_active_idx")
  .on(assessmentItems.assessmentId)
  .where(sql`${assessmentItems.deletedAt} IS NULL`),

// For feeScheduleItems
index("fee_schedule_items_active_idx")
  .on(feeScheduleItems.feeScheduleId)
  .where(sql`${feeScheduleItems.deletedAt} IS NULL`),

// For registrations
index("registrations_active_idx")
  .on(registrations.status)
  .where(sql`${registrations.deletedAt} IS NULL`),
```

#### 3.2 Generate and apply migration

- [ ] Run `npm run db:generate -- --name=add_soft_delete_to_assessment_items_fee_schedule_items_registrations`
- [ ] Review generated SQL migration file
- [ ] Run `npm run db:migrate` to apply

#### 3.3 Update assessments.actions.ts to use soft delete

**File:** `src/features/assessments/assessments.actions.ts`

- [ ] Line 1337: Replace hard delete with soft delete

**Before:**
```typescript
await tx
  .delete(assessmentItems)
  .where(eq(assessmentItems.id, assessmentItemId));
```

**After:**
```typescript
await tx
  .update(assessmentItems)
  .set({
    deletedAt: new Date(),
    deletedBy: session.userId,
  })
  .where(eq(assessmentItems.id, assessmentItemId));
```

#### 3.4 Update queries to filter soft-deleted records

**Files to check/update:**

- [ ] `src/features/assessments/assessments.queries.ts` — Add `isNull(assessmentItems.deletedAt)` filters
- [ ] `src/features/finance/fee-schedules/fee-schedules.queries.ts` — Add `isNull(feeScheduleItems.deletedAt)` filters
- [ ] `src/features/registrations/registrations.queries.ts` — Add `isNull(registrations.deletedAt)` filters

### Verification

- [ ] Test deleting an assessment item — confirm row has `deletedAt` set, not removed
- [ ] Test fee schedule item queries — confirm deleted items excluded
- [ ] Test registration queries — confirm deleted registrations excluded
- [ ] Check no orphaned data after deletion operations

---

## Phase 4: N+1 Query Optimization

**Priority:** LOW
**Risk:** Latency in detail views (50-100ms per page)
**Estimated Changes:** ~30 lines

### Problem

Two functions in `clearances.queries.ts` have N+1 patterns:
1. `getClearanceById()` — 3 sequential queries that could be parallelized
2. `getStudentClearanceSummary()` — Client-side filtering of up to 1000 records

### Tasks

#### 4.1 Parallelize getClearanceById queries

**File:** `src/features/clearances/clearances.queries.ts`
**Lines:** 296-326

- [ ] Wrap the 3 sequential queries in `Promise.all()`
- [ ] Handle conditional logic after parallel fetch

**Before:**
```typescript
const [enrollmentInfo] = await db.select()...;
const [sy] = await db.select()...;
const usersData = await db.select()...;
```

**After:**
```typescript
const [enrollmentInfoRows, syRows, usersData] = await Promise.all([
  db.select()...,
  db.select()...,
  db.select()...,
]);
const enrollmentInfo = enrollmentInfoRows[0];
const sy = syRows[0];
```

#### 4.2 Replace client-side filtering with SQL aggregation

**File:** `src/features/clearances/clearances.queries.ts`
**Lines:** 397-413

- [ ] Replace `getClearances()` + `.filter()` with SQL `COUNT(*) FILTER (WHERE ...)`
- [ ] Follow pattern from `getClearanceCounters()` (lines 229-231)

**Before:**
```typescript
const allClearances = await getClearances(
  { page: 1, pageSize: 1000 },
  { studentId }
);
const pendingCount = allClearances.data.filter((c) => c.status === "pending").length;
const clearedCount = allClearances.data.filter((c) => c.status === "cleared").length;
```

**After:**
```typescript
const [counts] = await db
  .select({
    pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${clearances.status} = 'pending')`,
    clearedCount: sql<number>`COUNT(*) FILTER (WHERE ${clearances.status} = 'cleared')`,
    totalCount: sql<number>`COUNT(*)`,
  })
  .from(clearances)
  .where(eq(clearances.studentId, studentId));
```

### Verification

- [ ] Measure clearance detail page load time before changes
- [ ] Measure clearance detail page load time after changes
- [ ] Confirm at least 30-50ms improvement
- [ ] Verify no regressions in clearance summary data

---

## Implementation Order

```
Phase 1 (CRITICAL) ──▶ Deploy ──▶ Phase 2 ──▶ Deploy ──▶ Phase 3 ──▶ Deploy ──▶ Phase 4 ──▶ Deploy
     │                                │                       │                      │
     ▼                                ▼                       ▼                      ▼
 Test in dev                    Grep verify              Migration test         Perf measure
```

## Summary

| Phase | Priority | Files Changed | Risk | Verification |
|-------|----------|---------------|------|--------------|
| 1. Cache fixes | CRITICAL | 2 | Production freeze | Manual test |
| 2. Error messages | MODERATE | 1 new + ~18 | UX consistency | Grep |
| 3. Soft delete | MODERATE | 1 schema + ~4 | Data integrity | Query test |
| 4. N+1 queries | LOW | 1 | Latency | Perf measure |

**Total Estimated Changes:** ~280 lines across 4 independent deployments

---

## Notes

- Each phase can be deployed independently
- Phase 1 should be deployed ASAP due to production freeze risk
- Phase 3 requires database migration — coordinate with deployment schedule
- All changes follow existing SRAMS patterns documented in CLAUDE.md
