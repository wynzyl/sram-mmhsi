---
name: enrollment
description: Use when designing, implementing, reviewing, or refactoring the School Registration and Accounts Monitoring enrollment workflow, including student registration, enrollment status transitions, assessment creation, cashier payment processing, ledger updates, OR tracking, and cancellation rules.
---

# Enrollment Workflow Skill

You are working on the School Registration and Accounts Monitoring System for a private K(Casa, Junior Casa, Advance Casa) to Grade 12 school.

This skill defines the strict enrollment workflow, business rules, database expectations, page behavior, and implementation guardrails.

Do not invent a new workflow unless explicitly asked. Follow this state machine.

---

# Core Workflow

## Student Types

The system supports three student types:

1. `NEW_STUDENT`
2. `TRANSFEREE`
3. `OLD_STUDENT`

## Enrollment Statuses

Use these enrollment statuses:

```ts
PENDING
ASSESSED
ENROLLED
CANCELLED
```

Do not use vague status names like:

```ts
ACTIVE
PROCESSING
ONGOING
DONE
APPROVED
```

The enrollment workflow is:

```txt
PENDING → ASSESSED → ENROLLED
PENDING → CANCELLED
ASSESSED → CANCELLED
ENROLLED → CANCELLED
```

Important correction:

```txt
After payment, status changes from ASSESSED → ENROLLED.
Never say PENDING → ENROLLED after payment.
```

---

# Workflow for New Student and Transferee

## Step 1: Capture Basic Information

Page:

```txt
Student Registration / Student Profile Page
```

The registrar captures basic information first.

Required student data should include:

- Student name
- Birthdate
- Gender
- Address
- Contact details
- Guardian / parent details
- Student type
- Previous school, required for transferee
- Required submitted documents

After saving basic information:

```txt
Student record is created.
No enrollment is created yet unless the user proceeds to enrollment.
```

---

## Step 2: Create Enrollment

Page:

```txt
Enrollment Page
```

The registrar searches the student and creates enrollment by selecting:

- School Year
- Grade Level
- Section, optional
- Enrollment Type

After enrollment creation:

```txt
Enrollment Status = PENDING
```

Meaning:

```txt
The student is registered for a specific school year and grade level, but fees are not yet assessed.
```

---

## Step 3: Create Assessment

Page:

```txt
Assessment Page
```

The Assessment Page must display only students/enrollments where:

```txt
Enrollment Status = PENDING
```

The user searches/selects a student and creates an assessment by selecting predefined fees.

Allowed assessment actions:

- Select predefined fee items
- Edit fee amount before finalizing
- Add extra fee if necessary
- Apply discount if applicable
- Save assessment

After assessment creation:

```txt
Enrollment Status = ASSESSED
```

Meaning:

```txt
The student now has payable fees and can proceed to cashier payment.
```

Assessment details must be linked to the selected fee items.

Assessment details are the basis for the student ledger.

---

## Step 4: Process Payment

Page:

```txt
Cashier Page
```

The Cashier Page must display only students/enrollments where:

```txt
Enrollment Status = ASSESSED
```

The cashier searches/selects the student and processes payment.

Supported payment methods:

```ts
CASH
GCASH
BANK_TRANSFER
CHECK
OTHER
```

After successful payment:

```txt
Enrollment Status = ENROLLED
```

Payment must create or update:

- Payment transaction
- Payment allocation
- Student ledger entry
- Official receipt / OR tracking record
- Enrollment status

Important:

```txt
Do not allow payment if enrollment status is not ASSESSED.
```

---

## Step 5: Cancel Enrollment

Page:

```txt
Enrollment Page
```

Cancellation is manual.

The Enrollment Page must display all enrollments with their statuses.

The user selects an enrollment and clicks Cancel.

Cancellation requires:

- Cancellation reason
- Cancelled by
- Cancelled at
- Previous enrollment status

After cancellation:

```txt
Enrollment Status = CANCELLED
```

Never hard-delete cancelled enrollment records.

---

# Workflow for Old Student

