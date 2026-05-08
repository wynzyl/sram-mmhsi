# Enrollment Process Revision Plan

**Document Version:** 1.0
**Date:** 2026-05-08
**Status:** Proposal for Implementation

---

## Executive Summary

The current enrollment system uses a **form-first approach** where registrars manually create enrollments through a wizard form. The desired system uses a **list-first approach** where eligible students automatically appear in a queue and registrars confirm enrollments with a single action.

---

## Current vs. Desired State

### Current Flow (Form-First)
```
/staff/enrollments/new
  → Select student from dropdown
  → Fill enrollment form manually
  → Submit → Creates enrollment with status "pending"
```

**Problems:**
- ❌ Manual data entry prone to errors
- ❌ No visibility of eligible students
- ❌ Old students must be manually searched and enrolled
- ❌ No document review workflow integration
- ❌ Registrar must remember who needs enrollment

### Desired Flow (List-First)
```
/staff/enrollments (Enrollment Queue)
  → "Ready to Enroll" tab shows eligible students automatically
  → Click student → Side panel opens with context
  → Review details → Click "Confirm Enrollment"
  → Status changes to "Pending"
  → Appears in "Pending" tab
  → Finance officer assesses → "Assessed"
  → Payment made → "Enrolled"
```

**Benefits:**
- ✅ Zero manual data entry for enrollment confirmation
- ✅ Eligible students appear automatically
- ✅ Built-in document review workflow
- ✅ Clear queue-based workflow
- ✅ Prevents duplicate enrollments

---

## Implementation Phases

### Phase 1: Database & Schema Updates

#### 1.1 Add Enrollment Eligibility View/Query
**Purpose:** Identify students who should appear in "Ready to Enroll" queue

**Logic:**
- **New/Transferee Students:**
  - Has approved registration for current school year
  - NOT already enrolled in current school year
  - Registration not yet linked to an enrollment

- **Old Students:**
  - Has enrollment in previous school year (status = enrolled)
  - NOT enrolled in current school year
  - NOT cancelled in previous year

**Implementation:**
- Create query function: `getReadyToEnrollStudents(schoolYearId: string)`
- Returns: Student info + reason (new/transferee/returning) + context (registration ID or previous enrollment ID)

#### 1.2 Add Balance/Clearance Tracking
**Purpose:** Show balance status for returning students

**Options:**
1. Calculate on-the-fly from assessments
2. Add `hasOutstandingBalance` computed field
3. Add manual clearance approval step

**Recommendation:** Calculate from assessments table during query (no schema change needed)

---

### Phase 2: Backend Actions & Queries

#### 2.1 New Query: `getEnrollmentQueue()`
**File:** `lib/queries/enrollment-queue.ts`

**Returns tabs:**
```typescript
{
  readyToEnroll: [...],    // Students eligible for enrollment
  pending: [...],          // Enrollments created but not assessed
  assessed: [...],         // Assessed, awaiting payment
  enrolled: [...],         // Fully enrolled
  cancelled: [...]         // Cancelled enrollments
}
```

**Columns for "Ready to Enroll":**
- Student name + reference number
- Student type (new/transferee/old)
- Previous grade level (if old student)
- Enrolling grade level (from registration or auto-promotion)
- School year
- Document status (complete/incomplete)
- Balance status (clear/outstanding) - for old students only
- Action button

#### 2.2 Refactor Enrollment Action
**Current:** `createEnrollmentAction` - accepts form data
**New:** `confirmEnrollmentAction` - accepts student ID + minimal context

**Input:**
```typescript
{
  studentId: string;
  schoolYearId: string;
  gradeLevelId: string;
  registrationId?: string;  // For new/transferee
  studentType: "new_student" | "transferee" | "old_student";
  sectionId?: string;       // Optional section assignment
}
```

**Logic:**
1. Validate student is eligible (appears in ready queue)
2. For new/transferee: Link to approved registration
3. For old student: Validate grade progression
4. Create enrollment with status "pending"
5. Audit log
6. Return success → Student moves to "Pending" tab

