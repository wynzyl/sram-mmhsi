# Clearance Feature Extension: Adviser Approval + Portal View

## Overview

Extend the existing clearance feature to add:
1. **Adviser approval workflow** — Advisers review and batch-approve clearances for their section
2. **Portal clearance view** — Students see their clearance status in the portal

## Current State

- `student_clearances` table exists with `status`: `pending`, `cleared`, `waived`
- Batch EOY generation creates clearances based on financial balance
- No adviser involvement — clearances go directly to `cleared` if balance is zero
- No portal view for students

## Design Decisions

| Decision | Choice |
|----------|--------|
| Issuance trigger | **Auto-issue** if zero balance + no academic issues; **Adviser approval** required if failing/incomplete grades |
| Obligations checked | Financial + Academic standing (system checks both) |
| Portal display | Status card only (no PDF certificate) |
| Adviser view | Section roster showing students needing approval (academic issues) |
| Generation trigger | Keep admin-triggered batch generation |
| Academic discretion | Adviser can approve students with failing/incomplete grades (their decision) |

---

## Implementation Plan

### Phase 1: Schema & Backend Changes

#### 1.1 Add Adviser Approval Fields to Clearances

**File:** `src/lib/db/schema.ts`

Add to `studentClearances` table:
```typescript
// New fields for adviser approval workflow
adviserApprovedAt: timestamp("adviser_approved_at"),
adviserApprovedBy: uuid("adviser_approved_by").references(() => users.id),
adviserRemarks: text("adviser_remarks"),  // For noting why approved despite academic issues

// Track why clearance is pending (for filtering/display)
requiresAdviserApproval: boolean("requires_adviser_approval").default(false),
hasFailingGrades: boolean("has_failing_grades").default(false),
hasIncompleteGrades: boolean("has_incomplete_grades").default(false),
```

**Migration:** `add_clearance_adviser_approval_fields`

#### 1.2 Update Clearance Status Flow

Current flow:
- Balance = 0 → `cleared` immediately
- Balance > 0 → `pending`

New flow (with academic check):
- Balance = 0 + grades complete (all ≥75) → **`cleared` automatically** (system-issued)
- Balance = 0 + failing/incomplete grades → **`pending`** (needs adviser approval)
- Balance > 0 → **`pending`** (needs payment first, then auto-check or adviser approval)
- Adviser approves pending → `cleared` (with `adviserApprovedBy` + `adviserApprovedAt`)
- Finance waives → `waived`

**File:** `src/features/clearances/clearances.actions.ts`

Modify `batchGenerateEOYClearancesAction`:
- Check each student's grade status during generation
- Auto-clear if: zero balance AND all grades ≥75 AND no missing grades
- Set pending if: positive balance OR failing grades OR incomplete grades
- Add `sectionId` to clearance record (for adviser filtering)
- Add `requiresAdviserApproval: boolean` field to track why pending

#### 1.3 Add Section Reference to Clearances

**File:** `src/lib/db/schema.ts`

Add to `studentClearances`:
```typescript
sectionId: uuid("section_id").references(() => sections.id),
```

This enables querying clearances by adviser's sections.

---

### Phase 2: Adviser Clearance UI

#### 2.1 Adviser Clearances Dashboard

**Route:** `/staff/clearances/adviser`

**File:** `src/app/staff/clearances/adviser/page.tsx`

- Shows sections where user is adviser (like grades dashboard)
- Each section card shows:
  - Section name
  - Total students
  - **Auto-cleared count** (zero balance + passing grades)
  - **Needs approval count** (failing/incomplete grades awaiting adviser decision)
  - **Pending payment count** (positive balance)
- Badge indicator if section has students needing adviser approval
- Click section → goes to section clearance detail

#### 2.2 Section Clearance Detail Page

**Route:** `/staff/clearances/adviser/sections/[sectionId]`

**File:** `src/app/staff/clearances/adviser/sections/[sectionId]/page.tsx`

**Tab-based view:**

**Tab 1: "Needs Approval" (default)**
- Shows only students with `requiresAdviserApproval = true` (failing/incomplete grades)
- Table columns:
  - Student name + reference
  - **Grade issues** (e.g., "2 failing, 1 incomplete")
  - Clearance status (Pending)
- Checkbox selection for batch approval
- **"Approve Selected" button** — adviser confirms they reviewed and approve despite academic issues
- Approval requires remarks (reason for clearing despite issues)
- **Grade detail expansion** — click row to see subject-by-subject breakdown

**Tab 2: "Auto-Cleared"**
- Shows students who were automatically cleared (zero balance + passing complete grades)
- Read-only view for adviser reference
- Columns: Student name, Cleared date

**Tab 3: "Pending Payment"**
- Shows students with positive balance (cannot be cleared yet)
- Read-only — adviser cannot approve until balance is settled
- Columns: Student name, Outstanding balance

**Tab 4: "All Students"**
- Full roster view for reference
- Shows all statuses in one table

#### 2.3 Adviser Approval Action

**File:** `src/features/clearances/clearances.actions.ts`

New action: `adviserApproveClearancesAction`
```typescript
Input: {
  clearanceIds: string[],
  remarks?: string  // Optional: adviser notes (required if approving with academic issues)
}
Validation:
  - User must be adviser for all clearances' sections
  - All clearances must be pending
  - All clearances must have zero outstanding balance (financial settled)
  - Academic status NOT validated (adviser discretion)
Effect:
  - Set status = 'cleared'
  - Set adviserApprovedBy = session.userId
  - Set adviserApprovedAt = now()
  - Store remarks if provided
Audit:
  - Log approval with academic status snapshot (for accountability)
```

