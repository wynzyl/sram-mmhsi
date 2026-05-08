# Memory Optimization Plan: Fix JavaScript Heap Out of Memory Error

## Problem Analysis

**Root Cause:** The SRAMS application is experiencing fatal `JavaScript heap out of memory` errors caused by unbounded data fetching in the enrollment queue system.

**Critical Code Path:** `lib/queries/enrollment-queue.ts` → `getEnrollmentQueueData()` function

### Identified Issues

1. **Unlimited Data Loading (CRITICAL - Lines 540-546)**
   - `getEnrollmentQueueData()` executes 5 concurrent database queries via `Promise.all()` without any LIMIT clause
   - Each query can return thousands of records for schools with large student populations
   - All records loaded into memory simultaneously before rendering

2. **Inefficient Old Student Processing (HIGH - Lines 237-263, 281-322)**
   - `getReadyToEnrollStudents()` fetches ALL enrollments from ALL previous school years
   - No filtering by year depth (could fetch 5+ years of historical data)
   - Creates multiple intermediate data structures: Sets (line 208), Maps (line 275, 279)
   - Processes everything in a for loop with object creation per iteration

3. **Client-Side Data Table (MEDIUM)**
   - All data passed to `DataTable` component which holds everything in React state
   - TanStack Table performs pagination in memory, not at query level
   - No virtual scrolling for large datasets

4. **No Result Limits (CRITICAL)**
   - Zero LIMIT or OFFSET clauses in any enrollment queue query
   - For a school with 5,000 students over 4 years = 20,000+ potential records in memory

### Estimated Memory Impact

**Scenario:** School with 5,000 active students, 3 years of historical data
- Ready to Enroll: 1,000 records × ~2KB = ~2MB
- Pending: 500 records × ~1.5KB = ~750KB
- Assessed: 800 records × ~2KB = ~1.6MB
- Enrolled: 4,500 records × ~1.5KB = ~6.75MB
- Cancelled: 200 records × ~1.5KB = ~300KB
- Old student lookups: 15,000 records × ~2.5KB = ~37.5MB
- **Total: ~48.9MB per page load**

With concurrent users and Next.js build process, this quickly exhausts available heap.

---

## Solution Strategy

### Phase 1: Immediate Fixes (Stop the Bleeding)

**Goal:** Prevent immediate crashes while planning comprehensive solution

#### 1.1 Increase Node.js Heap Limit (Temporary Mitigation)
**File:** `package.json` (lines 6-8)

**Change:**
```json
"scripts": {
  "dev": "NODE_OPTIONS='--max-old-space-size=4096' next dev",
  "build": "NODE_OPTIONS='--max-old-space-size=4096' next build",
  "start": "NODE_OPTIONS='--max-old-space-size=2048' next start",
```

**Reasoning:** Increases heap from default ~2GB to 4GB for dev/build, 2GB for production. Buys time but doesn't solve root cause.

#### 1.2 Add Emergency LIMIT Clauses
**File:** `lib/queries/enrollment-queue.ts`

**Target Functions:**
- `getReadyToEnrollStudents()` (line 174, 237) → Add `.limit(500)`
- `getPendingEnrollments()` (line 338) → Add `.limit(200)`
- `getAssessedEnrollments()` (line 387) → Add `.limit(200)`
- `getEnrolledStudents()` (line 443) → Add `.limit(500)`
- `getCancelledEnrollments()` (line 490) → Add `.limit(100)`

**Expected Impact:** Reduces max memory per request from ~48MB to ~10MB

---

### Phase 2: Pagination Infrastructure

**Goal:** Implement proper server-side pagination for all enrollment queries

#### 2.1 Create Pagination Utility Types
**New File:** `lib/types/pagination.ts`

**Contents:**
```typescript
export type PaginationParams = {
  page: number;      // 1-indexed
  pageSize: number;  // Records per page
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
```

#### 2.2 Update Enrollment Queue Queries
**File:** `lib/queries/enrollment-queue.ts`

**Changes:**

1. Add pagination parameters to all query functions:
   - `getReadyToEnrollStudents(schoolYearId, params: PaginationParams)`
   - `getPendingEnrollments(schoolYearId, params: PaginationParams)`
   - `getAssessedEnrollments(schoolYearId, params: PaginationParams)`
   - `getEnrolledStudents(schoolYearId, params: PaginationParams)`
   - `getCancelledEnrollments(schoolYearId, params: PaginationParams)`

2. Add COUNT queries before each SELECT to get total records

3. Apply LIMIT and OFFSET based on pagination params:
   ```typescript
   const offset = (params.page - 1) * params.pageSize;
   // ... existing query
   .limit(params.pageSize)
   .offset(offset)
   ```

4. Return `PaginatedResult<T>` instead of `T[]`

5. **Critical:** Limit old student lookup to previous year only (line 257):
   ```typescript
   .where(
     and(
       eq(enrollments.schoolYearId, previousSchoolYearId), // Only 1 year back
       eq(enrollments.status, "enrolled"),
       eq(students.isActive, true)
     )
   )
   ```