#### 2.3 Old Student Auto-Population Logic
**Trigger:** School year rollover or manual "Populate Returning Students" action

**Implementation Options:**
1. **On-demand query** (Recommended): Calculate eligible students when "Ready to Enroll" tab is viewed
2. **Background job:** Pre-populate enrollment records with status "ready" at school year start
3. **Manual trigger:** Admin clicks "Import Returning Students" button

**Recommendation:** Use on-demand query approach (no schema changes, flexible)

---

### Phase 3: Frontend Components

#### 3.1 Replace Enrollments Index Page
**Current:** `enrollments-index-page.tsx` - Basic table
**New:** Tabbed interface with status-based organization

**Components Needed:**
- `EnrollmentQueueTabs` - Tab navigation (5 tabs)
- `ReadyToEnrollTable` - Students eligible for enrollment
- `PendingEnrollmentsTable` - Enrollments awaiting assessment
- `AssessedEnrollmentsTable` - Awaiting payment
- `EnrolledTable` - Completed enrollments
- `CancelledTable` - Cancelled enrollments

#### 3.2 Create Enrollment Confirmation Drawer
**Component:** `components/enrollments/EnrollmentConfirmationDrawer.tsx`

**Purpose:** Show student context and provide single-click confirmation

**For New/Transferee Students:**
```
┌─ Enrollment Confirmation ──────────────────┐
│ [Student Photo]                            │
│ Juan Dela Cruz (STU-2024-00123)            │
│ Type: New Student / Transferee             │
│                                            │
│ ─── Registration Details ───               │
│ • Registration ID: REG-2024-0045           │
│ • Applied Date: 2024-06-15                 │
│ • Status: Approved                         │
│                                            │
│ ─── Documents ───                          │
│ ✓ Form 138                                 │
│ ✓ Birth Certificate (PSA)                  │
│ ✓ Good Moral Character                     │
│ ⚠ Qualified Voucher: To Follow            │
│ N/A ESC Certificate                        │
│                                            │
│ ─── Enrollment Details ───                 │
│ School Year: 2024-2025                     │
│ Grade Level: Grade 7                       │
│ Section: [Dropdown - Optional]             │
│ Previous School: [If transferee]           │
│                                            │
│ [Cancel] [Confirm Enrollment] ←           │
└────────────────────────────────────────────┘
```

**For Old Students:**
```
┌─ Re-Enrollment Confirmation ───────────────┐
│ [Student Photo]                            │
│ Maria Santos (STU-2023-00089)              │
│ Type: Returning Student                    │
│                                            │
│ ─── Previous Enrollment ───                │
│ • School Year: 2023-2024                   │
│ • Grade Level: Grade 6                     │
│ • Section: St. Joseph                      │
│ • Status: Enrolled (completed)             │
│                                            │
│ ─── Financial Status ───                   │
│ ✓ No outstanding balance                   │
│ • Last payment: 2024-03-15                 │
│                                            │
│ ─── Promotion Details ───                  │
│ Previous Grade: Grade 6                    │
│ Promoting to: Grade 7                      │
│ Section: [Dropdown - Optional]             │
│                                            │
│ ⚠ Note: Student has outstanding balance    │
│   of ₱2,500.00. Proceed with enrollment?   │
│                                            │
│ [Cancel] [Confirm Re-Enrollment] ←        │
└────────────────────────────────────────────┘
```

#### 3.3 Deprecate Enrollment Wizard Form
**Current:** `EnrollmentWizardForm.tsx` - Multi-step form
**Action:** Mark as deprecated, keep for edge cases only

**Use Cases to Keep:**
- Manual enrollment override (admin only)
- Mid-year transfers without prior registration
- Data correction scenarios

**New Location:** `/staff/enrollments/manual-entry` (admin-only route)

---

### Phase 4: UX Flow Revisions