#### 2.4 Grade Status Query

**File:** `src/features/clearances/clearances.queries.ts`

New query: `getStudentGradeStatusForClearance(studentId, schoolYearId)`
```typescript
Returns:
  - totalSubjects: number
  - gradedSubjects: number (subjects with at least one grade)
  - failingSubjects: string[] (subjects with final grade < 75)
  - incompleteSubjects: string[] (subjects with missing quarter grades)
  - status: 'complete' | 'failing' | 'incomplete'
```

This query checks `gradeSheetEntries` or `gradeRecords` for the student's enrollment.

#### 2.5 Queries for Adviser Clearances

**File:** `src/features/clearances/clearances.queries.ts`

New queries:
- `getAdviserClearanceSections(userId, schoolYearId)` — sections with clearance counts
- `getSectionClearancesWithGrades(sectionId, schoolYearId)` — all students in section with:
  - Clearance status
  - Outstanding balance
  - Grade status summary (complete/failing/incomplete + counts)

---

### Phase 3: Portal Clearance View

#### 3.1 Portal Clearances Page

**Route:** `/portal/clearances`

**File:** `src/app/portal/clearances/page.tsx`

- Shows clearance history across school years
- Current year clearance prominently displayed
- Status display with reason:
  - **Cleared** (green):
    - Auto-cleared: "Cleared on [Date]" (no adviser shown)
    - Adviser-approved: "Approved by [Adviser Name] on [Date]"
  - **Pending** (yellow): Shows specific reason:
    - "Outstanding Balance: ₱X,XXX" (if balance > 0)
    - "Awaiting Adviser Review" (if academic issues, balance = 0)
  - **Waived** (gray): "Waived by [Finance Officer] on [Date]"

#### 3.2 Portal Clearance Query

**File:** `src/features/clearances/clearances.queries.ts`

New query: `getStudentClearancesForPortal(studentId)`
- Returns clearances with school year label, status, adviser name if approved

#### 3.3 Dashboard Integration

**File:** `src/app/portal/dashboard/page.tsx`

Add clearance status card to dashboard:
- Shows current school year clearance status
- Link to `/portal/clearances` for full history

#### 3.4 Navigation Updates

**File:** `src/components/layout/sidebar-nav.ts`

Add to student/parent portal navigation:
```typescript
{ href: "/portal/clearances", label: "Clearances", icon: "clearances" }
```

Add to teacher/adviser staff navigation (under Grades or new Clearances section):
```typescript
{ href: "/staff/clearances/adviser", label: "Section Clearances", icon: "clearances" }
```

---

### Phase 4: Permission Updates

#### 4.1 New Permissions

**File:** `src/lib/rbac/permissions.ts`

Add permissions:
- `clearances:adviser_approve` — For advisers to approve their section's clearances

Role assignments:
- `teacher` role gets `clearances:adviser_approve` (since advisers are teachers)
- `principal` role gets `clearances:adviser_approve` (can approve any section)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add `adviserApprovedAt`, `adviserApprovedBy`, `sectionId` to clearances |
| `src/features/clearances/clearances.schema.ts` | Add adviser approval schema |
| `src/features/clearances/clearances.actions.ts` | Modify batch generation, add adviser approval action |
| `src/features/clearances/clearances.queries.ts` | Add adviser/portal queries |
| `src/lib/rbac/permissions.ts` | Add `clearances:adviser_approve` permission |
| `src/components/layout/sidebar-nav.ts` | Add portal clearances nav item |

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/staff/clearances/adviser/page.tsx` | Adviser clearances dashboard |
| `src/app/staff/clearances/adviser/sections/[sectionId]/page.tsx` | Section clearance detail |
| `src/features/clearances/components/AdviserClearanceTable.tsx` | Batch approval table |
| `src/features/clearances/components/AdviserSectionCards.tsx` | Section overview cards |
| `src/app/portal/clearances/page.tsx` | Portal clearances page |
| `src/features/clearances/components/PortalClearanceCard.tsx` | Portal status card |
| `drizzle/XXXX_add_clearance_adviser_fields.sql` | Migration |

---

## Verification Plan

1. **Schema migration:** Run `npm run db:generate` and `npm run db:migrate`
2. **Batch generation scenarios:**
   - ✅ Zero balance + all grades ≥75 + no missing → **auto-cleared** (no adviser needed)
   - ⏳ Zero balance + failing grade(s) → **pending** (needs adviser approval)
   - ⏳ Zero balance + incomplete grade(s) → **pending** (needs adviser approval)
   - ⏳ Positive balance (any grades) → **pending** (awaiting payment)
3. **Adviser dashboard:** Shows sections with "Needs Approval" badge count
4. **Adviser approval scenarios:**
   - ✅ Students with failing grades → adviser can approve with remarks
   - ✅ Students with incomplete grades → adviser can approve with remarks
   - ❌ Students with positive balance → cannot approve (payment required first)
5. **Portal view:**
   - Cleared student sees: "Cleared" with date
   - Pending (payment) student sees: "Pending: Outstanding Balance ₱X,XXX"
   - Pending (academic) student sees: "Pending: Awaiting Adviser Review"
6. **Permission check:** Non-adviser cannot access adviser clearance pages
7. **Audit:** All approval actions logged with actor, timestamp, academic issues, and remarks

---

## Out of Scope

- PDF certificate generation (can be added later)
- Multi-department clearances (library, guidance, etc.)
- Automatic generation on school year close
- Email notifications on clearance status change
