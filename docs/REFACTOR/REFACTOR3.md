You are a Senior Software Architect, Senior Full-Stack Engineer, and Accounting Systems Engineer.

Refactor the existing SRAMS core business logic into a production-ready, maintainable, modular architecture.

Core modules to refactor:

- Registration
- Enrollment
- Assessment
- Payments
- Discounts
- Payment Reversal
- Official Receipt / OR Void

The goal is not just to “clean code.” The goal is to create a stable business engine that can survive future changes without turning into spaghetti.

---

## 1. First, analyze the existing codebase

Before changing anything:

1. Inspect the current folder structure.
2. Identify where the current business logic lives:
   - pages
   - components
   - server actions
   - queries
   - database schema
   - validation files
   - utility files
3. Identify duplicated logic.
4. Identify mixed responsibilities.
5. Identify risky business logic:
   - direct payment deduction
   - assessment mutation
   - discount application
   - OR generation
   - reversal
   - voiding
   - status changes
6. Identify missing validations, missing transactions, and possible data corruption risks.

After analysis, create a short implementation plan before coding.

---
3. Core design rules

Follow these rules strictly:

Pages must stay thin.
Pages should only compose UI and call feature components.
No business logic inside pages.
Components must stay dumb when possible.
Components should not decide payment rules, assessment rules, discount rules, or enrollment status rules.
Business decisions belong in service files.
Server Actions should be orchestration only.
Validate input.
Check permission.
Call service.
Return typed result.
Do not place heavy business logic directly inside Server Actions.
Services contain business logic.
Assessment creation
Enrollment status transition
Payment posting
Discount application
Reversal
OR voiding
Queries only fetch data.
No mutation logic inside query files.
Query files should be reusable by pages, reports, and services.
Use database transactions for all financial operations.
Payment
Assessment creation
Discount posting
Reversal
OR voiding
Never physically delete financial records.
Use status changes.
Use reversal records.
Use void records.
Preserve audit trail.
Money must be handled consistently.
Prefer integer cents/centavos if already supported.
If using decimal, centralize money calculations.
Never calculate money randomly inside components.
Every mutation must have audit fields.
createdBy
updatedBy
voidedBy
reversedBy
reason
timestamps
Standardize comments.
Use comments only when needed.
Maximum 1–2 lines.
Explain “why,” not obvious “what.”
Remove noisy comments.

4. Business rules to enforce
Registration

Rules:

Registration is the base student profile.
Duplicate students should be prevented.
Old students should not need a duplicate registration.
One student can have many enrollments across school years.
Registration should not directly create financial obligations.

Refactor into:

modules/registration/
  services/register-student.service.ts
  services/update-student-profile.service.ts
  queries/get-students.query.ts
  queries/search-students.query.ts
  schemas/registration.schema.ts
  types/registration.types.ts
Enrollment

Rules:

Enrollment connects student + school year + grade level.
A student should not have duplicate active enrollment for the same school year.
Enrollment status flow:
Pending -> Assessed -> Enrolled
Pending -> Cancelled
Assessed -> Cancelled only if no payment exists
Enrolled -> cannot be cancelled directly; must use reversal/refund policy if applicable

Refactor into:

modules/enrollment/
  services/create-enrollment.service.ts
  services/update-enrollment-status.service.ts
  services/cancel-enrollment.service.ts
  queries/get-enrollments.query.ts
  schemas/enrollment.schema.ts
  constants/enrollment-status.constants.ts

Use centralized status transition validation.

Assessment

Rules:

Assessment creates the student’s payable obligations.
Assessment lines should be based on selected fee items.
Manual amount override is allowed only if the system currently supports it.
Assessment should become immutable once payment exists.
If additional fees are needed after assessment, use supplemental assessment lines.
Do not overwrite old assessment lines silently.
Assessment status should be clear:
Draft if still being prepared
Posted/Assessed when ready for payment
Partially Paid
Paid
Cancelled/Reversed if applicable

Refactor into:

modules/assessment/
  services/create-assessment.service.ts
  services/post-assessment.service.ts
  services/add-supplemental-fee.service.ts
  services/recalculate-assessment-balance.service.ts
  queries/get-assessment.query.ts
  queries/get-assessment-lines.query.ts
  schemas/assessment.schema.ts
  constants/assessment-status.constants.ts

Important:

Assessment total = sum of active assessment lines.
Balance = total charges - discounts - payments + reversals.
Do not rely only on frontend calculation.
Payments

Rules:

Payment is a direct deduction from the total balance.
Payment is not allocated per fee item unless the existing system already requires it.
Payment must generate or connect to an Official Receipt.
Payment must be posted inside a database transaction.
Payment cannot exceed current balance unless overpayment is explicitly supported.
Payment must update assessment/enrollment status correctly.

Refactor into:

modules/payments/
  services/post-payment.service.ts
  services/validate-payment.service.ts
  services/recalculate-payment-summary.service.ts
  queries/get-payments.query.ts
  schemas/payment.schema.ts
  constants/payment-method.constants.ts

