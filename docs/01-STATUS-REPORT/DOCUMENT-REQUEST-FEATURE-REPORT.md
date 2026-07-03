# SRAMS Document Request Feature Report

**System:** School Registration and Accounts Monitoring System (SRAMS)
**Report Date:** 2026-07-03
**Report Type:** Feature Implementation Documentation
**Version:** 1.0

---

## Executive Summary

The Document Request feature provides a complete workflow for managing student document requests (Form 137, Form 138, certificates, etc.). It supports both active and archived students with eligibility gates at each workflow stage, ensuring documents are only released when all financial and clearance requirements are met.

Key capabilities:
- Full workflow: `requested` → `processing` → `ready` → `released`
- Eligibility gates (enrollment history, clearances, outstanding balance)
- Concurrent-safe document number allocation via PostgreSQL advisory locks
- PDF export with Form 138 grade aggregation
- Non-blocking cache invalidation for production stability

---

## 1. Business Problem Addressed

### 1.1 The Gap

Prior to this feature, SRAMS had no formal process for:
- Tracking document requests through preparation stages
- Validating eligibility before document release
- Managing document numbers with concurrent safety
- Preventing release when students have outstanding balances
- Generating formatted documents (Form 138 with grades)

### 1.2 Solution Overview

A state-machine workflow with eligibility checks:
1. **Request Phase**: Staff/registrar submits request, eligibility validated
2. **Processing Phase**: Document number assigned, document prepared
3. **Ready Phase**: Document ready, awaiting payment clearance
4. **Release Phase**: Balance + clearances verified, document released

---

## 2. Document Types

### 2.1 Type Definitions

| Type | Label | Description |
|------|-------|-------------|
| `form_137` | Form 137 (Permanent Record) | Official permanent school record / transcript |
| `form_138` | Form 138 (Report Card) | Report card showing quarterly grades |
| `good_moral` | Certificate of Good Moral Character | Certificate attesting to good character and conduct |
| `cert_enrollment` | Certificate of Enrollment | Proof of current enrollment status |
| `cert_completion` | Certificate of Completion | Certificate for completing a grade level or program |
| `diploma_copy` | Copy of Diploma | Certified copy of graduation diploma |
| `other` | Other Document | Other document type - specify in remarks |

### 2.2 Type Constants

```typescript
// src/lib/constants/document-requests.ts
export const DOCUMENT_REQUEST_TYPES = [
  "form_137",
  "form_138",
  "good_moral",
  "cert_enrollment",
  "cert_completion",
  "diploma_copy",
  "other",
] as const;
```

---

## 3. Workflow State Machine

### 3.1 Status Flow

```
                         ┌─────────────┐
                         │  requested  │
                         └──────┬──────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
           process           reject            cancel
              │                 │                 │
              ▼                 ▼                 ▼
       ┌─────────────┐   ┌───────────┐   ┌───────────┐
       │  processing │   │ rejected  │   │ cancelled │
       └──────┬──────┘   └───────────┘   └───────────┘
              │                [FINAL]       [FINAL]
              │
       ┌──────┼──────┐
       │             │
     ready        reject
       │             │
       ▼             ▼
 ┌───────────┐ ┌───────────┐
 │   ready   │ │ rejected  │
 └─────┬─────┘ └───────────┘
       │           [FINAL]
       │
    release
       │
       ▼
 ┌───────────┐
 │ released  │
 └───────────┘
    [FINAL]
```

### 3.2 Status Definitions

| Status | Description |
|--------|-------------|
| `requested` | Request submitted, awaiting processing |
| `processing` | Document is being prepared, number assigned |
| `ready` | Document ready, pending payment clearance |
| `released` | Document has been released to requester |
| `rejected` | Request was rejected (see rejection reason) |
| `cancelled` | Request was cancelled by requester or staff |

---

## 4. Eligibility Gates

### 4.1 Creation Eligibility (Archived Students)

For archived students, document requests are only allowed if the student has valid enrollment history:

```typescript
// src/features/archive/archive.queries.ts
export async function hasValidEnrollmentHistory(
  studentId: string
): Promise<boolean> {
  // Valid if:
  // - Has enrollment with status = 'enrolled', OR
  // - Has assessment with totalPaid > 0
}
```