#### 4.1 Registrar Daily Workflow
```
1. Open /staff/enrollments
2. Click "Ready to Enroll" tab
3. See list of eligible students (new, transferee, returning)
4. Click student name → Drawer opens
5. Review details:
   - New/Transferee: Check registration + documents
   - Old Student: Check previous enrollment + balance
6. Click "Confirm Enrollment" or "Confirm Re-Enrollment"
7. Student moves to "Pending" tab
8. Repeat for next student
```

#### 4.2 Finance Officer Workflow (No Change)
```
1. Open /staff/assessments
2. See "Pending" enrollments
3. Create assessment for enrollment
4. Enrollment status → "Assessed"
```

#### 4.3 Cashier Workflow (No Change)
```
1. Student pays
2. Cashier posts payment
3. If assessment fully paid → Enrollment status → "Enrolled"
```

---

## Migration Strategy

### Option B: Parallel Systems (Recommended)
- Keep current form-first approach functional
- Build new list-first approach alongside
- Route new school year enrollments to new system
- Migrate gradually over 1-2 enrollment cycles

**Pros:** Low risk, gradual adoption
**Cons:** Temporary code duplication

---

## Technical Specifications

### New Files to Create

```
lib/queries/enrollment-queue.ts             # Query for enrollment tabs
components/enrollments/EnrollmentQueueTabs.tsx  # Tab navigation
components/enrollments/ReadyToEnrollTable.tsx   # Ready queue table
components/enrollments/EnrollmentConfirmationDrawer.tsx  # Review drawer
components/enrollments/OldStudentPromotionLogic.tsx     # Auto-promotion helper
actions/enrollment-confirmation.ts          # New confirm action
lib/utils/enrollment-eligibility.ts         # Eligibility logic
```

### Files to Modify

```
src/app/_internal/enrollments/enrollments-index-page.tsx  # Add tabs
actions/enrollments.ts                      # Refactor create → confirm
lib/validators/enrollment.ts                # Simplify validation
```

### Files to Deprecate

```
components/enrollments/EnrollmentWizardForm.tsx  # Mark deprecated
src/app/_internal/enrollments/new-enrollment-page.tsx  # Move to /manual-entry
```

---

## Validation Rules

### Ready to Enroll Eligibility

**New/Transferee:**
- ✅ Has approved registration for current school year
- ✅ Registration not already linked to enrollment
- ✅ No active enrollment in current school year

**Old Student:**
- ✅ Has completed enrollment in previous school year
- ✅ Previous enrollment status = "enrolled"
- ✅ No active enrollment in current school year
- ⚠️ Outstanding balance warning (but not blocking)

### Confirmation Validation

**All Students:**
- ✅ School year is active
- ✅ Grade level is valid
- ✅ Student is active
- ✅ No duplicate enrollment exists

**Transferees:**
- ✅ Previous school name provided

**Old Students:**
- ✅ Grade progression is valid (no skipping grades)
- ✅ Not enrolling in same grade unless admin override

---

## Data Flow Diagram

```
┌─────────────────┐
│ Registration    │
│ (New/Transfer)  │
└────────┬────────┘
         │ Approved
         ↓
┌─────────────────┐         ┌─────────────────┐
│ Previous Year   │         │ Ready to Enroll │
│ Enrollment      │────────→│ Queue           │←─── Registrar reviews
│ (Old Student)   │ Auto    └────────┬────────┘
└─────────────────┘                  │
                                     │ Confirm
                                     ↓
                            ┌─────────────────┐
                            │ Pending         │
                            │ Enrollment      │
                            └────────┬────────┘
                                     │ Finance assesses
                                     ↓
                            ┌─────────────────┐
                            │ Assessed        │
                            │ Enrollment      │
                            └────────┬────────┘
                                     │ Cashier posts payment
                                     ↓
                            ┌─────────────────┐
                            │ Enrolled        │
                            │ (Complete)      │
                            └─────────────────┘
```

---

## Testing Checklist