Payment posting must do this atomically:

Validate student enrollment.
Validate assessment exists.
Validate amount.
Create payment record.
Create OR record or attach OR number.
Update assessment balance/status.
Update enrollment status if fully paid.
Write audit log.
Discounts

Rules:

Discount reduces the amount collectible.
Discount must be traceable.
Discount must have a reason/type.
Discount cannot be silently edited after payment unless allowed by reversal policy.
Discount must affect balance calculation.
Discount should be posted like a financial transaction, not just a random field.

Refactor into:

modules/discounts/
  services/apply-discount.service.ts
  services/remove-discount.service.ts
  services/validate-discount.service.ts
  queries/get-discounts.query.ts
  schemas/discount.schema.ts
  constants/discount-type.constants.ts

Discount posting must do this atomically:

Validate assessment.
Validate discount amount or percentage.
Create discount record.
Recalculate balance.
Write audit log.
Payment Reversal

Rules:

Reversal does not delete the original payment.
Reversal creates a reversing entry.
Reversal must require a reason.
Reversal must reference the original payment.
Reversal must update assessment balance.
Reversal may change enrollment status from Enrolled back to Assessed/Partially Paid depending on remaining balance.
Reversal must not reuse or delete the original OR.

Refactor into:

modules/reversals/
  services/reverse-payment.service.ts
  services/validate-reversal.service.ts
  queries/get-reversals.query.ts
  schemas/reversal.schema.ts
  constants/reversal-reason.constants.ts

Reversal posting must do this atomically:

Validate original payment exists.
Validate payment is not already reversed.
Validate OR is not voided incorrectly.
Create reversal record.
Mark original payment as reversed or partially reversed if supported.
Recalculate assessment balance.
Update enrollment/assessment status.
Write audit log.
OR Void

Rules:

Voiding an OR is different from reversing a payment.
OR void means the official receipt is invalidated.
OR void must require a reason.
OR void must preserve the OR number.
Voided OR numbers must never be reused.
If the OR has an attached payment, the system must either:
require payment reversal first, or
perform OR void + payment reversal inside one controlled transaction.
Choose the safer approach based on current system design.

Refactor into:

modules/official-receipts/
  services/generate-or.service.ts
  services/void-or.service.ts
  services/validate-or.service.ts
  queries/get-official-receipts.query.ts
  schemas/official-receipt.schema.ts
  constants/or-status.constants.ts

OR statuses:

Issued
Voided
Cancelled
Replaced

Void OR transaction must do this:

Validate OR exists.
Validate OR is not already voided.
Validate permission.
Require void reason.
Mark OR as voided.
Preserve OR number.
Create audit log.
If linked to payment, apply the project’s reversal policy safely.
5. Generic reusable components

Create reusable UI components where practical.

Examples:

shared/components/forms/
  MoneyInput.tsx
  DateInput.tsx
  SelectField.tsx
  TextAreaField.tsx

shared/components/tables/
  DataTable.tsx
  TableSearch.tsx
  TablePagination.tsx
  TableStatusFilter.tsx

shared/components/dialogs/
  ConfirmActionDialog.tsx
  ReasonDialog.tsx
  VoidDialog.tsx
  ReversalDialog.tsx

shared/components/status-badges/
  EnrollmentStatusBadge.tsx
  AssessmentStatusBadge.tsx
  PaymentStatusBadge.tsx
  ORStatusBadge.tsx

Rules:

Avoid duplicate table/filter/dialog components.
Keep shared components generic.
Keep business-specific labels/configs inside feature modules.
Do not create over-engineered abstractions.
6. Generic reusable business utilities

Create shared utility files for common business rules:

shared/money/
  calculate-balance.ts
  format-money.ts
  parse-money.ts
  validate-money.ts

shared/audit/
  create-audit-log.ts
  audit-event-types.ts

shared/errors/
  app-error.ts
  action-result.ts

shared/utils/
  assert.ts
  date-utils.ts

Create a consistent action result pattern:

type ActionResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

Use this pattern for all Server Actions.

7. Validation

Use the project’s existing validation library if already installed.

If Zod is already used, standardize with Zod.

Each module should have schemas:

create-registration.schema.ts
create-enrollment.schema.ts
create-assessment.schema.ts
post-payment.schema.ts
apply-discount.schema.ts
reverse-payment.schema.ts
void-or.schema.ts

Validation must happen before mutation.

Do not trust frontend input.

8. Database and transaction rules

Inspect the existing ORM first.

If using Drizzle, use Drizzle transaction patterns.

If using Prisma, use Prisma transaction patterns.

If using raw SQL, use safe parameterized queries.

Financial mutations must use transactions:

assessment creation
payment posting
discount application
payment reversal
OR void

Never split financial updates across separate independent calls.

9. Status calculation rules

Centralize status calculation.

Create services/utilities similar to:

modules/assessment/services/calculate-assessment-status.service.ts
modules/enrollment/services/calculate-enrollment-status.service.ts
modules/payments/services/calculate-payment-status.service.ts