Old students already have existing student records.

Do not force old students through basic registration again.

## Step 1: Create Enrollment

Page:

```txt
Enrollment Page
```

The registrar searches the existing student and creates enrollment by selecting:

- School Year
- Grade Level
- Section, optional
- Enrollment Type = OLD_STUDENT

After enrollment creation:

```txt
Enrollment Status = PENDING
```

---

## Step 2: Create Assessment

Page:

```txt
Assessment Page
```

Display only:

```txt
Enrollment Status = PENDING
```

After assessment creation:

```txt
Enrollment Status = ASSESSED
```

---

## Step 3: Process Payment

Page:

```txt
Cashier Page
```

Display only:

```txt
Enrollment Status = ASSESSED
```

After valid payment:

```txt
Enrollment Status = ENROLLED
```

---

## Step 4: Cancel Enrollment

Same cancellation rules as new students and transferees.

After cancellation:

```txt
Enrollment Status = CANCELLED
```

---

# Required Pages and Responsibilities

## Student Page

Purpose:

```txt
Manage student master records.
```

Allowed actions:

- Add new student
- Add transferee
- Edit student information
- View student profile
- View enrollment history
- View account ledger

The Student Page should not directly mark students as enrolled.

---

## Enrollment Page

Purpose:

```txt
Create and manage school-year-based enrollment.
```

Allowed actions:

- Search student
- Create enrollment
- Select school year
- Select grade level
- Assign section, optional
- View enrollment status
- Cancel enrollment

The Enrollment Page is the only normal page for manual cancellation.

---

## Assessment Page

Purpose:

```txt
Create payable fees for Pending enrollments.
```

Display rule:

```txt
Show only enrollments with status PENDING.
```

Allowed actions:

- Create assessment
- Select predefined fee items
- Edit fee amounts
- Add custom fee if allowed
- Apply discounts if allowed
- Save assessment

After successful assessment:

```txt
Update enrollment status to ASSESSED.
```

---

## Cashier Page

Purpose:

```txt
Accept and record payments.
```

Display rule:

```txt
Show only enrollments with status ASSESSED.
```

Allowed actions:

- Process payment
- Select payment method
- Generate official receipt / OR
- Allocate payment to fees
- Update student ledger
- Mark enrollment as ENROLLED when payment rule is satisfied

After valid payment:

```txt
Update enrollment status to ENROLLED.
```

---

# Required Database Tables

Implement or verify these core tables.

## `students`

Stores master student information.

Must not be school-year-specific.

## `school_years`

Stores school year records.

Example:

```txt
2026-2027
```

## `grade_levels`

Stores grade levels.

Examples:

```txt

Junior Casa
Senior Casa
Advance Casa
Grade 1
Grade 2
...
Grade 12
```

## `enrollments`

Stores school-year-based enrollment.

Required fields:

```ts
id
studentId
schoolYearId
gradeLevelId
sectionId?
studentType
status
createdAt
updatedAt
cancelledAt?
cancelledById?
cancellationReason?
```

Recommended unique rule:

```txt
One active enrollment per student per school year.
```

Cancelled enrollments may exist historically, but do not allow duplicate active enrollments.

## `fee_items`

Lookup table for predefined fees.

Examples:

```txt
Tuition Fee
Miscellaneous Fee
Books
Uniform
Laboratory Fee
Registration Fee
ESC Discount
Other Fee
```

## `assessments`

Assessment header.

Required fields:

```ts
id
enrollmentId
studentId
schoolYearId
status
totalAmount
createdById
createdAt
updatedAt
```

## `assessment_details`

Assessment line items.

Required fields:

```ts
id
assessmentId
feeItemId
description
amount
quantity
discountAmount?
netAmount
```

Each selected fee item must create one assessment detail.

## `payments`

Payment transaction header.

Required fields:

```ts
id
studentId
enrollmentId
assessmentId
paymentDate
paymentMethod
amountPaid
referenceNumber?
receivedById
createdAt
```

## `payment_allocations`

Links payments to assessment details.

Required fields:

