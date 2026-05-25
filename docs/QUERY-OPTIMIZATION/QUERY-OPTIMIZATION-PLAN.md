# Query Optimization Plan

## Overview

Audit and optimize all data queries to return only the fields needed by components, following the specification in `docs/QUERY-OPTIMIZATION/Optimization-Plan.md`.

**Current State:** 12 query files exist with mostly good patterns (selective columns, DTOs, pagination). Some over-fetching identified.

---

## Priority 1: High Impact Optimizations

### 1.1 ReadyToEnrollStudent DTO Split (Highest Priority)

**File:** `src/features/enrollments/enrollments-queue.queries.ts`

**Problem:** 23 fields returned, but table uses only ~12 fields. `intakeDocuments` JSON object (potentially large) is fetched but only used in drawer.

**Solution:**
1. Create `ReadyToEnrollListRow` (13 fields) for table display
2. Keep `ReadyToEnrollDetail` for drawer with lazy-loading
3. Remove unused fields: `previousEnrollmentId`, `previousGradeLevelId`, `previousGradeOrder`, `suggestedGradeOrder`

**Files to Modify:**
- `src/features/enrollments/enrollments-queue.queries.ts` - Split DTOs
- `src/features/enrollments/components/ReadyToEnrollTable.tsx` - Use list DTO
- `src/features/enrollments/components/EnrollmentConfirmationDrawer.tsx` - Lazy-load detail

**Estimated Savings:** 30-40% reduction per row

---

### 1.2 DiscountRequestView Split

**File:** `src/features/discounts/discounts.queries.ts`

**Problem:** 27 fields in `DiscountRequestView`, used across multiple contexts with different field requirements.

**Solution:**
1. Create `DiscountRequestListRow` (12 fields) for queue tables
2. Keep full `DiscountRequestView` for detail views
3. Create `DiscountRequestSummary` (6 fields) for badges/counts

**Files to Modify:**
- `src/features/discounts/discounts.queries.ts` - Split DTOs
- `src/features/discounts/discounts.schema.ts` - Add new types
- Components using discount requests

---

## Priority 2: Medium Impact (Code Quality)

### 2.1 Extract Inline Queries to Query Files

| Page File | Extract To |
|-----------|------------|
| `src/app/staff/finance/fee-schedules/page.tsx` | `fee-schedules.queries.ts` |
| `src/app/staff/grades/page.tsx` | `grades.queries.ts` |
| `src/app/staff/academics/subjects/page.tsx` | `academics.queries.ts` |

**Benefits:** Centralized query logic, easier optimization, better type safety

### 2.2 StudentDirectoryRow Cleanup 

**File:** `src/features/students/students.queries.ts`

**Action:** Remove `middleName` field (not used in table display) DO NOT REMOVE MIGHT USE in the FUTURE

---

## Priority 3: Lower Impact (Technical Debt)

### 3.1 Add Pagination to Admin Pages

**Pages missing pagination:**
- `src/app/staff/academics/subjects/page.tsx`
- `src/app/staff/finance/fee-schedules/page.tsx`
- `src/app/staff/grades/page.tsx`

**Pattern to follow:** `src/lib/types/pagination.ts` with `PaginatedResult<T>`

### 3.2 Create Dropdown-Specific DTOs

Apply `getFeeTemplatesForDropdown()` pattern to:
- `getActiveDiscountTypes()` → `DiscountTypeDropdownOption`
- Grade level selectors → `GradeLevelDropdownOption`

---

## Implementation Sequence

```
Phase 1: ReadyToEnrollStudent optimization
  ├── 1a. Create ReadyToEnrollListRow type
  ├── 1b. Create getReadyToEnrollDetail() lazy-load function
  ├── 1c. Update ReadyToEnrollTable component
  └── 1d. Update EnrollmentConfirmationDrawer component

Phase 2: DiscountRequestView split
  ├── 2a. Create DiscountRequestListRow type
  ├── 2b. Update getPendingDiscountRequests()
  └── 2c. Update discount queue components

Phase 3: Extract inline queries
  ├── 3a. Create grades.queries.ts
  ├── 3b. Create academics.queries.ts (subjects)
  └── 3c. Update page components

Phase 4: Add pagination
  ├── 4a. Paginate subjects list
  └── 4b. Paginate fee schedules list

Phase 5: Minor cleanups
  ├── 5a. Remove middleName from StudentDirectoryRow
  └── 5b. Create dropdown DTOs
```

---

## Critical Files

**Primary Targets:**
- `src/features/enrollments/enrollments-queue.queries.ts`
- `src/features/discounts/discounts.queries.ts`
- `src/features/students/students.queries.ts`

**Components to Update:**
- `src/features/enrollments/components/ReadyToEnrollTable.tsx`
- `src/features/enrollments/components/EnrollmentConfirmationDrawer.tsx`
- `src/features/discounts/components/DiscountRequestsTable.tsx`

**Reference Patterns:**
- `src/lib/types/pagination.ts` - Pagination utilities
- `src/features/payments/payments.queries.ts` - Good DTO pattern example

---

## Verification Steps

After each phase:

1. **TypeScript Check**
   ```bash
   npm run build
   ```

2. **Unit Tests**
   ```bash
   npm run test
   ```

3. **Manual Verification**
   - Load enrollment queue page → verify table renders correctly
   - Open enrollment drawer → verify details load
   - Load discount requests → verify queue displays
   - Test pagination on updated pages

4. **Payload Size Check**
   - Use browser DevTools Network tab
   - Compare before/after JSON response sizes

---

## No-Change Files (Already Optimized)

These files follow good patterns and need no changes:
- `src/features/payments/payments.queries.ts` - CashierQueueRow uses all 8 fields
- `src/features/assessments/assessments.queries.ts` - AssessmentListItem uses all 7 fields
- `src/features/reports/balance-forward-report.queries.ts` - Aggregation queries only
