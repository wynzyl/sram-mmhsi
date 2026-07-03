# SRAMS End-of-Year (EOY) Transition Feature Report

**System:** School Registration and Accounts Monitoring System (SRAMS)
**Report Date:** 2026-07-03
**Report Type:** Feature Implementation Documentation
**Version:** 1.0

---

## Executive Summary

The End-of-Year (EOY) Transition feature provides comprehensive student lifecycle management with archival capabilities. It enables schools to formally process graduating students, handle no-show enrollments, and manage non-returning students through batch operations with full audit trails.

Key capabilities:
- Student lifecycle statuses: `active` → `graduated/transferred/withdrawn/cancelled/inactive`
- Batch operations for end-of-year processing (graduation, no-shows, non-returning)
- Transaction guards preventing invalid operations on archived students
- Automatic clearance record generation for graduates
- Unarchive functionality with enrollment restoration for no-show students

---

## 1. Business Problem Addressed

### 1.1 The Gap

Prior to this feature, SRAMS had no formal process for:
- End-of-year student transitions (graduation, withdrawal, transfer)
- Batch archival operations for graduating classes
- Handling no-show enrollments (registered but never paid)
- Tracking non-returning students across school years
- Preventing invalid transactions on archived students

### 1.2 Solution Overview

A status-based archival system with three batch operations:
1. **Batch Archive Graduates**: Archive enrolled students as "graduated" with clearance generation
2. **Batch Cancel No-Show**: Cancel pending/assessed-but-unpaid enrollments and archive as "cancelled"
3. **Batch Archive Non-Returning**: Archive students enrolled in previous year but not current year

Plus single-student archive/unarchive operations with full transaction safety.

---

## 2. Student Lifecycle Statuses

### 2.1 Status Definitions

| Status | Description | Archive State |
|--------|-------------|---------------|
| `active` | Currently enrolled or enrollable | Not archived |
| `graduated` | Completed Grade 12 / Senior High School | Archived |
| `transferred` | Left for another school | Archived |
| `withdrawn` | Withdrew from enrollment | Archived |
| `cancelled` | Administrative cancellation (e.g., no-show) | Archived |
| `inactive` | Other inactive reasons | Archived |

### 2.2 Status Constants

```typescript
// src/lib/constants/student-status.ts
export const STUDENT_STATUSES = [
  "active",
  "graduated",
  "transferred",
  "withdrawn",
  "cancelled",
  "inactive",
] as const;

export const ARCHIVED_STUDENT_STATUSES = STUDENT_STATUSES.filter(
  (s) => s !== "active"
);

export function isArchivedStatus(status: StudentStatus): boolean {
  return status !== "active";
}
```

---

## 3. Database Schema Changes

### 3.1 Students Table Additions

| Column | Type | Purpose |
|--------|------|---------|
| `status` | enum (`student_status_enum`) | Lifecycle status |
| `archived_at` | timestamp | When student was archived |
| `archived_by` | uuid (FK → users) | Who performed the archive |
| `archive_reason` | text | Required reason for archival |
| `archived_school_year_id` | uuid (FK → school_years) | School year context for archive |

### 3.2 Performance Indexes

Migration: `drizzle/0003_add_archive_performance_indexes.sql`

```sql
CREATE INDEX "students_archived_at_idx"
  ON "students" USING btree ("archived_at");

CREATE INDEX "students_archive_sy_status_idx"
  ON "students" USING btree ("archived_school_year_id", "status");
```

These indexes optimize:
- Archive directory queries (filtering by archived_at)
- Status + school year compound filters

---

## 4. Batch Operations

### 4.1 Batch Archive Graduates

**Purpose:** Archive enrolled students in a specific grade level as "graduated"

**Target Students:**
- Enrollment status = `enrolled`
- Student status = `active`
- In specified school year and grade level (defaults to Grade 12)

**Actions Performed:**
1. Generate clearance records for each student (status based on outstanding balance)
2. Archive all matching students with status = `graduated`
3. Set `archiveReason` to "Graduated - End of Year batch archive"
4. Log batch operation to audit trail

**Schema:**
```typescript
export const batchArchiveGraduatesSchema = z.object({
  schoolYearId: z.string().uuid("Invalid school year ID"),
  gradeLevelId: z.string().uuid("Invalid grade level ID").optional(),
  remarks: z.string().trim().max(500).optional(),
});
```

### 4.2 Batch Cancel No-Show

**Purpose:** Cancel enrollments that never received payment and archive students

**Target Students:**
- Enrollment status = `pending` (never assessed), OR
- Enrollment status = `assessed` with `totalPaid = 0`
- Student status = `active`