#### 2.3 Update Main Queue Function
**File:** `lib/queries/enrollment-queue.ts` (line 533)

**Changes:**
```typescript
export async function getEnrollmentQueueData(
  tab: TabKey,
  params: PaginationParams
): Promise<PaginatedResult<any>> {
  const activeSchoolYearId = await getActiveSchoolYearId();
  if (!activeSchoolYearId) throw new Error("No active school year");

  // Only fetch data for the CURRENT tab (not all 5 tabs)
  switch (tab) {
    case "ready-to-enroll":
      return getReadyToEnrollStudents(activeSchoolYearId, params);
    case "pending":
      return getPendingEnrollments(activeSchoolYearId, params);
    // ... etc
  }
}
```

**Key Change:** Fetch only ONE tab's data at a time, not all 5 via Promise.all()

---

### Phase 3: Update UI Components

#### 3.1 Add Pagination to Data Tables
**File:** `components/data-display/DataTable.tsx`

**Changes:**
- Remove client-side pagination (`getPaginationRowModel()`)
- Add server pagination controls (Next/Previous buttons)
- Display total records count
- Add page size selector (10, 25, 50, 100)

#### 3.2 Update Enrollment Queue Page
**File:** `src/app/_internal/enrollments/enrollments-queue-page.tsx`

**Changes:**

1. Accept pagination search params:
   ```typescript
   searchParams: Promise<{
     tab?: string;
     search?: string;
     gradeLevel?: string;
     page?: string;        // NEW
     pageSize?: string;    // NEW
   }>
   ```

2. Parse pagination params:
   ```typescript
   const page = parseInt(params.page || "1", 10);
   const pageSize = parseInt(params.pageSize || "25", 10);
   ```

3. Update data fetching (line 83):
   ```typescript
   const queueData = await getEnrollmentQueueData(currentTab, { page, pageSize });
   ```

4. Remove Promise.all() for sections/gradeLevels (fetch separately or cache)

5. Pass pagination data to table components:
   ```typescript
   <ReadyToEnrollTableClient
     paginatedData={queueData}
     basePath={enrollmentsBasePath}
   />
   ```

#### 3.3 Update Individual Table Components
**Files:**
- `components/enrollments/ReadyToEnrollTableClient.tsx`
- `components/enrollments/EnrollmentStatusTables.tsx`

**Changes:**
- Accept `PaginatedResult<T>` instead of `T[]`
- Render pagination controls at bottom
- Update URL params on page change using Next.js router

---

### Phase 4: Tab Count Optimization

**Problem:** Tab badges show counts, but fetching all tabs' counts on every page load defeats pagination purpose.

**Solution:** Lazy-load tab counts via separate lightweight queries

#### 4.1 Create Count-Only Queries
**File:** `lib/queries/enrollment-queue.ts`

**Add:**
```typescript
export async function getEnrollmentQueueCounts(
  activeSchoolYearId: string
): Promise<{
  readyToEnroll: number;
  pending: number;
  assessed: number;
  enrolled: number;
  cancelled: number;
}> {
  // Use COUNT(*) instead of SELECT *
  const [ready, pend, assess, enr, cancel] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(/* ... conditions */),
    // ... similar for other tabs
  ]);

  return {
    readyToEnroll: ready[0]?.count || 0,
    pending: pend[0]?.count || 0,
    // ... etc
  };
}
```

**Benefit:** COUNT queries are fast (use indexes) and return tiny result set

#### 4.2 Cache Tab Counts
**Implementation:** Use Next.js `unstable_cache` with 5-minute TTL:
```typescript
import { unstable_cache } from 'next/cache';

const getTabCounts = unstable_cache(
  async (schoolYearId: string) => getEnrollmentQueueCounts(schoolYearId),
  ['enrollment-queue-counts'],
  { revalidate: 300 } // 5 minutes
);
```

---

### Phase 5: Performance Optimizations

#### 5.1 Add Database Indexes
**New Migration File:** `drizzle/XXXX_add_enrollment_queue_indexes.sql`

**Indexes to Create:**
```sql
-- Speed up enrollment status filtering
CREATE INDEX IF NOT EXISTS idx_enrollments_schoolyear_status
  ON enrollments(school_year_id, status) WHERE deleted_at IS NULL;

-- Speed up registration filtering
CREATE INDEX IF NOT EXISTS idx_registrations_schoolyear_status
  ON registrations(school_year_id, status) WHERE deleted_at IS NULL;

-- Speed up assessment lookups
CREATE INDEX IF NOT EXISTS idx_assessments_enrollment
  ON assessments(enrollment_id) WHERE deleted_at IS NULL;

-- Speed up old student lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_student_year
  ON enrollments(student_id, school_year_id, status) WHERE deleted_at IS NULL;
```

#### 5.2 Implement Search Debouncing
**File:** `components/enrollments/EnrollmentGlobalFilters.tsx`

**Change:** Add 300ms debounce to search input to prevent query spam

