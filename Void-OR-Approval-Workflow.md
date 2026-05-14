# Void-OR Approval Workflow (with Reversal-Entry Ledger Model)

## Context

Today, anyone with `payments:void` (cashier, registrar, admin, super_admin) can void a payment directly from the payments history table — a single confirm step immediately marks the payment/OR as voided, **mutates the original row's status, and reverts `assessment.balance` in place** (`src/features/payments/payments.actions.ts:363-475`).

Two things change:

1. **Governance** — voiding an Official Receipt now requires admin approval. Non-negotiable, no self-approval, no escape hatch.
2. **Accounting model** — instead of mutating the original payment, an approved void posts a **negative reversal entry** of the same amount to the ledger. The original payment row keeps its amount and OR; both entries stay visible. Net effect on the assessment balance is zero, but history is preserved.

## Locked Decisions

| # | Decision |
|---|---|
| 1 | **Approvers:** `super_admin` + `admin` |
| 2 | **Requesters:** `cashier` + `registrar` + `admin` + `super_admin` |
| 3 | **Pending state:** payment stays `posted`, balance untouched; a `void_requests` row tracks the workflow |
| 4 | **Lifecycle:** pending → approved \| rejected \| cancelled. Rejection requires a reason. |
| 5 | **Admin UI:** new `/staff/void-requests` page with Pending / History tabs |
| 6 | **Self-approval:** strictly blocked even for super_admin |
| 7 | **Requester cancel:** allowed while pending |
| 8 | **Direct void removed entirely** |
| 9 | **Original row preserved:** on approval, original payment gets `status='reversed'`. Amount and OR are NOT touched. |
| 10 | **Reversal entry:** a new row in `payments` with `amount = -original.amount`, `kind='reversal'`, `orNumber=NULL`, `orStatus=NULL`, `reversesPaymentId=original.id`. Does NOT consume an OR from the booklet. |

---

## Accounting Model — Reversal Entry

```
ORIGINAL                           REVERSAL (posted on approval)
─────────────────────────────────  ───────────────────────────────
amount      +5,000.00              amount      -5,000.00
orNumber    AP-00012               orNumber    NULL
orStatus    consumed               orStatus    NULL
status      reversed   ◄── flipped status      reversal
kind        payment                kind        reversal
                                   reversesPaymentId → original.id
                                   referenceNumber  REV-AP-00012
                                   paymentDate      <approval timestamp>

Both rows appear in the ledger. Net effect on assessment.balance = 0.
```

**Why this matters:** Auditors see both the original receipt and the reversing entry, exactly as a manual journal would. Nothing is ever silently erased.

---

## Architecture

### Lifecycle

```
[requester clicks Request Void + reason]
        │
        ▼
  void_requests row created (status="pending")
  payment.status stays "posted"  ◄── balance untouched
        │
   ┌────┴────┬─────────────┐
   ▼         ▼             ▼
[admin    [admin        [requester
 approves] rejects+      cancels]
   │       reason]          │
   ▼         │              ▼
RUN executePaymentReversal status="cancelled"
in same tx:                  (payment untouched)
 - lock original payment
 - flip original.status → "reversed"
   set reversedAt/reversedBy/reversedByRequestId
 - INSERT new payment row (kind=reversal, negative amount)
 - update assessment totals (totalPaid -= amount, balance += amount)
 - recompute billingStatus
 - audit: payment_reversed
   │         │
   ▼         ▼
status="approved"   status="rejected"
decidedBy/At        decidedBy/At
                    decisionRemarks
```

### Schema changes — `src/lib/db/schema.ts`

**1. New enum and table for the workflow**

```ts
export const voidRequestStatusEnum = pgEnum("void_request_status", [
  "pending", "approved", "rejected", "cancelled",
]);

export const voidRequests = pgTable("void_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  assessmentId: uuid("assessment_id").references(() => assessments.id),
  requestedBy: uuid("requested_by").notNull().references(() => users.id),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  requestReason: text("request_reason").notNull(),
  status: voidRequestStatusEnum("status").notNull().default("pending"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at"),
  decisionRemarks: text("decision_remarks"),
  cancelledAt: timestamp("cancelled_at"),
  /** The reversal payment row created when status becomes 'approved'. */
  reversalPaymentId: uuid("reversal_payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  // At most ONE active pending request per payment.
  oneActivePerPayment: uniqueIndex("uq_void_requests_active_payment")
    .on(t.paymentId).where(sql`status = 'pending'`),
}));
```

