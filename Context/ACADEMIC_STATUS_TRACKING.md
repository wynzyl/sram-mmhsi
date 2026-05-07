# Plan: Add Student Academic Status Tracking

## Overview

Add academic status tracking to distinguish between students who are **current**, **graduated**, **dropped**, or **transferred**. This status will be attached to the `enrollments` table (not the `students` table) because a student's academic status is school-year-specific.

## Why `enrollments` Table?

**Option 1: Add to `students` table** ❌
- Problem: A student's status changes per school year
- Example: A student could be "completed" in 2023-2024 but "active" in 2024-2025
- Doesn't preserve historical records

**Option 2: Add to `enrollments` table** ✅ **RECOMMENDED**
- Status is naturally scoped to a school year enrollment
- Preserves historical data (e.g., "graduated in SY 2023-2024")
- Aligns with existing enrollment-centric architecture
- Enables year-over-year reporting (graduation rates, dropout trends, etc.)

## Current Enrollment Status vs. Academic Status

**Important distinction:**

1. **`enrollmentStatus`** (existing): Tracks the ENROLLMENT PROCESS
   - Values: `pending` → `assessed` → `enrolled` → `cancelled`
   - Represents administrative workflow stages

2. **`academicStatus`** (new): Tracks what happened DURING/AFTER enrollment
   - Values: `active` → `completed` | `graduated` | `dropped` | `transferred`
   - Represents the student's academic outcome for that school year

## Proposed Schema Changes

### 1. Add new enum: `academicStatusEnum`

```sql
CREATE TYPE academic_status AS ENUM (
  'active',       -- Currently enrolled and attending
  'completed',    -- Completed this grade level, ready for promotion
  'graduated',    -- Completed final grade level (e.g., Grade 12)
  'dropped',      -- Dropped out during this school year
  'transferred'   -- Transferred to another school
);
```

### 2. Add columns to `enrollments` table

```sql
ALTER TABLE enrollments
ADD COLUMN academic_status academic_status DEFAULT 'active',
ADD COLUMN academic_status_updated_at TIMESTAMP;
```

**Default value:** When a student's enrollment status becomes `"enrolled"`, their academic status should default to `"active"`.

**Timestamp:** The `academicStatusUpdatedAt` field is set whenever `academicStatus` changes (not on initial creation, only on updates).

## Status Lifecycle Example

**Scenario 1: Grade 11 student completes the year**
- Enrollment: `status="enrolled"`, `academicStatus="active"` (during school year)
- End of year: `academicStatus="completed"` (passed, ready for Grade 12)

**Scenario 2: Grade 12 student graduates**
- Enrollment: `status="enrolled"`, `academicStatus="active"` (during school year)
- End of year: `academicStatus="graduated"` (completed final year, leaving school)

**Scenario 3: Student drops out mid-year**
- Enrollment: `status="enrolled"`, `academicStatus="active"` (at start)
- Mid-year: `academicStatus="dropped"` (left school)

**Scenario 4: Student transfers to another school**
- Enrollment: `status="enrolled"`, `academicStatus="active"` (at start)
- Transfer date: `academicStatus="transferred"` (moved to another institution)

## Implementation Steps

### Phase 1: Schema & Migration

**Files to modify:**
- `lib/db/schema.ts`
  - Add `academicStatusEnum` definition (after line 65)
  - Add `academicStatus` field to `enrollments` table (after line 264)
  - Add `academicStatusUpdatedAt` timestamp field to `enrollments` table

**Migration:**
- Run `npm run db:generate` to create migration file
- Review generated SQL
- Run `npm run db:migrate` to apply

### Phase 2: Validators

**Files to modify:**
- `lib/validators/enrollment.ts` (or create if missing)
  - Add Zod schema for updating academic status
  - Export `updateAcademicStatusSchema`

### Phase 3: Server Actions

**Files to modify:**
- `actions/enrollments.ts`
  - Update `updateEnrollmentStatusAction` to set `academicStatus="active"` when enrollment status becomes `"enrolled"`
  - Add new action: `updateAcademicStatusAction` (for admin/registrar to mark completed/graduated/dropped/transferred)
  - Permission check: `hasPermission(role, "enrollments:update_academic_status")`
  - Set `academicStatusUpdatedAt` timestamp when status changes
  - Include audit logging for academic status changes

- `lib/rbac/permissions.ts` (if needed)
  - Ensure `admin` and `registrar` roles have `"enrollments:update_academic_status"` permission

### Phase 4: UI Components (End-of-year workflow)

**Primary use case:** Batch processing at end of school year

**Files to create/modify:**
- `components/enrollments/AcademicStatusForm.tsx`
  - Form for admin/registrar to update academic status
  - Support for individual student updates (for mid-year drops/transfers)
  - Optional bulk actions (e.g., mark all Grade 11 Section A students as "completed")
  - Confirmation dialog for status changes
  - Remarks/reason field (optional, for audit context)

