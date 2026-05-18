# Void-OR Approval Workflow Implementation Plan

## Overview

Replace direct payment voiding with an approval-based workflow using reversal accounting entries. Cashiers/registrars request voids; admins approve. Original payments are preserved with offsetting reversal entries.

---

## Phase 1: Schema Changes

### Files to Modify

- `src/lib/db/schema.ts`

### Changes

**1.1 Add new enums (after line ~55):**

```typescript
export const voidRequestStatusEnum = pgEnum("void_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const paymentKindEnum = pgEnum("payment_kind", ["payment", "reversal"]);
```

**1.2 Extend `paymentStatusEnum` (line 50-54):**

```typescript
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending_confirmation",
  "posted",
  "voided", // Keep for backward compatibility
  "reversed", // NEW: Original payment reversed via approval
  "reversal", // NEW: Offsetting negative entry
]);
```

**1.3 Add `void_requests` table (after receiptBooklets):**

```typescript
export const voidRequests = pgTable(
  "void_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    requestReason: text("request_reason").notNull(),
    status: voidRequestStatusEnum("status").notNull().default("pending"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at"),
    decisionRemarks: text("decision_remarks"),
    cancelledAt: timestamp("cancelled_at"),
    reversalPaymentId: uuid("reversal_payment_id").references(
      () => payments.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("void_requests_payment_pending_uidx")
      .on(t.paymentId)
      .where(sql`${t.status} = 'pending'`),
    index("void_requests_status_idx").on(t.status),
    index("void_requests_payment_idx").on(t.paymentId),
    index("void_requests_requested_by_idx").on(t.requestedBy),
  ],
);
```

**1.4 Modify `payments` table (lines 628-667):**

- Change `bookletId` from `.notNull()` to nullable
- Change `orNumber` from `.notNull()` to nullable
- Add new columns:

```typescript
kind: paymentKindEnum("kind").notNull().default("payment"),
reversesPaymentId: uuid("reverses_payment_id").references(() => payments.id),
reversedAt: timestamp("reversed_at"),
reversedBy: uuid("reversed_by").references(() => users.id),
reversedByRequestId: uuid("reversed_by_request_id").references(() => voidRequests.id),
```

- Update unique index for `orNumber` to be partial (WHERE orNumber IS NOT NULL)
- Add index on `reversesPaymentId`

**1.5 Add Drizzle relations for voidRequests**

---

## Phase 2: Permission Changes

### Files to Modify

- `src/lib/rbac/permissions.ts`

### Changes

**2.1 Update Permission type (lines 34-37):**

```typescript
// Remove: | "payments:void"
// Add:
| "payments:void_request"   // Request a void (cashier, registrar, admin, super_admin)
| "payments:void_approve"   // Approve/reject requests (admin, super_admin only)
```

**2.2 Update PERMISSIONS map:**

- `super_admin`: Replace `payments:void` with `payments:void_request`, `payments:void_approve`
- `admin`: Replace `payments:void` with `payments:void_request`, `payments:void_approve`
- `registrar`: Replace `payments:void` with `payments:void_request` (no approve)
- `cashier`: Replace `payments:void` with `payments:void_request` (no approve)

---

## Phase 3: Server Actions

### Files to Create

- `src/features/payments/void-requests.schema.ts`
- `src/features/payments/void-requests.actions.ts`

### Files to Modify

- `src/features/payments/payments.actions.ts` (add helper, deprecate voidPaymentAction)

### void-requests.schema.ts

```typescript
export const RequestVoidSchema = z.object({
  paymentId: z.string().uuid(),
  requestReason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters"),
});

export const ApproveVoidRequestSchema = z.object({
  requestId: z.string().uuid(),
});
export const RejectVoidRequestSchema = z.object({
  requestId: z.string().uuid(),
  decisionRemarks: z.string().trim().min(3),
});
export const CancelVoidRequestSchema = z.object({
  requestId: z.string().uuid(),
});
```

### void-requests.actions.ts

**Actions:**

