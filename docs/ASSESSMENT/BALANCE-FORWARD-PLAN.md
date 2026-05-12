# Balance Forward Problem - Accounting Solution Plan

## Problem Statement

**Scenario:** A student has an outstanding balance from a previous enrollment year. When creating the current year's assessment, the system carries forward this balance by adding a "Balance Forward" line item to the new assessment.

**Current Situation:**
- Previous year's assessment still shows the unpaid balance in its ledger
- Current year's assessment includes the forwarded balance as a new line item
- **Risk:** Student appears to owe the amount twice (once in old year, once in new year)

## Current System Behavior (Discovered)

### How Balance Forward Works Today

From `src/features/assessments/assessments.actions.ts:79-118`:

```typescript
// When creating assessment for old_student:
1. Query most recent previous enrollment with outstanding balance
2. If priorEnrollment.balance > 0.01:
   - Create special "Balance Forward from [Year]" line item
   - Add to NEW assessment as a regular assessment_item
   - Uses fee type: BALANCE_FORWARD
```

**Key Architecture Points:**
- Each assessment is **per school year** (scoped to `schoolYearId`)
- Balance fields: `totalAmount`, `totalPaid`, `balance` (all on `assessments` table)
- Balance forward creates a NEW line item in the current year
- Previous year's balance field remains unchanged (still shows outstanding)

### The Double-Count Problem

**Example:**
- **SY 2024-2025:** Student owes ₱5,000, paid ₱0 → balance = ₱5,000
- **SY 2025-2026:** Assessment created with "Balance Forward from 2024-2025: ₱5,000" line item
- **Result:**
  - Old assessment: shows ₱5,000 outstanding
  - New assessment: shows ₱5,000 as part of total
  - **Student effectively charged twice**

## Accounting Best Practice Solution

From a **professional accounting perspective**, balance forwarding should follow these principles:

### Principle 1: Single Source of Truth
The debt exists only ONCE in the books. The current active year should be the only place where the outstanding amount appears.

### Principle 2: Transfer Entry (Not Duplication)
When carrying forward a balance, create a **transfer entry** that:
- **Closes** the previous year's outstanding balance
- **Opens** the current year's balance with the same amount
- Maintains audit trail showing the transfer

### Principle 3: Historical Record Integrity
Previous year's records should reflect what actually happened:
- Amount assessed: [original fees]
- Amount paid: [actual payments received that year]
- Amount transferred forward: [balance at year-end]
- Remaining balance: ₱0 (closed out)

## Proposed Approaches (TBD - Pending User Questions)

### Approach 1: Close Prior Year Balance (Transfer Entry)
- When creating balance forward in new year
- Mark prior assessment as "closed" with transfer entry
- Set prior `balance` to 0
- Add metadata: `transferredToAssessmentId`, `transferredAt`

### Approach 2: Soft Close with Status Flag
- Add `isClosed` flag to assessments table
- When balance forwarded, set `isClosed = true` on prior assessment
- Queries filter out closed assessments when calculating outstanding balances
- Preserves original balance for historical reference

### Approach 3: Virtual Balance Calculation
- Keep all historical balances as-is
- Calculate "active balance" by checking if student has newer enrollment
- Display logic: only show balance on MOST RECENT enrollment
- Reporting adjusts for multi-year students

## Critical Files to Modify

Based on codebase exploration:

1. **`src/features/assessments/assessments.actions.ts`** (lines 79-118)
   - Balance forward creation logic
   - Add transfer entry mechanism

2. **`src/lib/db/schema.ts`** (lines 512-540)
   - Assessments table schema
   - May need: `isClosed`, `transferredToAssessmentId`, `transferredAt` fields

3. **`src/features/payments/payments.actions.ts`** (lines 264-279)
   - Payment posting balance updates
   - Ensure closed assessments cannot receive payments

4. **`src/lib/queries/admin-dashboard.ts`** (lines 146-157)
   - Outstanding receivables calculation
   - Must exclude transferred/closed balances

5. **`src/features/assessments/assessments.queries.ts`**
   - Assessment list queries
   - Filter or mark transferred assessments

## User Requirements (Phase 3 - Answered)

### Business Rules Confirmed

1. ✅ **Prior Year Balance Treatment:** Set to ₱0 and mark as 'Transferred'
   - Previous year balance becomes 0
   - Metadata shows transfer destination and date
   - Old assessment is closed and cannot receive payments

2. ✅ **Payment Blocking:** Block all payments on transferred assessments
   - Once balance is forwarded, old assessment is locked
   - All payments must go to current year
   - Prevents confusion and ensures balance integrity

3. ✅ **Reporting:** Exclude transferred/closed assessments
   - Only count active year balances in dashboard
   - Prevents double-counting
   - Shows true outstanding amount owed

4. ✅ **Multi-Year Debt:** Show each year separately as distinct line items
   - 2025 assessment shows 'Balance Forward 2023: ₱X', 'Balance Forward 2024: ₱Y'
   - Maintains year-by-year audit trail
   - All prior years with outstanding balances are transferred and closed

