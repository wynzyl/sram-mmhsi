# SRAMS Database Integrity & Audit Report

> **Date:** 2026-05-30
> **Status:** Phase 1 Complete

---

## Executive Summary

This report documents the database integrity audit for SRAMS, focusing on:
1. **Soft Delete Compliance** — Preventing silent data loss via CASCADE foreign keys
2. **Audit Logging Coverage** — Ensuring all mutations have audit trails
3. **Schema Consistency** — Adding missing soft delete fields

---

## 1. Soft Delete FK Compliance

### 1.1 Problem Statement

The application layer enforces soft delete (zero `.delete()` calls verified), but **7 CASCADE foreign keys** in the schema could cause hard deletes if parent records are manually deleted from the database.

### 1.2 Implementation Status: ✅ COMPLETE

**Migration:** `drizzle/0014_fix_cascade_foreign_keys.sql`
**Commit:** `a4a2417` (2026-05-30)

| Foreign Key | Risk Level | Status |
|-------------|------------|--------|
| `feeScheduleItems.feeScheduleId` | MEDIUM | ✅ CASCADE → RESTRICT |
| `feeTemplateItems.feeTemplateId` | MEDIUM | ✅ CASCADE → RESTRICT |
| `schoolYearFeeSchedules.schoolYearId` | MEDIUM | ✅ CASCADE → RESTRICT |
| `feeScheduleOverrides.scheduleId` | MEDIUM | ✅ CASCADE → RESTRICT |
| `assessmentItems.assessmentId` | HIGH (financial) | ✅ CASCADE → RESTRICT |
| `paymentAllocations.paymentId` | HIGH (financial) | ✅ CASCADE → RESTRICT |
| `sessions.userId` | LOW | ⏭️ Kept CASCADE (ephemeral data) |

**Rationale for sessions exception:** Sessions are ephemeral authentication tokens that should be cleaned up when a user is deleted. No audit trail impact.

### 1.3 Additional Fix: parentsGuardians Soft Delete

Added missing soft delete fields for consistency:

```sql
ALTER TABLE "parents_guardians"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deleted_by" UUID REFERENCES "users"("id");

CREATE INDEX IF NOT EXISTS "pg_deleted_at_idx" ON "parents_guardians"("deleted_at")
  WHERE "deleted_at" IS NULL;
```

**Schema updated:** `src/lib/db/schema.ts` (lines 342-343, 349-351)

---

## 2. Audit Logging Coverage

### 2.1 Infrastructure

| Component | Location | Status |
|-----------|----------|--------|
| Audit Logs Table | `auditLogs` in schema.ts | ✅ Complete |
| Core Logger | `logAudit()` in `src/lib/utils/audit-logger.ts` | ✅ Complete |
| Create Helper | `logCreateAction()` | ✅ Complete |
| Update Helper | `logUpdateAction()` | ✅ Complete |
| Delete Helper | `logDeleteAction()` | ✅ Complete |
| Error Auditing | `src/lib/errors/audit-failures.ts` | ✅ Complete |

### 2.2 Action File Coverage: ✅ 100%

**Commit:** `b8d5514` (2026-05-30) — Standardized remaining 2 files

| Action File | Audit Calls | Status |
|-------------|-------------|--------|
| `students.actions.ts` | `logCreateAction`, `logUpdateAction` | ✅ |
| `users.actions.ts` | `logCreateAction`, `logUpdateAction` | ✅ |
| `enrollments.actions.ts` | `logAudit` | ✅ Standardized |
| `enrollment-confirmation.actions.ts` | `logAudit` | ✅ Standardized |
| `auth.actions.ts` | `logAudit` | ✅ |
| `academics/grades.actions.ts` | `logAudit` | ✅ |
| `academics/subjects.actions.ts` | `logAudit` | ✅ |
| `assessments.actions.ts` | `logAudit` | ✅ |
| `clearances.actions.ts` | `logAudit` | ✅ |
| `discounts.actions.ts` | `logAudit` | ✅ |
| `enrollment-cancellation.actions.ts` | `logAudit` | ✅ |
| `finance/booklets.actions.ts` | `logAudit` | ✅ |
| `finance/fee-item-types.actions.ts` | `logAudit` | ✅ |
| `finance/fee-schedules.actions.ts` | `logAudit` | ✅ |
| `finance/fee-templates.actions.ts` | `logAudit` | ✅ |
| `finance/invoices.actions.ts` | `logCreateAction`, `logUpdateAction` | ✅ |
| `payments.actions.ts` | `logAudit` with `throwOnFail: true` | ✅ |
| `payments/void-requests.actions.ts` | `logAudit` | ✅ |
| `school-years.actions.ts` | `logCreateAction`, `logUpdateAction`, `logDeleteAction` | ✅ |
| `system-settings.actions.ts` | `logAudit` | ✅ |

**Total audit function calls:** 82 across codebase

### 2.3 Critical Financial Operations

All financial operations use `throwOnFail: true` for fail-closed behavior:

| Operation | Action | Audit Type |
|-----------|--------|------------|
| Payment Posting | `postPaymentAction` | `logAudit` + `throwOnFail` |
| Payment Voiding | `voidPaymentAction` | `logAudit` + `throwOnFail` |
| OR Booklet Creation | `createBookletAction` | `logAudit` + `throwOnFail` |

---

## 3. Remaining Improvements (Optional)

### 3.1 Low Priority Enhancements

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| Guardian audit trail | Log individual guardian link add/remove (currently bundled with student) | LOW |
| Richer `newState` snapshots | Include amounts in payment audits, document status in enrollments | LOW |
| Correlation IDs | Set `correlationId` for related operations (schema supports it, not always set) | LOW |
| Audit query helpers | Add compliance reporting queries (by action, date range, entity) | LOW |

### 3.2 Documentation

| Document | Status |
|----------|--------|
| This report | ✅ Created |
| CLAUDE.md audit rules | ✅ Documented |
| Audit logger JSDoc | ✅ Complete |

---

## 4. Verification

### 4.1 Build & Tests

```bash
# Build passes
npm run build  # ✅ Compiled successfully

# Tests pass
npm run test   # ✅ 38/38 tests passed
```

### 4.2 FK Constraint Verification

```sql
-- Verify RESTRICT constraints applied
SELECT conname, confdeltype
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid IN (
    'fee_schedule_items'::regclass,
    'assessment_items'::regclass,
    'payment_allocations'::regclass
  );
-- Expected: confdeltype = 'r' (restrict)
```

### 4.3 RESTRICT Behavior Test

```sql
-- Should fail with FK violation (not silently delete children)
DELETE FROM assessments WHERE id = 'some-uuid';
-- Expected: ERROR: update or delete on table "assessments" violates foreign key constraint
```

---

## 5. Commits

| Commit | Description |
|--------|-------------|
| `a4a2417` | fix: change CASCADE foreign keys to RESTRICT for soft delete compliance |
| `b8d5514` | refactor: standardize audit logging in enrollment actions |

---

## 6. Conclusion

**Database integrity audit is complete:**

- ✅ **6 CASCADE FKs → RESTRICT** (financial audit trail protected)
- ✅ **1 CASCADE kept** (`sessions.userId` — acceptable for ephemeral data)
- ✅ **20/20 action files** use standardized audit logging
- ✅ **parentsGuardians** now has soft delete fields
- ✅ **All financial operations** use fail-closed auditing

The system is now protected against:
1. Silent data loss from direct database deletes
2. Missing audit trails for any mutation
3. Inconsistent soft delete patterns