**Actions Performed (Atomic Transaction):**
1. Cancel all matching enrollments (status → `cancelled`)
2. Cancel associated assessments (if any) with `billingStatus = cancelled`
3. Archive students with status = `cancelled`
4. Set `archiveReason` to "No show - pending or assessed but never paid"

**Schema:**
```typescript
export const batchCancelNoShowSchema = z.object({
  schoolYearId: z.string().uuid("Invalid school year ID"),
  remarks: z.string().trim().max(500).optional(),
});
```

### 4.3 Batch Archive Non-Returning

**Purpose:** Archive students who were enrolled in previous year but not current year

**Target Students:**
- Had non-cancelled enrollment in previous school year
- No enrollment in current school year
- Student status = `active`

**Actions Performed:**
1. Archive all matching students with user-selected status
2. Set `archiveReason` based on remarks or default message
3. Link to previous school year as `archivedSchoolYearId`

**Schema:**
```typescript
export const batchArchiveNonReturningSchema = z.object({
  previousSchoolYearId: z.string().uuid("Invalid previous school year ID"),
  currentSchoolYearId: z.string().uuid("Invalid current school year ID"),
  status: z.enum(ARCHIVED_STUDENT_STATUSES),
  remarks: z.string().trim().max(500).optional(),
});
```

---

## 5. Single Student Operations

### 5.1 Archive Student

**Action:** `archiveStudentAction`

**Requirements:**
- Student must be `active`
- Permission: `archive:manage`
- Reason required (10-500 characters)

**Flow:**
1. Validate student is active
2. Set status to selected archive status
3. Record `archivedAt`, `archivedBy`, `archiveReason`, `archivedSchoolYearId`
4. Audit log entry

### 5.2 Unarchive Student

**Action:** `unarchiveStudentAction`

**Requirements:**
- Student must be archived (status !== `active`)
- Permission: `archive:manage`

**Special Handling for No-Show Students:**
If `archiveReason` contains "no show" and has `archivedSchoolYearId`:
1. Find most recent cancelled enrollment for that school year
2. Restore enrollment to original status (`assessed` if had assessment, `pending` otherwise)
3. Restore associated assessments to `outstanding` status

**Flow (Atomic Transaction):**
1. Restore enrollments/assessments if no-show student
2. Clear archive fields (`archivedAt`, `archivedBy`, `archiveReason`, `archivedSchoolYearId`)
3. Set status back to `active`
4. Audit log entry with `enrollmentRestored` flag

---

## 6. File Structure

```
src/features/archive/
├── archive.schema.ts           # Zod validation schemas (6 schemas)
├── archive.actions.ts          # Server actions (5 actions)
├── archive.queries.ts          # Database queries (12 functions)
├── archive.guards.ts           # Transaction guards for archived students
├── index.ts                    # Public exports
└── components/
    ├── ArchiveDirectoryTable.tsx    # Main archive listing table
    ├── ArchiveFilters.tsx           # Status/school year/search filters
    ├── ArchiveStudentDialog.tsx     # Single student archive dialog
    ├── UnarchiveStudentDialog.tsx   # Restore student dialog
    ├── BatchArchiveDialog.tsx       # Batch graduates/non-returning dialog
    ├── BatchNoShowDialog.tsx        # Batch no-show cancellation dialog
    └── index.ts                     # Component exports
```

---

## 7. Routes

| Route | Purpose |
|-------|---------|
| `/staff/archive` | Archive directory with summary cards, filters, paginated table |
| `/staff/archive/[id]` | Archived student detail page with enrollment history |

---

## 8. Permission Matrix

| Permission | Super Admin | Admin | Registrar | Finance | Cashier | Teacher |
|------------|-------------|-------|-----------|---------|---------|---------|
| `archive:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `archive:manage` | ✓ | ✓ | ✓ | | | |

**Notes:**
- `archive:read`: View archive directory and archived student details
- `archive:manage`: Archive/unarchive students, run batch operations

---

## 9. Archive Guards (Blocked Actions)

### 9.1 Guard Implementation

```typescript
// src/features/archive/archive.guards.ts
export type ArchiveBlockedAction =
  | "void_or"
  | "cancel_enrollment"
  | "cancel_assessment"
  | "re_enroll"
  | "re_assess"
  | "create_enrollment"
  | "create_assessment";

