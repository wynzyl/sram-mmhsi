# SRAMS Audited Discount Report

**System:** School Registration and Accounts Monitoring System (SRAMS)
**Report Date:** 2026-05-25
**Report Type:** Technical Implementation & Process Flow Documentation
**Version:** 1.0

---

## Executive Summary

The SRAMS discount system provides a comprehensive framework for managing student fee reductions with full audit trail capabilities. The system supports multiple discount types, a multi-stage approval workflow, and maintains complete accountability through snapshot storage and double-entry accounting principles.

---

## 1. System Architecture Overview

### 1.1 Database Schema Structure

The discount system comprises three core tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `discountTypes` | Reusable discount definitions | code, calculationType, baseType, defaultValue, isStackable |
| `discountRequests` | Approval workflow records | status, baseAmount, calculatedAmount, overrideValue |
| `studentDiscounts` | Applied discounts (audit snapshots) | All config fields snapshotted, reversal tracking |

### 1.2 Enumeration Types

**Calculation Types:**
- `fixed_amount` — Fixed peso reduction (e.g., ₱5,000 off)
- `percentage` — Percentage-based reduction (e.g., 15% off)

**Base Types:**
- `tuition_only` — Discount applies only to tuition line items
- `full_assessment` — Discount applies to all non-discount fees

**Request Status:**
- `pending` → `approved` → (applied to assessment)
- `pending` → `rejected`
- `pending`/`approved` → `cancelled`
- `approved` (applied) → `reversed`

---

## 2. Process Flow

### 2.1 Pre-Assessment Path (Enrollment Still Pending)

```
┌────────────────────────────────────────────────────────────────┐
│  REGISTRAR                           FINANCE OFFICER           │
├────────────────────────────────────────────────────────────────┤
│  1. Create discount request          2. Review request         │
│     → Status: PENDING                    → Approve/Reject      │
│     → enrollment.hasDiscountsPending     → Optional override   │
│                                                                │
│  3. Create assessment                                          │
│     → Auto-applies approved discounts                          │
│     → Creates student_discounts record                         │
│     → Creates negative assessment item                         │
│     → Recalculates totals                                      │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Post-Assessment Path (Assessment Already Exists)

```
┌────────────────────────────────────────────────────────────────┐
│  REGISTRAR                           FINANCE OFFICER           │
├────────────────────────────────────────────────────────────────┤
│  1. Request discount                 2. Review & approve       │
│     → Validation gate check              → Status: APPROVED    │
│     → Status: PENDING                                          │
│                                      3. Apply to assessment    │
│                                         → Creates records      │
│                                         → Recalculates totals  │
│                                                                │
│                                      4. (Optional) Reverse     │
│                                         → Creates counter entry│
│                                         → Status: REVERSED     │
│                                                                │
│  5. (Optional) Re-request                                      │
│     → Allowed after reversal                                   │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 Validation Gates

| Validation | Rule | Error Handling |
|------------|------|----------------|
| Duplicate Request | Only one pending/approved request per enrollment + type | Blocked with message |
| Discount Type Active | Discount type must be active | Blocked |
| Payment Lock | Cannot apply/reverse if live payment exists | LIFO reversal required |
| Assessment Transfer | Cannot modify if assessment transferred to new SY | Blocked |
| Enrollment Status | Pre-assessment path requires pending enrollment | Gate validation |

---

## 3. Calculation Logic

### 3.1 Base Amount Calculation

```typescript
// Tuition Only: Sum of items where feeItemTypeCode === 'TUITION'
// Full Assessment: Sum of all non-discount fee items

calculateDiscountBase(assessmentItems, baseType) → number
```

### 3.2 Discount Amount Calculation

```typescript
// Percentage: (baseAmount × discountValue) / 100, capped at 100%
// Fixed Amount: discountValue, capped at baseAmount

calculateDiscountAmount(baseAmount, calculationType, value) → number
```

### 3.3 Stacking Rules

- Multiple discount types can apply to the same assessment
- Each discount calculates independently against the original base
- Discounts are additive, not cumulative (cascading)
- `isStackable` field exists for future enforcement