5. ✅ **Transfer Trigger:** Automatic transfer on assessment creation
   - When finance officer creates assessment for old student
   - System automatically transfers all prior balances and closes prior years
   - One-click workflow

6. ✅ **Void After Transfer:** Block voiding on transferred assessments
   - Once transferred and closed, no modifications allowed
   - If correction needed, handle in current year instead
   - Maintains transfer integrity

7. ✅ **Transfer Reversal:** Yes, admin-only 'Reverse Transfer' action
   - Admins can undo a transfer
   - Re-opens prior year(s), removes balance forward lines from current year
   - Logged in audit trail with full details

## Implementation Plan

### Architecture Overview

**Solution Approach:** Multi-Year Balance Transfer with Automatic Closure

When creating an assessment for a returning student:
1. Query ALL prior year assessments with outstanding balances
2. Create SEPARATE balance forward line items for each prior year
3. Mark each prior assessment as "transferred" (set balance to ₱0, add transfer metadata)
4. Block all future payments and voids on transferred assessments
5. Update dashboard queries to exclude transferred balances from totals
6. Provide admin-only reversal action for error correction

### Database Schema Changes

**New fields on `assessments` table:**
- `transferredAt` (timestamp) - When balance was transferred
- `transferredBy` (uuid) - User who initiated transfer
- `transferredToAssessmentId` (uuid) - Target assessment receiving the balance
- `transferRemarks` (text) - Optional transfer notes

**New field on `assessmentItems` table:**
- `sourceAssessmentId` (uuid) - For balance forward items, links back to source assessment

**Indexes:**
- `assessments_transferred_at_idx` - Performance for active assessment queries
- `assessment_items_source_assessment_idx` - Reverse lookup for transfers

### Critical Files to Modify

#### 1. Schema Migration
**File:** `src/lib/db/schema.ts` (lines 512-560)
- Add 4 new transfer tracking fields to `assessments` table definition
- Add 1 new source linkage field to `assessmentItems` table definition
- Add 2 new indexes for performance optimization

#### 2. Assessment Creation Logic
**File:** `src/features/assessments/assessments.actions.ts` (lines 79-320)
- **Lines 79-118:** Replace single prior year query with multi-year query
- **Lines 219-294:** Update transaction to:
  - Query ALL prior assessments with outstanding balances
  - Create balance forward item for EACH prior year (not summed)
  - Mark each source assessment as transferred (balance = 0)
  - Link balance forward items to source via `sourceAssessmentId`
  - Audit log each transfer operation

#### 3. Payment Blocking
**File:** `src/features/payments/payments.actions.ts`
- **Lines 158-175:** Add validation in `postPaymentAction()` to check `assessment.transferredAt IS NULL`
- **Lines 379-414:** Add same validation in `voidPaymentAction()`
- Throw descriptive error: "PAYMENT_BLOCKED: This assessment was transferred..."

#### 4. Dashboard Queries
**File:** `src/lib/queries/admin-dashboard.ts` (lines 146-180)
- **Outstanding Receivables:** Add `WHERE transferredAt IS NULL` to exclude transferred balances
- **Overdue Accounts:** Add same filter
- Ensures no double-counting in financial reports

#### 5. Assessment List Queries
**File:** `src/features/assessments/assessments.queries.ts` (lines 28-76)
- Add `includeTransferred` parameter (default: false)
- Filter out transferred assessments from default list view
- Add `transferredAt` to SELECT for UI display

#### 6. Admin Reversal Action
**File:** `src/features/assessments/assessments.actions.ts` (new function)
- Create `reverseBalanceTransferAction()` server action
- **Validations:**
  - Only allow if NO payments posted on target assessment
  - Only allow if enrollment status = "assessed" (not "enrolled")
- **Process:**
  - Delete balance forward items from current year
  - Restore prior year assessments (set transferredAt = NULL, restore balance)
  - Recalculate target assessment totals
  - Audit log both restoration and target modification
- **Permission:** `assessments:reverse_transfer` (admin/super_admin only)

#### 7. RBAC Permissions
**File:** `src/lib/rbac/permissions.ts`
- Add new permission: `"assessments:reverse_transfer"`
- Grant to: `super_admin`, `admin`

#### 8. UI Indicators
**File:** `src/app/page-templates/assessments/assessment-ledger-page.tsx`
- Add transfer warning banner when `assessment.transferredAt` is not null
- Show link to current year assessment
- Disable payment posting buttons when transferred
- Pass `transferredAt` to child components

**File:** `src/features/payments/components/AssessmentLedgerRegister.tsx`
- Add "Transferred" badge next to balance forward line items
- Conditionally disable payment form based on `transferredAt` status

### Transaction Flow (Detailed)