**Blocked If:**
- No enrollments at all
- Only pending enrollments
- Only assessed enrollments with zero payment
- Only cancelled enrollments

### 4.2 Processing Eligibility

All clearances must be resolved before processing:

```typescript
// src/features/documents/document-requests.queries.ts
export async function checkDocumentProcessingEligibility(
  studentId: string
): Promise<{ canProcess: true } | { canProcess: false; reason: string }> {
  const hasPending = await hasPendingClearances(studentId);
  if (hasPending) {
    return {
      canProcess: false,
      reason: "Cannot process document while student has pending clearances.",
    };
  }
  return { canProcess: true };
}
```

### 4.3 Release Eligibility

Two conditions must be met for release:

```typescript
export async function checkDocumentReleaseEligibility(
  studentId: string
): Promise<{ canRelease: true } | { canRelease: false; reason: string }> {
  // 1. Outstanding balance must be zero (≤ 0.01 tolerance)
  const balance = await getStudentOutstandingBalance(studentId);
  if (balance > 0.01) {
    return {
      canRelease: false,
      reason: `Student has an outstanding balance of ${formatCurrency(balance)}`,
    };
  }

  // 2. No pending clearances
  const hasPending = await hasPendingClearances(studentId);
  if (hasPending) {
    return {
      canRelease: false,
      reason: "Student has pending clearances that must be resolved first",
    };
  }

  return { canRelease: true };
}
```

---

## 5. Database Schema

### 5.1 Table: `document_requests`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `student_id` | uuid (FK) | Link to student |
| `school_year_id` | uuid (FK, nullable) | Optional school year context |
| `document_type` | enum | Type of document requested |
| `purpose` | text | Purpose of request (3-500 chars) |
| `copies` | integer | Number of copies (1-10) |
| `status` | enum | Workflow status |
| `fee_amount` | decimal | Optional fee for document |
| `document_number` | varchar | Allocated number (DOC-YYYY-NNNNN) |
| `remarks` | text | Staff notes |
| `rejected_reason` | text | Required if rejected |
| `payment_id` | uuid (FK, nullable) | Link to payment if fee paid |
| `requested_by` | uuid (FK) | User who created request |
| `requested_at` | timestamp | Request submission time |
| `processed_by` | uuid (FK, nullable) | User who processed |
| `processed_at` | timestamp | Processing time |
| `released_by` | uuid (FK, nullable) | User who released |
| `released_at` | timestamp | Release time |
| `created_at` / `updated_at` | timestamp | Standard audit fields |
| `deleted_at` / `deleted_by` | timestamp/uuid | Soft delete fields |

### 5.2 Document Number Format

```
DOC-YYYY-NNNNN
     │    │
     │    └── 5-digit sequence (zero-padded)
     └─────── 4-digit year

Example: DOC-2026-00001, DOC-2026-00042
```

### 5.3 Indexes

- `document_requests_status_idx` - Filter by status
- `document_requests_student_idx` - Student's requests
- `document_requests_school_year_idx` - School year filter
- `document_requests_pending_idx` - Active requests only

---

## 6. File Structure

```
src/features/documents/
├── document-requests.schema.ts      # Zod validation schemas (7 schemas)
├── document-requests.actions.ts     # Server actions (6 actions)
├── document-requests.queries.ts     # Database queries (10+ functions)
├── document.export.tsx              # PDF document generation
├── index.ts                         # Public exports
└── components/
    ├── CreateDocumentRequestDialog.tsx   # Request creation form
    ├── DocumentRequestsTable.tsx         # Main listing table
    ├── DocumentRequestFilters.tsx        # Status/type/search filters
    ├── DocumentRequestStatusActions.tsx  # Action buttons per status
    └── index.ts                          # Component exports
```

---

## 7. Routes

| Route | Purpose |
|-------|---------|
| `/staff/archive/documents` | Document requests list with filters, summary cards |
| `/staff/archive/documents/[id]` | Request detail page with timeline, actions |
| `/staff/archive/documents/[id]/export` | PDF export route handler |

---

## 8. Permission Matrix

