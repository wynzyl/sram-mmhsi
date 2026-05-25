Updated: 5/21/2026

## Your ROLE

You are a Senior Software Engineer, Senior Software Architect, Senior Database Architect, QA, DevSecOps and SRE working on a School Registration and Account Monitoring system.

Task: Add production-grade error handling and user-friendly error messages across the application.

## Goal

Improve system reliability by handling expected and unexpected errors properly in:

- Registration
- Enrollment
- Assessment
- Ledger
- Cashier Payments
- OR Tracking
- Student Records
- Authentication / Authorization
- Reports
- API routes / Server actions
- Database operations

Do not change business logic unless required to safely handle errors.

---

## 1. Audit the Current Codebase

    First, inspect the project structure and identify:

    - Server actions
    - API routes
    - Form submissions
    - Database queries/mutations
    - Payment posting logic
    - Assessment creation logic
    - Enrollment status updates
    - Auth and RBAC checks
    - UI forms and tables

    Find areas where errors are currently:

    - Not caught
    - Only logged but not shown to the user
    - Shown as raw database/system errors
    - Handled inconsistently
    - Causing blank screens or crashes
    - Causing duplicate transactions on retry

    Return a short summary before editing files.

## 2. Create a Standard Error Handling Pattern

        Implement or improve a shared error utility.

        Expected structure:

        ```ts
        type ActionResult<T = unknown> = {
        success: boolean
        data?: T
        error?: {
            code: string
            message: string
            field?: string
        }
        }

        Use this pattern for server actions and mutation responses.

        Rules:

        Never expose raw database errors to users.
        Log technical errors on the server.
        Return clear business-friendly messages to the UI.
        Use consistent error codes.
        Keep messages short, direct, and actionable.

## 3. Define Common Error Codes

    Add standard error codes such as:

    VALIDATION_ERROR
    NOT_FOUND
    DUPLICATE_RECORD
    UNAUTHORIZED
    FORBIDDEN
    DATABASE_ERROR
    PAYMENT_ERROR
    ASSESSMENT_ERROR
    ENROLLMENT_ERROR
    LEDGER_ERROR
    OR_NUMBER_ERROR
    DOCUMENT_RELEASE_BLOCKED
    UNKNOWN_ERROR
    DISCOUNT_ERROR

    Use these consistently.

## 4. Add Business-Specific Error Messages

    Implement specific messages for school workflows.

    Examples:

    Registration
    Duplicate student:
    "Student already exists. Please verify the existing student record before creating a new one."
    Missing required information:
    "Please complete all required student information."
    Enrollment
    Student already enrolled:
    "Student already has an enrollment record for this school year."
    Invalid enrollment status:
    "Enrollment status does not allow this action."
    Assessment
    Missing fee schedule:
    "No active fee schedule found for this grade level."
    Assessment already exists:
    "Assessment already exists for this student and school year."
    Previous balance already forwarded:
    "Previous balance has already been forwarded to the current enrollment."
    Payments / Cashier
    Invalid payment amount:
    "Payment amount must be greater than zero."
    Overpayment:
    "Payment exceeds the student's outstanding balance. Please verify the amount."
    Duplicate OR number:
    "Official Receipt number is already used."
    Missing OR booklet:
    "No active OR booklet assigned to this cashier."
    Ledger
    Ledger posting failed:
    "Transaction could not be posted to the ledger. Please try again or contact the administrator."
    Document Release
    Blocked due to balance:
    "Documents cannot be released while the student has an outstanding balance."
    RBAC
    Unauthorized:
    "You need to sign in to continue."
    Forbidden:
    "You do not have permission to perform this action."

## 5. Add Try/Catch to Server Actions and API Routes

    For every server action and API route:

    Wrap database mutations in try/catch
    Validate input before mutation
    Return ActionResult
    Log technical error details server-side
    Return safe user-facing messages

    Example pattern:

    try {
    // validate input
    // execute business logic
    // write to database

    return {
        success: true,
        data: result,
    }
    } catch (error) {
    console.error("[CREATE_ENROLLMENT_ERROR]", error)

    return {
        success: false,
        error: {
        code: "ENROLLMENT_ERROR",
        message: "Enrollment could not be created. Please try again.",
        },
    }
    }

## 6. Protect Financial Transactions

    For cashier payments, assessment posting, balance forwarding, and ledger updates:

    Use database transactions where needed
    Prevent duplicate postings
    Prevent duplicate OR numbers
    Prevent duplicate forwarded balances
    Ensure ledger and enrollment status update together
    Roll back if any step fails

    Critical rule:

    A payment must not be saved unless its ledger entry and OR tracking update are also saved successfully.

    No half-cooked finance records. That is how accounting chaos gets born.

## 7. Improve UI Error Display

    Update forms and pages to show errors clearly.

    Requirements:

    Show validation errors near the relevant field
    Show business errors using toast/dialog/alert component
    Do not show raw stack traces
    Disable submit button while submitting
    Prevent double-click duplicate submissions
    Show loading states
    Show success messages after completed actions

    Suggested messages:

    "Saved successfully."
    "Payment posted successfully."
    "Assessment created successfully."
    "Enrollment updated successfully."

## 8. Add Empty and Failed State UI

    For tables and pages, add proper states:

    Loading state
    Empty state
    Failed state
    Retry action where appropriate

    Examples:

    No students found.
    No pending assessments.
    No payments recorded yet.
    Unable to load student records. Please try again.

## 9. Add Validation Layer

    Use the existing validation library if present. If none exists, use the current project convention.

    Validate:

    Required fields
    Email format
    Contact number format
    Grade level
    School year
    Student ID
    Payment amount
    OR number
    Discount amount
    Fee item amount
    Enrollment status transition

    Do not rely only on frontend validation. Server-side validation is required.

## 10. Add Logging Labels

    Use consistent log labels:

    [REGISTRATION_ERROR]
    [ENROLLMENT_ERROR]
    [ASSESSMENT_ERROR]
    [PAYMENT_ERROR]
    [LEDGER_ERROR]
    [OR_TRACKING_ERROR]
    [AUTH_ERROR]
    [REPORT_ERROR]

    Logs should help developers debug without exposing internals to users.

## 11. Acceptance Criteria

    The task is complete only when:

    All major server actions/API routes have safe error handling
    Financial operations cannot partially save
    Duplicate OR numbers are blocked
    Duplicate payments are prevented as much as possible
    Duplicate assessment and duplicate previous balance forwarding are blocked
    UI shows clear error messages
    No raw database or stack trace error appears to end users
    Validation errors are shown properly
    Loading, empty, and failed states exist on major pages
    Code follows the existing project structure and style

## 12. Output Required

    After implementation, provide:

    Files changed
    Error utility added or updated
    Pages/actions improved
    Financial transaction safeguards added
    Remaining risks or recommended follow-up improvements

    Do not create unnecessary abstractions. Keep the solution practical, clean, and maintainable.