---

## 4. Audit Controls

### 4.1 Snapshot Storage

When a discount is applied, the following fields are captured in `studentDiscounts`:

| Field | Purpose |
|-------|---------|
| `discountTypeCode` | Original discount type code |
| `discountTypeName` | Original discount type name |
| `calculationType` | Calculation method at time of application |
| `baseType` | Base type at time of application |
| `baseAmount` | Computed base amount |
| `discountValue` | Value used (may be override) |
| `discountAmount` | Final calculated discount |

**Rationale:** If discount type configuration changes later, historical records maintain accurate audit trail.

### 4.2 Reversal Tracking

| Field | Purpose |
|-------|---------|
| `reversedAt` | Timestamp of reversal |
| `reversedBy` | User who performed reversal |
| `reversalRemarks` | Required explanation |
| `reversalDiscountId` | Self-reference to counter entry |
| `replacedByRequestId` | Links to replacement request (if any) |

### 4.3 Double-Entry Accounting Principle

When reversing a discount:
1. Original discount record marked as reversed (NOT deleted)
2. Counter entry created with negated amount (positive value)
3. Reversal assessment item created (positive amount)
4. Assessment totals recalculated to reflect reversal

**Result:** Complete audit trail preserved; ledger remains balanced.

### 4.4 Audit Log Entries

All discount operations generate audit log entries:

| Action | Logged Data |
|--------|-------------|
| Create Discount Type | Code, name, calculation type, base type |
| Update Discount Type | Before/after values |
| Delete Discount Type | Soft delete timestamp |
| Create Request | Student ref, enrollment ID, discount type |
| Approve Request | Decision remarks, override value (if any) |
| Reject Request | Decision remarks |
| Apply Discount | Assessment ID, calculated amounts |
| Reverse Discount | Reversal remarks, counter entry ID |

---

## 5. Role-Based Access Control

### 5.1 Permission Matrix

| Permission | Admin | Finance Officer | Registrar | Student/Parent |
|------------|-------|-----------------|-----------|----------------|
| `discounts:read` | ✓ | ✓ | ✓ | ✓ (own only) |
| `discounts:request` | ✓ | | ✓ | |
| `discounts:review` | ✓ | ✓ | | |
| `discounts:manage` | ✓ | ✓ | | |
| `discounts:apply` | ✓ | ✓ | | |

### 5.2 Enforcement Levels

1. **Route Guard:** `proxy.ts` validates role before page access
2. **Server Action Validation:** `hasPermission()` check at action start
3. **Audit Logging:** All operations logged with actor information

---

## 6. Technical Implementation Details

### 6.1 File Locations

```
src/features/discounts/
├── discounts.actions.ts      # Server actions (1569 lines)
├── discounts.queries.ts      # Database queries
├── discounts.schema.ts       # Zod validators (257 lines)
├── utils/
│   └── discount-calculations.ts  # Calculation utilities (211 lines)
└── components/
    ├── DiscountTypesTable.tsx
    ├── DiscountRequestsTable.tsx
    ├── DiscountRequestForm.tsx
    ├── EnrollmentDiscountsSection.tsx
    ├── StudentDiscountsList.tsx
    ├── DiscountTypeFormModal.tsx
    └── DiscountReversalModal.tsx
```

### 6.2 Key Server Actions

| Action | Purpose | Permissions |
|--------|---------|-------------|
| `createDiscountTypeAction` | Create discount type definition | `discounts:manage` |
| `updateDiscountTypeAction` | Update discount type | `discounts:manage` |
| `deleteDiscountTypeAction` | Soft delete discount type | `discounts:manage` |
| `createDiscountRequestAction` | Request discount for student | `discounts:request` |
| `approveDiscountRequestAction` | Approve pending request | `discounts:review` |
| `rejectDiscountRequestAction` | Reject pending request | `discounts:review` |
| `bulkApproveDiscountsAction` | Batch approve requests | `discounts:review` |
| `cancelDiscountRequestAction` | Cancel request | `discounts:request` |
| `reverseDiscountAction` | Reverse applied discount | `discounts:apply` |
| `applyApprovedDiscountToExistingAssessment` | Apply approved discount | `discounts:apply` |
| `applyApprovedDiscountsToAssessment` | Auto-apply during assessment creation | Internal |