| Permission | Super Admin | Admin | Finance | Registrar | Cashier | Teacher |
|------------|-------------|-------|---------|-----------|---------|---------|
| `documents:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `documents:create` | ✓ | ✓ | ✓ | ✓ | | |
| `documents:process` | ✓ | ✓ | ✓ | | | |
| `documents:release` | ✓ | ✓ | | | ✓ | |

**Action to Permission Mapping:**

| Action | Permission | Notes |
|--------|------------|-------|
| Create request | `documents:create` | |
| Process request | `documents:process` | Assigns document number |
| Mark ready | `documents:process` | |
| Release document | `documents:release` | Validates eligibility |
| Reject request | `documents:process` | |
| Cancel request | `documents:process` OR original requester | |

---

## 9. Concurrent Safety

### 9.1 Document Number Allocation

PostgreSQL advisory locks ensure unique document numbers:

```typescript
// src/features/documents/document-requests.actions.ts
const DOC_NUMBER_LOCK_NAMESPACE = 84012;

const documentNumber = await db.transaction(async (tx) => {
  const year = new Date().getFullYear();
  const prefix = `DOC-${year}-`;

  // Transaction-scoped advisory lock keyed by (namespace, year)
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(${DOC_NUMBER_LOCK_NAMESPACE}, ${year})`
  );

  // Get max sequence for this year
  const [{ maxSeq }] = await tx
    .select({
      maxSeq: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(...))))`,
    })
    .from(documentRequests)
    .where(like(documentRequests.documentNumber, `${prefix}%`));

  const nextNumber = formatDocumentNumber(year, Number(maxSeq) + 1);

  // Compare-and-set update
  const updated = await tx
    .update(documentRequests)
    .set({ status: "processing", documentNumber: nextNumber, ... })
    .where(
      and(
        eq(documentRequests.id, requestId),
        eq(documentRequests.status, "requested")  // CAS guard
      )
    )
    .returning({ id: documentRequests.id });

  if (updated.length === 0) {
    throw new ConcurrentTransitionError();
  }

  return nextNumber;
});
```

### 9.2 Compare-and-Set Pattern

All state transitions use CAS to prevent race conditions:

```typescript
const releaseUpdated = await db
  .update(documentRequests)
  .set({ status: "released", ... })
  .where(
    and(
      eq(documentRequests.id, requestId),
      eq(documentRequests.status, request.status)  // Must match current status
    )
  )
  .returning({ id: documentRequests.id });

if (releaseUpdated.length === 0) {
  return { message: CONCURRENT_TRANSITION_MESSAGE };
}
```

### 9.3 Non-Blocking Cache Invalidation

Server actions use `invalidateTag()` instead of blocking `forceUpdateTag()`:

```typescript
// ❌ BAD: Blocks response (causes form freeze in production)
forceUpdateTag(CACHE_TAGS.DOCUMENT_REQUESTS);
revalidatePath("/staff/archive/documents");

// ✓ GOOD: Non-blocking (client calls router.refresh())
invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);
return { success: true };
```

---

## 10. PDF Export

### 10.1 Export Architecture

Uses `@react-pdf/renderer` with shared report primitives:

```typescript
// src/features/documents/document.export.tsx
export type DocumentExportData = {
  requestId: string;
  documentType: DocumentRequestType;
  documentNumber: string | null;
  studentName: string;
  studentReferenceNumber: string;
  gradeLevel: string | null;
  section: string | null;
  schoolYearLabel: string | null;
  purpose: string | null;
  releasedAt: Date | null;
  copies: number;
  grades?: Array<{
    subject: string;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
    final: number | null;
    remarks: string | null;
  }>;
};
```

### 10.2 Form 138 Grade Aggregation

Grades are aggregated from `gradeRecords` by subject:

```typescript
// Only locked (final) grades appear on Form 138
const gradeData = await db
  .select({
    subjectName: subjects.name,
    gradingPeriod: gradeRecords.gradingPeriod,
    grade: gradeRecords.grade,
  })
  .from(gradeRecords)
  .where(
    and(
      eq(gradeRecords.studentId, studentId),
      eq(gradeRecords.schoolYearId, schoolYearId),
      eq(gradeRecords.status, "locked")  // Only final grades
    )
  );