#### 5.3 Add Loading States
**File:** `src/app/_internal/enrollments/enrollments-queue-page.tsx`

**Add:** Suspense boundaries with skeleton loaders for each tab

---

### Phase 6: Monitoring & Validation

#### 6.1 Add Memory Monitoring (Optional)
**File:** `lib/utils/memory-monitor.ts`

**Purpose:** Log memory usage in development to detect future issues

```typescript
export function logMemoryUsage(label: string) {
  if (process.env.NODE_ENV === 'development') {
    const used = process.memoryUsage();
    console.log(`[${label}] Memory Usage:`, {
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    });
  }
}
```

#### 6.2 Add Query Result Warnings
**File:** `lib/queries/enrollment-queue.ts`

**Add:** Log warning if query returns near-limit results (suggests pagination needed)

---

## Implementation Order

### Priority 1: Emergency Fixes (Deploy ASAP)
1. ✅ Increase heap limit in package.json
2. ✅ Add LIMIT clauses to all queries (hard-coded 500 for now)
3. ✅ Restrict old student lookup to 1 year back only

**Estimated Time:** 30 minutes
**Expected Impact:** Prevents crashes for databases with <10,000 students

### Priority 2: Core Pagination (Next Sprint)
1. ✅ Create pagination types (`lib/types/pagination.ts`)
2. ✅ Update all 5 enrollment queue queries to support pagination
3. ✅ Change `getEnrollmentQueueData()` to fetch only current tab
4. ✅ Update page component to pass pagination params
5. ✅ Update table components to render pagination controls

**Estimated Time:** 4-6 hours
**Expected Impact:** Reduces memory usage by 80-90%

### Priority 3: Optimization (Follow-up)
1. ✅ Implement tab count caching
2. ✅ Add database indexes
3. ✅ Add search debouncing
4. ✅ Add loading states

**Estimated Time:** 2-3 hours
**Expected Impact:** Improves page load speed by 50-70%

---

## Critical Files to Modify

1. **package.json** (line 6-8) — Heap limit increase
2. **lib/queries/enrollment-queue.ts** (entire file) — Pagination implementation
3. **lib/types/pagination.ts** (new file) — Type definitions
4. **src/app/_internal/enrollments/enrollments-queue-page.tsx** (lines 83-93, 120-177) — Server-side pagination
5. **components/enrollments/ReadyToEnrollTableClient.tsx** — Client pagination UI
6. **components/enrollments/EnrollmentStatusTables.tsx** — Client pagination UI
7. **components/data-display/DataTable.tsx** — Remove client-side pagination
8. **drizzle/XXXX_add_indexes.sql** (new migration) — Database indexes

---

## Verification Steps

### After Emergency Fixes:
1. ✅ Run `npm run dev` without heap errors
2. ✅ Navigate to enrollment queue page with 1,000+ students
3. ✅ Check memory usage stays below 2GB

### After Pagination:
1. ✅ Verify only 25-50 records load per page
2. ✅ Test pagination controls (Next/Previous)
3. ✅ Verify search + pagination works together
4. ✅ Test all 5 tabs load independently
5. ✅ Run `npm run build` successfully

### After Optimization:
1. ✅ Verify tab counts update within 5 minutes of changes
2. ✅ Test search debouncing (type fast, verify single query)
3. ✅ Run database query EXPLAIN on enrollment queries (verify index usage)
4. ✅ Load test with 10,000+ student database

---

## Rollback Plan

If pagination introduces bugs:
1. Keep heap limit increase
2. Keep LIMIT clauses (revert to 500 hard-coded)
3. Revert pagination params changes
4. Revert UI component changes

This maintains crash prevention while allowing time to debug pagination logic.

---

## Additional Recommendations

### 1. Consider Virtual Scrolling
For very large result sets (>1,000 records), implement virtual scrolling using `react-window` or `@tanstack/react-virtual` to render only visible rows.

### 2. Implement Search Server-Side
Current implementation passes all data to client for search. Move search to database query with WHERE clauses on `students.firstName`, `students.lastName`, `students.referenceNumber`.

### 3. Add Result Caching
Use Next.js 15+ caching for enrollment queue data with short TTL (1-2 minutes) to reduce database load.

### 4. Consider Materialized Views
For complex queries like `getReadyToEnrollStudents()`, create a PostgreSQL materialized view refreshed nightly to pre-compute eligible students.

### 5. Monitor in Production
Set up application monitoring (New Relic, DataDog, or CloudWatch) to track:
- Memory usage per request
- Query execution time
- Slow query logs
- Error rates

---

## Success Criteria

✅ **No more heap out of memory errors** with databases up to 50,000 enrollment records
✅ **Page load time < 2 seconds** for enrollment queue
✅ **Memory usage < 1GB** per Node.js process
✅ **Database queries < 500ms** with proper indexes
✅ **User experience preserved** (no broken features)

---

## End of Plan

This comprehensive plan addresses both immediate crashes and long-term scalability. Priority 1 fixes should be deployed immediately to restore system stability, followed by proper pagination implementation in the next development cycle.