### 6.3 Database Indexes

**Performance Indexes:**
- `idx_discount_requests_status_pending` — Partial index for pending queue
- `idx_student_discounts_active` — Partial index where `reversedAt IS NULL`
- `idx_discount_types_display_order` — UI sorting optimization

**Unique Constraints:**
- `discountTypes.code` (excluding deleted records)
- `discountRequests(enrollment_id, discount_type_id)` where status IN ('pending', 'approved')

---

## 7. UI/UX Flow

### 7.1 Finance Officer Portal

**Route:** `/staff/finance/discount-types`
- Create, edit, delete discount type definitions
- Configure calculation type, base type, default values

**Route:** `/staff/finance/discount-requests`
- Three tabs: Pending | Approved | Rejected
- Pending tab: Approve/reject individual or bulk
- Approved tab: Shows "ready to apply" section
- Action buttons for apply to assessment, reverse

### 7.2 Registrar Portal

- Integrated in enrollment detail pages
- `EnrollmentDiscountsSection` component
- Request new discounts
- View approved/applied discounts

### 7.3 Student/Parent Portal

- View-only access to applied discounts
- Displayed in assessment breakdown

---

## 8. Database Migrations

| Migration | Description |
|-----------|-------------|
| `0007_add_discount_system.sql` | Core tables and assessment fields |
| `0008_add_student_discount_index.sql` | Performance indexing |
| `0009_discount_reversal_status_and_replacement_link.sql` | Reversal tracking |

---

## 9. Current Limitations

1. **No Automatic Recalculation:** If discount type defaults change, existing approved requests retain original values
2. **Documentation Enforcement:** `requiresDocumentation` field exists but not enforced in UI
3. **Reversal Finality:** Reversed discounts cannot be un-reversed (only re-requested)
4. **Stacking Logic:** `isStackable` field exists but not enforced; all discounts currently stackable

---

## 10. Compliance Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Audit trail for all discount operations | ✓ | Audit log entries |
| Immutable historical records | ✓ | Snapshot storage in `studentDiscounts` |
| Role-based access control | ✓ | 3-level enforcement |
| Approval workflow | ✓ | Request → Review → Apply flow |
| Reversal accountability | ✓ | Required remarks, counter entries |
| Soft delete only | ✓ | `deletedAt` fields on all tables |
| Double-entry accounting | ✓ | Reversal creates offsetting entries |

---

## 11. Recommendations for Future Enhancement

1. **Documentation Upload:** Implement file attachment for discount requests requiring documentation
2. **Stacking Rules Engine:** Build business rules for which discount types can stack
3. **Automatic Recalculation:** Option to recalculate discounts when base amounts change
4. **Discount Expiration:** Add validity period to discount types
5. **Approval Delegation:** Allow finance officers to delegate approval authority
6. **Report Generation:** Build comprehensive discount reports by school year, grade level, type

---

## Appendix A: Sample Discount Scenarios

### Scenario 1: Sibling Discount (Percentage)
- **Type:** SIBLING_DISCOUNT
- **Calculation:** Percentage (10%)
- **Base:** Tuition Only
- **Result:** 10% reduction on tuition amount only

### Scenario 2: Early Bird Discount (Fixed)
- **Type:** EARLY_BIRD
- **Calculation:** Fixed Amount (₱5,000)
- **Base:** Full Assessment
- **Result:** ₱5,000 flat reduction

### Scenario 3: Scholar Discount (Full)
- **Type:** FULL_SCHOLARSHIP
- **Calculation:** Percentage (100%)
- **Base:** Full Assessment
- **Result:** 100% tuition waiver

---

**Report Prepared By:** System Documentation
**Reviewed By:** [Pending Review]
**Classification:** Internal Use Only