```

### 10.3 DepEd Remarks Scale

| Final Grade | Remark |
|-------------|--------|
| 90+ | Outstanding |
| 85-89 | Very Satisfactory |
| 80-84 | Satisfactory |
| 75-79 | Fairly Satisfactory |
| Below 75 | Did Not Meet Expectations |

---

## 11. Audit Trail

### 11.1 Logged Actions

| Action | Target Entity | Logged Data |
|--------|---------------|-------------|
| `documents:create` | `document_requests` | student ID, document type, copies |
| `documents:process` | `document_requests` | previous status, fee amount, document number |
| `documents:ready` | `document_requests` | previous status, document number |
| `documents:release` | `document_requests` | previous status → released |
| `documents:reject` | `document_requests` | previous status, rejection reason |
| `documents:cancel` | `document_requests` | previous status → cancelled |

### 11.2 Export Audit

PDF exports are logged via `logReportExport()`:

```typescript
await logReportExport({
  actor: session.userId,
  report: `document_request:${documentType}`,
  format: "pdf",
  rowCount: 1,
  filters: { requestId, studentId },
});
```

---

## 12. Server Actions Summary

| Action | Input | Output | Permission |
|--------|-------|--------|------------|
| `createDocumentRequestAction` | studentId, documentType, copies, purpose, remarks | requestId | `documents:create` |
| `processDocumentRequestAction` | requestId, feeAmount, remarks | success | `documents:process` |
| `readyDocumentRequestAction` | requestId, remarks | success | `documents:process` |
| `releaseDocumentRequestAction` | requestId, remarks | success | `documents:release` |
| `rejectDocumentRequestAction` | requestId, rejectedReason | success | `documents:process` |
| `cancelDocumentRequestAction` | requestId, remarks | success | `documents:process` or requester |

---

## 13. Testing Verification

### 13.1 Build Status
```
✓ Compiled successfully
✓ TypeScript: No errors
```

### 13.2 Manual Testing Scenarios

1. **Create Request (Active Student)**: Verify request created, status = requested
2. **Create Request (Archived Student - Valid)**: Verify allowed for students with enrollment history
3. **Create Request (Archived Student - Invalid)**: Verify blocked for students without valid enrollment
4. **Process Request**: Verify document number assigned, status = processing
5. **Mark Ready**: Verify status = ready
6. **Release (Eligible)**: Verify release succeeds when balance = 0 and no clearances
7. **Release (Ineligible - Balance)**: Verify blocked with balance message
8. **Release (Ineligible - Clearances)**: Verify blocked with clearance message
9. **Reject Request**: Verify rejection reason required
10. **Cancel Request**: Verify original requester can cancel own request
11. **Concurrent Processing**: Verify only one operator succeeds with CAS
12. **PDF Export (Form 138)**: Verify grades aggregated correctly

---

## 14. Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Archived student without enrollment | Creation blocked with eligibility message |
| Concurrent document number allocation | Advisory lock serializes, CAS prevents duplicates |
| Concurrent status transition | CAS pattern returns "already updated" message |
| Release with balance | Blocked with formatted balance amount |
| Release with pending clearances | Blocked with clearance message |
| Cancel already-released | Blocked (cannot cancel terminal status) |
| Form 138 without grades | Grades section omitted from PDF |
| Cache blocking in production | Non-blocking invalidateTag used |

---

## 15. Future Enhancements

1. **Email Notifications**: Notify student when document is ready
2. **Fee Integration**: Auto-create assessment item for document fee
3. **Bulk Processing**: Process multiple requests at once
4. **Document Templates**: Admin-configurable document templates
5. **Digital Signatures**: E-sign support for official documents
6. **QR Code Verification**: QR code for document authenticity

---

## 16. Migration Notes

### 16.1 Database Migration

The `document_requests` table was created with the document request feature migration. Run migrations to ensure schema is current:

```bash
npm run db:migrate
```

### 16.2 Cache Configuration

Document requests use short-lived caching:

```typescript
export async function getDocumentRequestById(requestId: string) {
  "use cache";
  cacheTag(CACHE_TAGS.DOCUMENT_REQUESTS);
  cacheLife("seconds");  // Very short cache for transactional data
  // ...
}
```

### 16.3 Production Note

Server actions use `invalidateTag()` (non-blocking) instead of `forceUpdateTag()` (blocking) to prevent response hangs in production Docker environments. The client is responsible for calling `router.refresh()` after successful mutations.

---

**Report Prepared By:** System Documentation
**Reviewed By:** [Pending Review]
**Classification:** Internal Use Only