1. `requestVoidAction({ paymentId, requestReason })` - Permission: `payments:void_request`
2. `approveVoidRequestAction({ requestId })` - Permission: `payments:void_approve`
3. `rejectVoidRequestAction({ requestId, decisionRemarks })` - Permission: `payments:void_approve`
4. `cancelVoidRequestAction({ requestId })` - Permission: `payments:void_request`

### executePaymentReversal helper (in payments.actions.ts)

```typescript
async function executePaymentReversal(
  tx: DbTx,
  args: {
    originalPayment: Payment;
    requestId: string;
    actorId: string;
    actorRole: string;
  },
): Promise<{ reversalPaymentId: string }>;
```

**Steps:**

1. Update original payment: `status='reversed'`, set reversedAt/By/ByRequestId
2. Insert reversal row: `kind='reversal'`, `status='reversal'`, `amount=-original.amount`, `orNumber=NULL`, `bookletId=NULL`, `reversesPaymentId=original.id`, `referenceNumber='REV-{original.orNumber}'`
3. Update assessment: `totalPaid -= amount`, `balance += amount`, recompute `billingStatus`
4. Log audit: `payment_reversed`
5. DO NOT modify booklet

---

## Phase 4: Queries

### Files to Create

- `src/features/payments/void-requests.queries.ts`

### Queries

```typescript
export async function listPendingVoidRequests(): Promise<PendingVoidRequest[]>;
export async function listVoidRequestHistory(opts: {
  limit: number;
  offset: number;
}): Promise<VoidRequestHistoryRow[]>;
export async function getPendingVoidRequestsForPayments(
  paymentIds: string[],
): Promise<Map<string, VoidRequestSummary>>;
```

---

## Phase 5: UI Components

### Files to Modify

- `src/features/payments/components/PaymentsHistoryTable.tsx`
- `src/features/payments/components/AssessmentLedgerRegister.tsx`

### Files to Create

- `src/features/payments/components/VoidRequestsQueueTabs.tsx`
- `src/features/payments/components/VoidRequestsPendingTable.tsx`
- `src/features/payments/components/VoidRequestsHistoryTable.tsx`
- `src/features/payments/components/RequestVoidDialog.tsx`

### PaymentsHistoryTable Changes

**Props interface:**

```typescript
interface PaymentsHistoryTableProps {
  payments: Payment[]; // Add kind, reversesPaymentId fields
  canRequestVoid: boolean; // NEW (replaces canVoid)
  pendingVoidByPaymentId: Record<
    string,
    { requestId: string; requestedBy: string }
  >; // NEW
  currentUserId: string; // NEW - for cancel button visibility
  embedded?: boolean;
}
```

**Row rendering logic:**

- `kind='payment'` + `status='posted'` + no pending request → "Request Void" button
- `kind='payment'` + pending request → "Pending Approval" badge + Cancel button (if user is requester)
- `kind='payment'` + `status='reversed'` → "REVERSED" badge (link to reversal)
- `kind='reversal'` → Negative amount styling, "REVERSAL" badge
- Legacy `status='voided'` → Render as today (backward compat)

### New Components

**VoidRequestsPendingTable:**

- Columns: OR Number, Amount, Student, Reason, Requested By, Requested At, Actions
- Actions column: Approve / Reject buttons (with reason dialog for reject)
- Hide approve/reject for rows where `requestedBy === currentUserId` (self-approval block UI)

**VoidRequestsHistoryTable:**

- Columns: OR Number, Amount, Student, Status, Decided By, Decided At, Remarks

---

## Phase 6: Pages & Navigation

### Files to Create

- `src/app/staff/void-requests/page.tsx`

### Files to Modify

- `src/components/layout/sidebar-nav.ts`
- `src/app/page-templates/assessments/assessment-ledger-page.tsx`

### /staff/void-requests page

```typescript
// Server component
// Permission guard: payments:void_approve → redirect if no permission
// Tabs via ?tab=pending|history (server search param)
// Fetch data via void-requests.queries.ts
```

### Sidebar Navigation

Add to `admin` config (in Finance section):

```typescript
{ href: "/staff/void-requests", label: "Void Requests", icon: "payments" }
```

Also add to `super_admin` if applicable.

### Assessment Ledger Page

Update permission check:

```typescript
// Change: const canVoid = hasPermission(session.role, "payments:void");
// To: const canRequestVoid = hasPermission(session.role, "payments:void_request");
```