- `src/app/admin/enrollments/page.tsx`
  - Add `academicStatus` column to enrollments table
  - Add filter by academic status (show only "active", "completed", etc.)
  - Show both `enrollmentStatus` AND `academicStatus` for clarity
  - Color-code or badge academic status (active=green, graduated=blue, dropped=red, transferred=yellow)

### Phase 5: Reporting & Queries

**Potential additions:**
- Query helpers to fetch students by academic status
- Reports for:
  - Graduation list (academicStatus = "graduated" for a school year)
  - Promotion list (academicStatus = "completed", ready for next grade level)
  - Dropout tracking (academicStatus = "dropped")
  - Transfer tracking (academicStatus = "transferred")

## Critical Files

| File | Purpose |
|------|---------|
| `lib/db/schema.ts` | Add enum + column definitions (academicStatus, academicStatusUpdatedAt) |
| `drizzle/NNNN_add_academic_status.sql` | Generated migration file |
| `actions/enrollments.ts` | Update enrollment logic + new action |
| `lib/validators/enrollment.ts` | Validation schemas |
| `lib/rbac/permissions.ts` | Verify admin/registrar have update_academic_status permission |

## Validation Rules

1. **Default:** When `enrollmentStatus` changes to `"enrolled"`, set `academicStatus = "active"` (do NOT set academicStatusUpdatedAt on initial default)
2. **Permission:** Only `admin` and `registrar` roles can update academic status
3. **Prerequisite:** Academic status can only be updated if `enrollmentStatus = "enrolled"` (can't mark as graduated if enrollment was cancelled)
4. **Timestamp:** Set `academicStatusUpdatedAt = NOW()` whenever `academicStatus` changes (except initial default)
5. **Immutability (soft):** Once set to `graduated`, `dropped`, or `transferred`, status should be locked (admin-only override with audit trail)
6. **Audit logging required** for all academic status changes (actor, timestamp, previous value, new value, remarks/reason)

## Future Enhancements (Not in scope for this plan)

- Automated status updates based on grade records (e.g., if all subjects passed, auto-mark as "completed") - Hold for future implementation
- Integration with promotion workflow (auto-create next year's enrollment for "completed" students) - Add to MVP
- Email notifications to parents when academic status changes - Hold for future implementation
- Dashboard widgets showing graduation/completion rates - - Add to MVP

## User Requirements (Confirmed)

1. **Permissions:** Admin + Registrar roles can update academic status
   - Add permission check: `hasPermission(role, "enrollments:update_academic_status")`
   - Both `admin` and `registrar` roles should have this permission

2. **Timing:** End of school year workflow (with mid-year exceptions)
   - Primary use case: Batch update at end of school year
   - Exception: Mid-year drops and transfers can be updated anytime
   - Consider adding bulk update feature for end-of-year processing

3. **Timestamp:** Yes, add `academicStatusUpdatedAt` timestamp field
   - Tracks when status was last changed
   - Useful for reporting and auditing
   - Separate from enrollment's `updatedAt` (which tracks any enrollment change)

## Verification Steps

After implementation:

1. **Schema verification:**
   - Run `npm run db:studio` and verify `academicStatusEnum` exists
   - Verify `enrollments.academicStatus` column exists with default 'active'
   - Verify `enrollments.academicStatusUpdatedAt` timestamp column exists

2. **Permission testing:**
   - Login as `admin` → should be able to update academic status
   - Login as `registrar` → should be able to update academic status
   - Login as `cashier` or `teacher` → should NOT be able to update academic status

3. **Workflow testing:**
   - Create new enrollment → verify `academicStatus` defaults to "active", `academicStatusUpdatedAt` is NULL
   - Update enrollment to "enrolled" → verify `academicStatus` remains "active", timestamp still NULL
   - Update `academicStatus` to "completed" → verify change persists AND `academicStatusUpdatedAt` is set to NOW()
   - Check audit logs capture the change (actor, action, previous value, new value)

4. **Timestamp testing:**
   - Verify `academicStatusUpdatedAt` is NOT set on initial enrollment (should be NULL)
   - Verify `academicStatusUpdatedAt` IS set when status changes from "active" → "completed"
   - Verify timestamp updates again if status changes a second time

5. **Query testing:**
   - Fetch all "graduated" students for a specific school year
   - Fetch all "active" students for current school year
   - Verify filters work correctly in UI
   - Test sorting by academic status

6. **Edge cases:**
   - Try to update academicStatus for cancelled enrollment (should fail validation)
   - Try to update academicStatus as a non-permitted role (should fail permission check)
   - Verify uniqueness constraint still works (one non-cancelled enrollment per student per school year)

---

**Estimated Complexity:** Medium (schema change + migration + actions update)

**Dependencies:** None (self-contained change)

**Risk Level:** Low (additive change, doesn't break existing functionality)