```ts
id
paymentId
assessmentDetailId
amountApplied
createdAt
```

## `student_ledgers`

Ledger-first accounting record.

Required fields:

```ts
id
studentId
enrollmentId
assessmentId?
paymentId?
entryType
debit
credit
balanceAfter
description
createdAt
createdById
```

Use this for account history.

Do not rely only on payment totals.

## `official_receipts`

Tracks OR numbers.

Required fields:

```ts
id
paymentId
orNumber
issuedAt
issuedById
status
voidReason?
voidedAt?
voidedById?
```

OR numbers must be unique.

## `enrollment_cancellations`

Optional but recommended for audit.

Required fields:

```ts
id
enrollmentId
previousStatus
reason
cancelledById
cancelledAt
```

---

# Business Rules

## Rule 1: One Active Enrollment Per Student Per School Year

Prevent this:

```txt
Same student + same school year + multiple active enrollments
```

Allowed active statuses:

```txt
PENDING
ASSESSED
ENROLLED
```

Not active:

```txt
CANCELLED
```

---

## Rule 2: Only Pending Enrollment Can Be Assessed

Assessment creation requires:

```txt
Enrollment Status = PENDING
```

Reject assessment creation for:

```txt
ASSESSED
ENROLLED
CANCELLED
```

---

## Rule 3: Only Assessed Enrollment Can Be Paid

Payment processing requires:

```txt
Enrollment Status = ASSESSED
```

Reject payment processing for:

```txt
PENDING
ENROLLED
CANCELLED
```

---

## Rule 4: Enrolled Status Requires Valid Payment

MVP rule:

```txt
Any accepted initial payment can mark the student as ENROLLED.
```

<!-- Preferred stricter rule:
```txt
Only mark as ENROLLED after the required downpayment or full payment requirement is satisfied.
``` -->

Default recommendation:

```txt
Use required downpayment rule if payment terms exist.
```

Do not let a meaningless token payment automatically enroll a student unless the business explicitly allows it.

---

## Rule 5: Cancellation Must Preserve Records

Never delete:

- Enrollment
- Assessment
- Assessment details
- Payments
- OR records
- Ledger entries

Use cancellation status and audit fields instead.

---

## Rule 6: Cancellation of Enrolled Students Needs Stronger Control

Allowed, but should require:

- Admin role, or
- Registrar with explicit permission, or
- Finance approval if payment already exists

If payment exists, check refund handling before final cancellation.

---

# Implementation Guardrails

When implementing this workflow in code:

1. Locate existing schema/models first.
2. Do not create duplicate models if equivalents already exist.
3. Preserve existing naming conventions unless they are clearly broken.
4. Implement status transitions inside server-side actions/services only.
5. Do not let frontend directly decide final enrollment status.
6. Validate status transition before every write.
7. Wrap assessment creation and status update in a database transaction.
8. Wrap payment creation, allocation, ledger update, OR creation, and enrollment update in a database transaction.
9. Add audit fields for critical actions.
10. Do not hard-delete financial records.

---

# Required Service Functions

Use service/action functions similar to these.

## Enrollment

```ts
createEnrollment(input)
cancelEnrollment(input)
getEnrollmentsByStatus(status)
getStudentEnrollmentHistory(studentId)
```

## Assessment

```ts
createAssessment(input)
getPendingEnrollmentsForAssessment()
getAssessmentByEnrollment(enrollmentId)
```

## Cashier / Payment

```ts
processPayment(input)
getAssessedEnrollmentsForPayment()
generateOfficialReceipt(paymentId)
allocatePaymentToAssessmentDetails(input)
```

## Ledger

```ts
createAssessmentLedgerEntries(assessmentId)
createPaymentLedgerEntries(paymentId)
getStudentLedger(studentId)
```

---

# Transaction Requirements

## Assessment Transaction

When creating assessment:

```txt
1. Verify enrollment exists.
2. Verify enrollment.status === PENDING.
3. Create assessment header.
4. Create assessment details.
5. Create ledger debit entries if using ledger-first accounting.
6. Update enrollment.status = ASSESSED.
7. Commit transaction.
```