Fetch pending void requests for displayed payments and pass to component.

---

## Critical Guards (Non-Negotiable)

| Guard                                       | Location                                              | Behavior                                            |
| ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Payment must be `posted` + `kind='payment'` | `requestVoidAction`                                   | Reject with clear message                           |
| No existing pending request for payment     | `requestVoidAction`                                   | Reject (partial unique index enforces DB-level)     |
| Assessment not transferred                  | `requestVoidAction`, `approveVoidRequestAction`       | Check `transferredAt != null`                       |
| Self-approval blocked                       | `approveVoidRequestAction`, `rejectVoidRequestAction` | `if (request.requestedBy === session.userId) throw` |
| Request must be pending                     | All decision actions                                  | Check `status === 'pending'`                        |
| Original requester only can cancel          | `cancelVoidRequestAction`                             | `if (request.requestedBy !== session.userId) throw` |
| Cannot void a reversal row                  | `requestVoidAction`                                   | Check `kind !== 'reversal'`                         |
| Booklet untouched on reversal               | `executePaymentReversal`                              | DO NOT call any booklet update                      |
| Row locking                                 | All transaction actions                               | Use `FOR UPDATE` on void_requests and payments      |

---

## Audit Events

| Event                    | When              | Context                        |
| ------------------------ | ----------------- | ------------------------------ |
| `void_request_created`   | Request submitted | paymentId, orNumber, reason    |
| `void_request_approved`  | Admin approves    | requestId, reversalPaymentId   |
| `void_request_rejected`  | Admin rejects     | requestId, remarks             |
| `void_request_cancelled` | Requester cancels | requestId                      |
| `payment_reversed`       | Reversal executed | originalId, reversalId, amount |

---

## Migration

```bash
npm run db:generate --name=add_void_requests_and_reversal
npm run db:migrate
```

---

## Verification Checklist

### Manual Testing

1. Post payment as cashier → Verify "Request Void" button appears (not "Void")
2. Request void → Verify pending request created, payment unchanged, badge shows
3. Cancel request as same user → Verify request cancelled, can re-request
4. Re-request → As different admin, approve → Verify:
   - Original payment: `status='reversed'`, `reversedAt` populated
   - Reversal row: `kind='reversal'`, negative amount, `orNumber=NULL`
   - Assessment: balance updated correctly
   - Booklet: `nextNumber` unchanged
5. Self-approval test: Request as admin → Try approve as same user → Must fail
6. Permission test: Finance officer cannot request; Cashier cannot approve
7. Transferred assessment: Cannot request void
8. Ledger display: Both original (REVERSED badge) and reversal (negative amount) visible

### Build Verification

```bash
npm run lint
npm run build
npm run test
```

---

## File Summary

### Create (6 files)

| File                                                            | Purpose                   |
| --------------------------------------------------------------- | ------------------------- |
| `src/features/payments/void-requests.schema.ts`                 | Zod schemas for 4 actions |
| `src/features/payments/void-requests.actions.ts`                | Server actions            |
| `src/features/payments/void-requests.queries.ts`                | Query functions           |
| `src/features/payments/components/VoidRequestsPendingTable.tsx` | Pending requests table    |
| `src/features/payments/components/VoidRequestsHistoryTable.tsx` | History table             |
| `src/app/staff/void-requests/page.tsx`                          | Admin inbox page          |

### Modify (7 files)

| File                                                            | Change                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| `src/lib/db/schema.ts`                                          | New enums, void_requests table, payment columns         |
| `src/lib/rbac/permissions.ts`                                   | Replace payments:void with new permissions              |
| `src/features/payments/payments.actions.ts`                     | Add executePaymentReversal, deprecate voidPaymentAction |
| `src/features/payments/components/PaymentsHistoryTable.tsx`     | New props, branched rendering                           |
| `src/features/payments/components/AssessmentLedgerRegister.tsx` | Pass new props                                          |
| `src/app/page-templates/assessments/assessment-ledger-page.tsx` | New permission check, fetch pending                     |
| `src/components/layout/sidebar-nav.ts`                          | Add "Void Requests" nav item                            |