**2. Modifications to `payments`**

```ts
// New enum value(s) on paymentStatusEnum:
//   add "reversed"  → original payment that has been offset by a reversal entry
//   add "reversal"  → the negative reversal entry itself
// Legacy "voided" value is retained for old records (read-compat) but is no longer written by new code.
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending_confirmation", "posted", "voided", "reversed", "reversal",
]);

// New kind enum:
export const paymentKindEnum = pgEnum("payment_kind", ["payment", "reversal"]);

// New columns on payments table:
kind:                paymentKindEnum("kind").notNull().default("payment"),
reversesPaymentId:   uuid("reverses_payment_id").references(() => payments.id),  // set on reversal rows
reversedAt:          timestamp("reversed_at"),                                    // set on original row
reversedBy:          uuid("reversed_by").references(() => users.id),
reversedByRequestId: uuid("reversed_by_request_id").references(() => voidRequests.id),

// orNumber and orStatus must become NULLABLE (reversal rows carry no OR).
// Existing rows are unaffected; new column nullability is a backwards-compatible change.
```

**Existing unique index on `orNumber`:** PostgreSQL unique indexes already treat NULLs as non-conflicting, so reversal rows with `orNumber=NULL` won't violate it. No index change needed — but **verify** the current definition in `src/lib/db/schema.ts` doesn't use `NULLS NOT DISTINCT` (introduced in PG15+) before relying on this.

### Permission model — `src/lib/rbac/permissions.ts`

- **Remove** `payments:void` from all roles.
- **Add** `payments:void_request` → `cashier`, `registrar`, `admin`, `super_admin`.
- **Add** `payments:void_approve` → `admin`, `super_admin`.

### Server actions — `src/features/payments/void-requests.actions.ts` (new)