```
Assessment Creation for Old Student
  ↓
1. Query ALL prior enrollments with outstanding assessments
   WHERE studentId = X
   AND schoolYearId != currentYear
   AND status = 'enrolled'
   AND transferredAt IS NULL
   AND balance > 0.01
   ORDER BY schoolYear ASC
  ↓
2. For EACH prior assessment:
   - Create balanceForwardItem {
       description: "Balance Forward from [Year]",
       amount: priorAssessment.balance,
       sourceAssessmentId: priorAssessment.id
     }
  ↓
3. BEGIN TRANSACTION
  ↓
4. Validate each prior assessment still untransferred (race condition check)
  ↓
5. INSERT new assessment with computed total (includes balance forwards)
  ↓
6. INSERT assessment items (fee schedule + balance forwards)
   - Link balance forward items via sourceAssessmentId
  ↓
7. For EACH prior assessment:
   - UPDATE SET balance = 0, transferredAt = NOW(), transferredBy = userId, transferredToAssessmentId = newId
   - Audit log: "assessment_balance_transferred"
  ↓
8. UPDATE enrollment status: pending → assessed
  ↓
9. Audit log: "assessment_created_and_enrollment_assessed" with transfer metadata
  ↓
10. COMMIT TRANSACTION
```

### Edge Cases Handled

1. **Multiple years unpaid:** System creates separate line item for each year (e.g., "Balance Forward from 2023-2024: ₱5,000", "Balance Forward from 2024-2025: ₱3,000")

2. **Payment blocking:** Once transferred, any attempt to post/void payment returns clear error message directing user to current year

3. **Concurrent enrollments:** Postgres row-level locking ensures second transaction waits and sees first transfer

4. **Reversal after payment:** Admin reversal validates `totalPaid = 0` before allowing undo

5. **Partial payments before transfer:** Only outstanding `balance` is transferred (not original `totalAmount`)

6. **Year gaps:** Student skips 2024, enrolls 2026 directly from 2023 → 2023 balance transfers to 2026

### Verification Testing

**Manual Test Scenario:**
1. Create Student A with 2023 enrollment → Assessment ₱10,000, paid ₱0
2. Create Student A with 2024 enrollment → Assessment ₱12,000, paid ₱3,000 (balance ₱9,000)
3. Create Student A with 2025 enrollment → Verify:
   - 2025 assessment shows TWO balance forward items:
     - "Balance Forward from 2023-2024: ₱10,000"
     - "Balance Forward from 2024-2025: ₱9,000"
   - 2023 assessment: balance = ₱0, transferredAt = [timestamp]
   - 2024 assessment: balance = ₱0, transferredAt = [timestamp]
4. Attempt to post payment on 2023 → Verify blocked with error message
5. Navigate to 2023 ledger → Verify "Transferred" banner with link to 2025
6. Login as admin → Reverse transfer on 2025 → Verify:
   - 2023 balance restored to ₱10,000
   - 2024 balance restored to ₱9,000
   - 2025 balance forward items removed

**Dashboard Test:**
- Before transfer: Outstanding receivables = ₱10,000 + ₱9,000 + ₱0 = ₱19,000
- After transfer: Outstanding receivables = ₱0 + ₱0 + ₱19,000 = ₱19,000 (no double-count)
- After 2025 payment of ₱5,000: Outstanding receivables = ₱14,000

### Implementation Phases

**Phase 1: Schema & Migration (Day 1)**
- Create migration file with 5 new fields + 2 indexes
- Update Drizzle schema types
- Run migration on dev database
- Verify schema with `npm run db:studio`

**Phase 2: Core Transfer Logic (Days 2-3)**
- Update `assessments.actions.ts` multi-year query
- Implement transaction with transfer marking
- Add audit logging
- Manual test with 2-3 year scenarios

**Phase 3: Payment Blocking (Day 4)**
- Add validation checks in payment actions
- Test payment posting on transferred assessment
- Test void attempt on transferred assessment

**Phase 4: Reporting Updates (Day 5)**
- Update dashboard queries with transfer filters
- Update assessment list queries
- Verify receivables calculations exclude transferred

**Phase 5: Admin Reversal (Days 6-7)**
- Implement reversal action with all validations
- Add RBAC permission
- Create UI button/modal (if needed)
- Test reversal workflow

**Phase 6: UI Polish (Day 8)**
- Add transfer warning banners
- Add balance forward badges
- Test user experience flow

**Phase 7: QA & Documentation (Days 9-10)**
- End-to-end manual testing
- Write unit tests for core logic
- Update user documentation
- Deploy to staging for acceptance testing

**Total Estimate:** 10 development days

### Next Steps

1. ✅ Phase 1 Complete - Understood problem
2. ✅ Phase 2 Complete - Explored codebase
3. ✅ Phase 3 Complete - Clarifying questions answered
4. ✅ Phase 4 Complete - Architecture designed
5. ⏳ Phase 5 Pending - Implementation (awaiting approval)
6. ⏳ Phase 6 Pending - Quality review
7. ⏳ Phase 7 Pending - Summary

---

**Status:** Plan complete. Ready for user approval to begin implementation.