### Functional Tests
- [ ] New student with approved registration appears in "Ready to Enroll"
- [ ] Transferee student with approved registration appears in "Ready to Enroll"
- [ ] Old student from previous year appears in "Ready to Enroll"
- [ ] Confirming enrollment creates record with status "pending"
- [ ] Confirmed enrollment moves to "Pending" tab
- [ ] Student with outstanding balance shows warning but allows confirmation
- [ ] Student without approved registration does NOT appear in queue
- [ ] Student already enrolled in current year does NOT appear in queue
- [ ] Cancelled enrollments can be viewed in "Cancelled" tab
- [ ] Document status correctly reflects registration checklist
- [ ] Grade progression validation works (no grade skipping)
- [ ] Duplicate enrollment prevention works

### Edge Cases
- [ ] No active school year configured
- [ ] Student has multiple registrations (only approved one shows)
- [ ] Old student has no next grade level (Grade 12 → Graduate)
- [ ] Old student was cancelled last year (should NOT auto-appear)
- [ ] Transferee without previous school name
- [ ] Section assignment optional but works when provided
- [ ] Concurrent enrollments by two registrars (race condition)

### UI/UX Tests
- [ ] Tabs load quickly (< 500ms)
- [ ] Drawer opens smoothly
- [ ] Drawer shows loading state while fetching data
- [ ] Confirmation button disabled during submission
- [ ] Success message shows after confirmation
- [ ] Student disappears from "Ready" tab after confirmation
- [ ] Student appears in "Pending" tab after confirmation
- [ ] Tab badge counts update in real-time
- [ ] Mobile responsive layout works

---

## Performance Considerations

### Query Optimization
- Index on `enrollments.schoolYearId` + `enrollments.status`
- Index on `registrations.schoolYearId` + `registrations.status`
- Paginate large enrollment lists (100+ students)
- Cache "Ready to Enroll" count for dashboard

### Expected Load
- Peak: Start of school year (1000+ students in 2-week period)
- Registrars: 3-5 concurrent users
- Enrollments per day: 50-100 during peak

### Response Time Targets
- Ready to Enroll query: < 500ms
- Confirmation action: < 1000ms
- Drawer open: < 300ms

---

## Security & Audit

### RBAC Enforcement
- `enrollments:view` - View enrollment queue
- `enrollments:confirm` - Confirm enrollments
- `enrollments:manual_override` - Access manual entry form

### Audit Logging
Every confirmation must log:
- Actor (registrar user ID + role)
- Student ID + name
- Enrollment type (new/transferee/old)
- Registration ID (if applicable)
- Previous enrollment ID (if old student)
- Grade level enrolled
- Timestamp
- IP address

---

## Success Metrics

### Before (Form-First)
- Average time to create enrollment: **3-5 minutes**
- Data entry errors: **~10%** (wrong grade, duplicate enrollments)
- Registrar confusion: High (must search, remember students)

### After (List-First)
- Average time to confirm enrollment: **< 30 seconds**
- Data entry errors: **< 2%** (pre-filled from registration/previous enrollment)
- Registrar satisfaction: High (clear queue, one-click confirm)

### KPIs
- **Time savings:** 80% reduction in enrollment processing time
- **Error reduction:** 80% fewer data entry mistakes
- **User satisfaction:** 9/10 registrar approval rating
- **Enrollment completion rate:** 95%+ of eligible students enrolled within 2 weeks

---

## Open Questions & Decisions Needed

1. **Old Student Balance Blocking:**
   - just show warning and allow (recommended)?

2. **Manual Override Access:**
   - Admin only
   
3. **Section Assignment Timing:**
   - At enrollment confirmation - optional
   - later in separate workflow

4. **Grade 12 Graduates:**
   - separate alumni workflow

5. **Mid-Year Transfers:**
   - Use manual entry form or separate workflow
   - or same process as transferee

6. **Bulk Actions:**
   - Should registrar be able to confirm multiple students at once?
   - (Recommendation: No - review each student individually for accuracy)

---

## Approval & Sign-Off

- [ ] Product Owner reviewed and approved
- [ ] Technical Lead reviewed and approved
- [ ] Database migrations prepared
- [ ] Rollback plan documented
- [ ] User training materials prepared
- [ ] Support team notified

---

**End of Revision Plan**