1. **`requestVoidAction({ paymentId, requestReason })`**
   - Permission: `payments:void_request`.
   - Verify the payment exists, `kind === 'payment'` (you can't void a reversal row), and `status === 'posted'`.
   - Block if `assessment.transferredAt != null`.
   - Block if a pending request already exists (partial unique idx + explicit check for friendlier error).
   - Insert `void_requests` row. Audit: `void_request_created`.

2. **`approveVoidRequestAction({ requestId })`**
   - Permission: `payments:void_approve`.
   - In `db.transaction`:
     - `SELECT ... FOR UPDATE` on `void_requests` row; assert `status === 'pending'`.
     - **Self-approval guard:** `if (request.requestedBy === session.userId) throw`.
     - Lock original payment (`FOR UPDATE`); re-check `status === 'posted'`, `kind === 'payment'`, `assessment.transferredAt == null`.
     - Call new helper `executePaymentReversal(tx, { originalPaymentId, requestId, actorId, actorRole })` — see below.
     - Update `void_requests` → `status='approved'`, `decidedBy`, `decidedAt`, `reversalPaymentId = <id of inserted reversal row>`.
     - Audit: `void_request_approved` (correlationId = requestId).

3. **`rejectVoidRequestAction({ requestId, decisionRemarks })`**
   - Permission: `payments:void_approve`. Self-approval guard applies.
   - `decisionRemarks` Zod min 3.
   - Update row → `status='rejected'`. Payment untouched. Audit: `void_request_rejected`.

4. **`cancelVoidRequestAction({ requestId })`**
   - Permission: `payments:void_request`.
   - Require `request.requestedBy === session.userId` AND `status === 'pending'`.
   - Update → `status='cancelled'`, `cancelledAt=now()`. Audit: `void_request_cancelled`.

All four return `BaseFormState`.

### New helper — `executePaymentReversal(tx, args)`

Replaces the old direct-void logic. Lives in `src/features/payments/payments.actions.ts` (or a sibling `payments.internal.ts`). NOT exported as a server action.

```ts
async function executePaymentReversal(
  tx: DbTx,
  args: {
    originalPaymentId: string;
    requestId: string;
    actorId: string;
    actorRole: Role;
  }
): Promise<{ reversalPaymentId: string }> {
  // 1. Lock + read original (already locked by caller, but defensive re-read).
  // 2. Flip original payment:
  //      status = "reversed"
  //      reversedAt = now()
  //      reversedBy = actorId
  //      reversedByRequestId = requestId
  //      updatedBy / updatedAt = ...
  //    DO NOT modify amount, orNumber, or orStatus.
  // 3. Insert reversal row:
  //      assessmentId          = original.assessmentId
  //      amount                = negate(original.amount)            // store as negative numeric
  //      paymentMethod         = original.paymentMethod             // mirror for traceability
  //      paymentDate           = now()
  //      orNumber              = NULL
  //      orStatus              = NULL
  //      bookletId             = NULL                               // does not consume booklet
  //      kind                  = "reversal"
  //      status                = "reversal"
  //      reversesPaymentId     = original.id
  //      reversedByRequestId   = requestId
  //      referenceNumber       = `REV-${original.orNumber ?? original.id.slice(0,8)}`
  //      processedBy           = actorId
  //      createdBy / updatedBy = actorId
  // 4. Update assessment totals (same net effect as today):
  //      totalPaid -= original.amount
  //      balance   += original.amount
  //      billingStatus = assessmentBillingStatusFromState({ balance, cancelledAt })
  // 5. Audit: action="payment_reversed", targetEntity="payments",
  //          targetId=original.id, correlationId=requestId,
  //          context={ originalAmount, reversalPaymentId, reason: request.requestReason }
  // 6. Return { reversalPaymentId }
}
```

**Important — leave the booklet alone.** The original OR was physically issued; we do not return its number to the booklet pool, do not decrement `nextNumber`, do not change the booklet's `status`. The original `orStatus='consumed'` stays. This matches the physical reality of an issued-then-reversed receipt.

### Delete the old direct-void path

- Remove the exported `voidPaymentAction` from `src/features/payments/payments.actions.ts`.
- Remove its import in `PaymentsHistoryTable.tsx` (rewritten below).
- The only caller is `PaymentsHistoryTable`; grep confirmed.

### Queries & ledger display

- `src/features/payments/payments.queries.ts` (existing): update ledger-fetching queries to return both `payment` and `reversal` rows. Reversal rows should display:
  - amount in red / negative styling
  - status badge "REVERSAL" (with a tooltip pointing to the original OR)
  - link back to the original payment row
- Original-row display: when `status='reversed'`, render a "REVERSED" badge alongside the OR; on hover/click show the linked reversal row + the approving admin.
- **Balance summary on assessment page**: already uses `assessment.balance` (stored), which the reversal helper keeps correct — no change.

### UI

**`PaymentsHistoryTable.tsx`**
- Props change: replace `canVoid` with `canRequestVoid: boolean` + `pendingVoidByPaymentId: Record<string, { requestId: string; canCancel: boolean }>`.
- For each row, branch on `kind`:
  - `payment` + `status='posted'` + no pending request → show **"Request Void"** button (if `canRequestVoid`).
  - `payment` + pending request → show "Void pending approval" badge + Cancel button (if `pendingVoidByPaymentId[id].canCancel`).
  - `payment` + `status='reversed'` → show "REVERSED" badge linking to reversal row.
  - `kind='reversal'` → render with negative amount styling, "REVERSAL" badge, no actions.
  - legacy `status='voided'` (historical rows pre-change) → render as today.

**New page `src/app/staff/void-requests/page.tsx`**
- Server component guarded by `hasPermission(role, 'payments:void_approve')` → redirect if no permission.
- Tabs via `?tab=pending|history` (server search param, no client state).
- **Pending tab** — columns: requested at, requester, student (assessment), OR #, amount, reason, **Actions: Approve / Reject inline forms**. Approve/Reject buttons hidden when `request.requestedBy === session.userId` (UI mirror of the server guard).
- **History tab** — `status IN ('approved','rejected','cancelled')`, newest first, paginated. Columns: decided at, requester, decider, OR #, amount, status badge, remarks, link to reversal row (if approved).
- Server fetch via new `src/features/payments/void-requests.queries.ts`:
  - `listPendingVoidRequests()`
  - `listVoidRequestHistory({ limit, offset })`

**Staff sidebar**
- Add "Void Requests" nav entry gated on `payments:void_approve`. Find the existing staff layout/sidebar (likely under `src/app/staff/layout.tsx` or `src/components/layout/*`) and follow that pattern.

**Ledger page** — `src/app/page-templates/assessments/assessment-ledger-page.tsx`
- Swap `canVoid = hasPermission(role, 'payments:void')` for `canRequestVoid = hasPermission(role, 'payments:void_request')`.
- Fetch pending void requests for payments shown and pass `pendingVoidByPaymentId`.

### Validators — `src/features/payments/void-requests.schema.ts`

- `RequestVoidSchema = z.object({ paymentId: z.uuid(), requestReason: z.string().trim().min(3) })`
- `ApproveVoidRequestSchema = z.object({ requestId: z.uuid() })`
- `RejectVoidRequestSchema = z.object({ requestId: z.uuid(), decisionRemarks: z.string().trim().min(3) })`
- `CancelVoidRequestSchema = z.object({ requestId: z.uuid() })`
- Form-state types extend `BaseFormState` from `src/lib/validators/common-schemas.ts`.

### Audit actions added

- `void_request_created`
- `void_request_approved`
- `void_request_rejected`
- `void_request_cancelled`
- `payment_reversed` (replaces today's `payment_voided` in the approval flow)

---

## Files to Create

| Path | Purpose |
|---|---|
| `src/features/payments/void-requests.actions.ts` | 4 server actions |
| `src/features/payments/void-requests.schema.ts` | Zod + form-state types |
| `src/features/payments/void-requests.queries.ts` | Pending + history queries |
| `src/features/payments/components/VoidRequestsTable.tsx` | Renders pending/history with inline forms |
| `src/app/staff/void-requests/page.tsx` | Admin inbox page with `?tab=` |
| `drizzle/NNNN_add_void_requests_and_reversal.sql` | Migration via `npm run db:generate --name=add_void_requests_and_reversal` |

## Files to Modify

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Add `voidRequestStatusEnum`, `voidRequests` table; add `paymentKindEnum`; extend `paymentStatusEnum` with `reversed` + `reversal`; add `kind`, `reversesPaymentId`, `reversedAt`, `reversedBy`, `reversedByRequestId` columns on payments; make `orNumber`, `orStatus`, `bookletId` nullable for reversal rows |
| `src/lib/rbac/permissions.ts` | Drop `payments:void`; add `payments:void_request`, `payments:void_approve` |
| `src/features/payments/payments.actions.ts` | Add `executePaymentReversal(tx, …)` helper; **delete** exported `voidPaymentAction` |
| `src/features/payments/payments.queries.ts` | Include reversal rows in ledger queries; expose `kind`, `reversesPaymentId` for UI |
| `src/features/payments/components/PaymentsHistoryTable.tsx` | New props + branched rendering per `kind`/`status`; submit `requestVoidAction` / `cancelVoidRequestAction` |
| `src/app/page-templates/assessments/assessment-ledger-page.tsx` | Use new permission; fetch + pass `pendingVoidByPaymentId` |
| Staff sidebar/nav (locate during impl) | Add "Void Requests" entry gated on `payments:void_approve` |

## Reusable Utilities (do not reinvent)

- `logAudit` — `src/lib/utils/audit-logger.ts`
- `assessmentBillingStatusFromState` — `src/lib/utils/assessment-billing.ts`
- `BaseFormState` + common Zod schemas — `src/lib/validators/common-schemas.ts`
- `FormStateAlert`, `TextInputField` — `src/components/forms/*`
- `InlineConfirmButton` — `src/components/shared/ConfirmActionButton.tsx` (for Approve / Reject / Cancel)
- `DataTable`, `Badge`, `ReferenceCode`, `CurrencyDisplay` — existing shared components
- `requireSession`, `hasPermission` — auth + RBAC

---

## Edge Cases & Guards

1. **Concurrent double-approve:** `FOR UPDATE` on `void_requests` row + recheck `status='pending'` inside tx.
2. **Original payment voided/reversed between request and approval:** approval rechecks `status='posted'` and `kind='payment'`; if not, fail with a clear message. Stale request stays pending and must be cancelled or rejected explicitly — no magic auto-close.
3. **Transferred assessment after request was filed:** re-check `transferred_at` inside approval tx — same guard as today.
4. **Self-approval:** enforced in both `approveVoidRequestAction` AND `rejectVoidRequestAction` — a requester cannot resolve their own request either way.
5. **Reversing a reversal:** disallowed — `requestVoidAction` blocks `kind='reversal'` rows up front.
6. **Partial unique index** on `void_requests(paymentId) WHERE status='pending'` guarantees only one pending request per payment, even under race.
7. **Booklet untouched:** reversal does not call any booklet update path. The original `orStatus` stays `consumed`. Booklet `nextNumber` and `status` are not modified.
8. **CurrencyDisplay** must handle negative amounts gracefully (verify during impl; render `-₱5,000.00` style).
9. **Sum-based assertions** in tests: after approval, `SUM(payments.amount) WHERE assessmentId=X AND status IN ('posted','reversal')` should equal `assessment.totalPaid`.

---

## Verification

### Migration
```bash
npm run db:generate --name=add_void_requests_and_reversal
# review drizzle/NNNN_add_void_requests_and_reversal.sql
npm run db:migrate
```

### Manual end-to-end (dev server)
1. `npm run dev`. Log in as **cashier**, post a +5,000 payment (OR AP-00012).
2. Confirm old "Void" button is gone; **"Request Void"** is present on the posted row.
3. Click → enter reason → submit. Verify:
   - `void_requests` row created, status=`pending`.
   - Original payment row unchanged (still `status='posted'`, amount +5,000, OR AP-00012).
   - Assessment balance unchanged.
   - UI shows "Void pending approval" badge + Cancel button on the row.
4. As same cashier, click Cancel → request status `cancelled`. Badge clears.
5. Re-request. Log in as **admin** (different user).
6. Visit `/staff/void-requests` → Pending tab → see the request.
7. Click **Reject** with remarks → status `rejected`. Payment + balance untouched. History tab shows the rejection.
8. Re-request. As admin click **Approve**. Verify:
   - `void_requests` → `status='approved'`, `decidedBy/At`, `reversalPaymentId` populated.
   - Original payment row: `status='reversed'`, `reversedAt/By/ByRequestId` populated; **amount still +5,000, orNumber still AP-00012, orStatus still 'consumed'**.
   - A new payment row exists: `kind='reversal'`, `status='reversal'`, `amount=-5,000`, `orNumber=NULL`, `orStatus=NULL`, `bookletId=NULL`, `reversesPaymentId=<original.id>`, `referenceNumber='REV-AP-00012'`.
   - Assessment: `totalPaid` decreased by 5,000, `balance` increased by 5,000, `billingStatus` recomputed.
   - Audit log contains `void_request_approved` AND `payment_reversed`.
   - **Booklet untouched:** `nextNumber` and `status` unchanged.
9. Ledger UI: both the original (with REVERSED badge) and the reversal (with REVERSAL badge, negative amount) appear in the payments history. Net visible effect = 0.
10. **Self-approval test:** as admin, file a request from your own account → try to approve from same account → must be rejected with clear "cannot approve your own request" error. Same for reject.
11. **RBAC test:** as finance_officer (no `payments:void_request`) → Request Void button absent; direct POST returns permission denied. As cashier visiting `/staff/void-requests` → redirect / 403.
12. **Cannot void a reversal:** try `requestVoidAction` with a reversal row's id → rejected with clear error.

### Unit tests (Vitest)
- Zod schemas: valid/invalid inputs for each of the 4 schemas.
- Helper `executePaymentReversal` against a test DB: original-unchanged invariant, reversal-row-correct invariant, balance math correct, booklet-untouched invariant.

### Build
```bash
npm run lint
npm run build
npm run test
```