If any step fails:

```txt
Rollback everything.
```

---

## Payment Transaction

When processing payment:

```txt
1. Verify enrollment exists.
2. Verify enrollment.status === ASSESSED.
3. Verify assessment exists.
4. Create payment record.
5. Create payment allocations.
6. Create official receipt record.
7. Create ledger credit entries.
8. Check if enrollment requirement is satisfied.
9. Update enrollment.status = ENROLLED if valid.
10. Commit transaction.
```

If any step fails:

```txt
Rollback everything.
```

---

# UI Rules

## Enrollment Page UI

Must show:

- Student name
- Student number
- School year
- Grade level
- Section
- Student type
- Enrollment status
- Created date
- Actions

Allowed actions by status:

| Status | Actions |
|---|---|
| PENDING | View, Cancel |
| ASSESSED | View, Cancel |
| ENROLLED | View, Cancel with permission |
| CANCELLED | View only |

---

## Assessment Page UI

Must show only:

```txt
PENDING enrollments
```

Columns:

- Student name
- Student number
- Grade level
- School year
- Student type
- Action: Create Assessment

Do not show enrolled students here.

---

## Cashier Page UI

Must show only:

```txt
ASSESSED enrollments
```

Columns:

- Student name
- Student number
- Grade level
- Total assessment
- Amount paid
- Balance
- Payment status
- Action: Process Payment

Do not show pending students here.

---

# Access Control

## Admin

Can access all pages and all actions.

## Registrar

Can:

- Manage student records
- Create enrollment
- Create assessment if allowed by school policy
- Cancel pending/assessed enrollment if allowed

## Finance Officer

Can:

- View assessments
- View payment status
- Send digital invoices
- View ledgers
- View reports

## Cashier

Can:

- Process payments
- Generate OR
- View assessed students
- View payment history

Cashier should not edit student master records unless explicitly allowed.

## Teacher

Can:

- View assigned students
- Encode grades

Teacher should not access cashier functions.

## Student / Parent

Can view:

- Assessment
- Balance
- Payment history
- Grades

Student / Parent cannot modify enrollment, assessment, payment, or ledger data.

---

# Expected Output When Asked To Implement

When the user asks to implement this workflow, respond with these sections:

1. Current Codebase Findings
2. Required Changes
3. Database / Schema Changes
4. Server Actions / Services
5. UI Page Changes
6. Validation Rules
7. Transaction Rules
8. Testing Checklist
9. Files To Modify
10. Risks / Edge Cases

Do not ramble.

Do not skip the status machine.

Do not implement cashier logic before assessment logic exists.

---

# Testing Checklist

Before marking work complete, verify:

- New student can be created.
- Transferee can be created.
- Old student can be searched.
- Enrollment can be created.
- Enrollment starts as PENDING.
- Pending enrollment appears on Assessment Page.
- Assessment can be created from predefined fees.
- Assessment details are saved.
- Enrollment becomes ASSESSED.
- Assessed enrollment appears on Cashier Page.
- Payment can be processed.
- OR number is generated.
- Ledger is updated.
- Enrollment becomes ENROLLED after valid payment.
- Pending enrollment can be cancelled.
- Assessed enrollment can be cancelled.
- Enrolled enrollment requires stricter permission to cancel.
- Cancelled enrollment does not appear in Assessment or Cashier active queues.
- Duplicate active enrollment is blocked.
- Payment without assessment is blocked.
- Assessment without pending enrollment is blocked.

---

# Non-Negotiables

Do not bypass the assessment step.

Do not allow cashier payment from PENDING status.

Do not delete cancelled records.

Do not overwrite OR numbers.

Do not compute balances only from frontend state.

Do not trust client-side status transitions.

Do not allow duplicate active enrollment for the same student and school year.

Do not mix student master record status with enrollment status.

A student is a person record.

An enrollment is a school-year transaction.

An assessment is a billing record.

A payment is a financial transaction.

The ledger is the accounting truth.
@