export async function assertStudentMutable(
  studentId: string,
  action: ArchiveBlockedAction,
  executor: GuardExecutor = db
): Promise<void> {
  const status = await getStudentStatus(studentId, executor);
  if (status !== null && isArchivedStatus(status)) {
    throw new StudentArchivedException(studentId, status, action);
  }
}
```

### 9.2 Blocked vs Allowed Operations

| Operation | Archived Students |
|-----------|-------------------|
| Void Official Receipt | **BLOCKED** |
| Cancel Enrollment | **BLOCKED** |
| Cancel Assessment | **BLOCKED** |
| Re-enroll Student | **BLOCKED** |
| Re-assess Student | **BLOCKED** |
| Create New Enrollment | **BLOCKED** |
| Create New Assessment | **BLOCKED** |
| Make Payments | ALLOWED (settle balances) |
| Document Requests | ALLOWED (with eligibility checks) |
| Grade Encoding | ALLOWED |

---

## 10. Audit Trail

### 10.1 Logged Actions

| Action | Target Entity | Logged Data |
|--------|---------------|-------------|
| `archive:archive_student` | `students` | previous status, new status, reason, school year |
| `archive:unarchive_student` | `students` | previous status, enrollmentRestored flag, remarks |
| `archive:batch_graduate` | `students` | school year, grade level, count, first 10 student IDs, clearances generated |
| `archive:batch_no_show` | `enrollments` | school year, pending count, assessed count, student count, first 10 enrollment IDs |
| `archive:batch_non_returning` | `students` | previous/current school year, status, count, first 10 student IDs |

### 10.2 Audit Log Pattern

```typescript
await logAudit({
  actor: session.userId,
  actorRole: session.role,
  action: "archive:batch_graduate",
  targetEntity: "students",
  targetId: `batch:${studentIds.length}`,
  newState: {
    schoolYearId,
    gradeLevelId,
    count: studentIds.length,
    clearancesGenerated,
    studentIds: studentIds.slice(0, 10), // Log first 10 for reference
  },
});
```

---

## 11. Query Functions

### 11.1 Archive Directory

```typescript
// Paginated archive listing with filters
export async function fetchArchivedStudentsPage(
  params: ArchiveFilterInput
): Promise<{
  rows: ArchivedStudentRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  schoolYearOptions: ArchiveSchoolYearOption[];
}>

// Summary statistics for dashboard cards
export async function getArchiveSummary(): Promise<ArchiveSummary>
```

### 11.2 Batch Candidate Queries

```typescript
// Graduation candidates (enrolled in grade level)
export async function getGraduationCandidates(
  schoolYearId: string,
  gradeLevelId?: string
): Promise<Array<GraduationCandidate>>

// No-show candidates (pending or assessed with $0 paid)
export async function getNoShowCandidates(
  schoolYearId: string
): Promise<Array<NoShowCandidate>>

// Non-returning students (previous year but not current)
export async function getNonReturningStudents(
  previousSchoolYearId: string,
  currentSchoolYearId: string
): Promise<Array<NonReturningCandidate>>
```

### 11.3 Document Request Support

```typescript
// Check if archived student has valid enrollment history
export async function hasValidEnrollmentHistory(
  studentId: string
): Promise<boolean>
```

---

## 12. Testing Verification

### 12.1 Build Status
```
✓ Compiled successfully
✓ TypeScript: No errors
```

### 12.2 Manual Testing Scenarios

1. **Single Archive**: Archive active student with each status type
2. **Single Unarchive**: Restore archived student, verify status = active
3. **No-Show Unarchive**: Unarchive no-show student, verify enrollment restored
4. **Batch Graduates**: Archive Grade 12 students, verify clearances created
5. **Batch No-Show**: Cancel pending/assessed enrollments, verify cascade
6. **Batch Non-Returning**: Archive students missing from current year
7. **Guard Tests**: Attempt blocked operations on archived students

---

## 13. Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Archive already-archived student | Blocked with message |
| Unarchive active student | Blocked with message |
| Batch with no candidates | Returns count=0, no error |
| No-show unarchive without enrollment | Restores student only |
| Concurrent archive attempts | Transaction isolation |
| Guard check in transaction | Accepts executor parameter |

---

## 14. Future Enhancements

1. **Archive Reports**: Export archive directory to Excel/PDF
2. **Scheduled Batch Jobs**: Auto-run EOY operations at configured date
3. **Archive Retention Policy**: Auto-delete records after N years
4. **Bulk Status Change**: Change archive status for multiple students
5. **Archive Search**: Full-text search across archive reason/remarks

---

## 15. Migration Notes

### 15.1 Database Migration

Run migrations to apply schema changes and indexes:
```bash
npm run db:migrate
```

### 15.2 Status Enum

The `student_status_enum` is created from constants:
```typescript
export const studentStatusEnum = pgEnum("student_status", STUDENT_STATUSES);
```

Adding a new status requires:
1. Add value to `STUDENT_STATUSES` array
2. Add corresponding label and description
3. Generate migration: `npm run db:generate`
4. Apply migration: `npm run db:migrate`

---

**Report Prepared By:** System Documentation
**Reviewed By:** [Pending Review]
**Classification:** Internal Use Only