Avoid random status updates scattered across the codebase.

Bad:

if (balance === 0) status = "Enrolled";

Good:

const nextStatus = calculateEnrollmentStatus({
  currentStatus,
  assessmentBalance,
  hasPostedAssessment,
  hasPayment,
});
10. Audit log requirement

Every critical action must write an audit log:

student registered
enrollment created
enrollment cancelled
assessment created
assessment posted
supplemental fee added
payment posted
discount applied
payment reversed
OR generated
OR voided

Audit log should include:

actorId
action
entityType
entityId
beforeValue if useful
afterValue if useful
reason if applicable
timestamp
11. Security and permission checks

Add or standardize permission checks for:

registration:create
registration:update

enrollment:create
enrollment:cancel

assessment:create
assessment:update
assessment:post

payment:create
payment:reverse

discount:apply
discount:remove

or:create
or:void

Do not allow unauthorized users to perform financial operations.

Server-side permission check is required.

Frontend hiding is not security.

12. Error handling

Standardize errors.

Avoid raw thrown strings.

Create/use:

AppError
ValidationError
PermissionError
NotFoundError
ConflictError
BusinessRuleError

Server Actions should return clean user-facing errors.

Logs may contain technical details, but UI errors should be safe and readable.

13. Comment standard

Clean comments across the refactored modules.

Rules:

Use 1–2 line comments only when needed.
Explain business reason, not obvious code.
No paragraph comments unless necessary.
Remove outdated comments.
Remove commented-out dead code.

Good:

// Payments are posted against total balance, not individual fee items.

Bad:

// This function creates a payment by calling the database and then updates the status.
14. Testing requirement

Add or prepare tests for critical services.

Minimum test coverage should include:

Registration:
- prevents duplicate student

Enrollment:
- prevents duplicate enrollment in same school year
- allows Pending -> Assessed
- prevents invalid status transition

Assessment:
- creates assessment lines correctly
- recalculates total correctly
- prevents unsafe edits after payment

Payments:
- prevents overpayment
- posts payment and updates balance
- marks enrollment as Enrolled when fully paid

Discounts:
- applies discount correctly
- prevents invalid discount amount

Reversal:
- reverses payment without deleting original payment
- updates balance correctly
- prevents double reversal

OR Void:
- voids OR without reusing OR number
- requires reason
- prevents double void

Use the existing testing setup if available.

If no testing setup exists, recommend one before adding heavy test infrastructure.

15. Refactoring sequence

Perform the refactor in this order:

Phase 1: Safety audit
Locate all business logic.
Locate all payment/assessment/status mutation code.
Identify risk areas.
Report findings.
Phase 2: Create shared foundations
ActionResult
AppError
money utilities
audit helper
permission helper
status constants
Phase 3: Refactor Registration and Enrollment
Move logic into modules.
Centralize validation.
Centralize status transition rules.
Phase 4: Refactor Assessment
Move assessment creation/posting logic into service.
Centralize assessment balance calculation.
Protect assessment records after payment.
Phase 5: Refactor Payments
Move payment posting into transaction-safe service.
Centralize balance update.
Connect OR generation safely.
Phase 6: Refactor Discounts
Move discount rules into service.
Make discount traceable and auditable.
Phase 7: Refactor Reversal and OR Void
Implement reversal as a safe financial transaction.
Implement OR void rules.
Preserve audit trail.
Phase 8: Refactor UI components
Extract reusable tables, dialogs, filters, money inputs, and status badges.
Remove duplicate components.
Keep feature-specific UI inside modules.
Phase 9: Tests and final verification
Add service-level tests.
Run typecheck.
Run lint.
Run build.
Fix errors.
Report final changes.
16. Important restrictions

Do not do the following:

Do not delete financial records.
Do not silently overwrite assessment/payment/discount records.
Do not skip database transactions for financial operations.
Do not put business logic inside UI components.
Do not create duplicate pages for Admin/Registrar/Cashier if the same feature can be role-controlled.
Do not create over-complicated abstractions.
Do not break existing routes unless necessary.
Do not perform destructive schema migration without explaining the risk first.
Do not change business behavior without documenting it.
17. Expected final output

After implementation, provide a final report with:

1. Summary of refactor completed
2. Files created
3. Files modified
4. Business logic moved
5. Reusable components created
6. Financial safety improvements
7. Permission/security improvements
8. Tests added or recommended
9. Remaining risks
10. Next recommended refactor
18. Acceptance criteria

The refactor is successful only if:

Registration logic is modular.
Enrollment status logic is centralized.
Assessment creation and balance calculation are centralized.
Payment posting is transaction-safe.
Discounts are traceable.
Reversals do not delete original payments.
OR void preserves OR numbers.
Audit logs exist for critical actions.
Server Actions are thin.
UI components are reusable.
Comments are standardized to 1–2 lines where useful.
Code passes typecheck, lint, and build.
The system is easier to maintain for future modules.

Begin by analyzing the existing codebase and presenting the refactor plan before making code changes.
