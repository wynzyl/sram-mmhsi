## FEATURE BASE FOLDER RESTRUCTURE

src/app/ = routes and pages
src/features/ = business modules
src/components/ui/ = shadcn base components
src/components/shared/ = reusable app components
src/components/layout/ = sidebar/topbar/layout shell
src/db/schema/ = Drizzle database schema and DB types
src/lib/constants/ = roles, statuses, fixed values
src/lib/utils/ = generic helpers
src/lib/calculations/ = money/accounting calculations
src/lib/validators/ = validation helpers
src/styles/ = token theme and global theme
src/types/ = global shared types only

## Suggested Architecture Summary

Your system should use a hybrid feature-based architecture:

Next.js app router handles pages.
Features handle business modules.
Drizzle schema handles database structure.
shadcn handles base UI.
Shared components handle reusable app UI.
Utils handle small helpers.
Calculations handle money logic.
Constants handle fixed statuses and roles.
Token theme handles consistent Tailwind styling.

## FEATURE-BASED

src/features/registrations/
components/
registration-form.tsx
registration-table.tsx
registrations.queries.ts
registrations.actions.ts
registrations.service.ts
registrations.schema.ts
registrations.types.ts

## What Each Folder Means

    src/app/

    This is for pages and routing only.

    Example:

    src/app/(dashboard)/assessments/page.tsx

    This page should only load data and display the feature component.

    Do not put heavy business logic here.

    src/features/

    This is the heart of the system.

    Each major business module gets its own folder:

    students
    registrations
    enrollments
    assessments
    cashier
    ledger
    fees
    grades
    dashboard

    Each feature owns its own:

    components
    queries
    actions
    services
    schemas
    types

    Example:

    src/features/assessments/
    assessments.queries.ts   // read assessment data
    assessments.actions.ts   // create/update assessment from UI
    assessments.service.ts   // business rules
    assessments.schema.ts    // Zod validation
    assessments.types.ts     // feature-specific types
    File Purpose
    *.queries.ts

    Read-only database functions.

    getPendingEnrollments()
    getAssessmentByStudentId()
    getPaymentsByEnrollmentId()
    getDashboardStats()

    Use for fetching data.

    *.actions.ts

    Server Actions for form submissions and mutations.

    createEnrollment()
    createAssessment()
    processPayment()
    cancelEnrollment()

    Use for create, update, delete operations.

    *.service.ts

    Business rules and workflows.

    forwardPreviousBalance()
    createAssessmentFromFeeSchedule()
    applyPaymentToLedger()
    generateStudentId()

    This is where the real system logic lives.

    *.schema.ts

    Validation schemas.

    Usually Zod.

    createStudentSchema
    createPaymentSchema
    createAssessmentSchema
    *.types.ts

    Feature-specific types only.

    Example:

    AssessmentWithItems
    StudentAccountSummary
    EnrollmentListItem

    Do not dump every type in one global file. That becomes type soup.

    shadcn Components

    shadcn lives here:

    src/components/ui/

    Example:

    button.tsx
    card.tsx
    input.tsx
    table.tsx
    dialog.tsx
    badge.tsx
    form.tsx

    These are base UI components.

    Do not put business components here.

    Bad:

    src/components/ui/enrollment-form.tsx

    Good:

    src/features/enrollments/components/enrollment-form.tsx
    Shared Components

    Use this for reusable app components:

    src/components/shared/

    Examples:

    page-header.tsx
    search-input.tsx
    status-badge.tsx
    confirm-dialog.tsx
    data-table.tsx
    empty-state.tsx

    These are reusable across many features.

    Layout Components

    Use this for dashboard shell UI:

    src/components/layout/

    Examples:

    sidebar.tsx
    topbar.tsx
    dashboard-shell.tsx
    role-menu.tsx

    This prevents duplicated Admin, Registrar, Cashier pages.

    Admin should not have a duplicate Registration page. Admin and Registrar should use the same page, controlled by RBAC permissions.

    Drizzle ORM Schema

    Drizzle database tables live here:

    src/db/schema/

    Example:

    students.ts
    enrollments.ts
    assessments.ts
    payments.ts
    ledger.ts
    users.ts

    Drizzle inferred types should stay beside the table.

    Example:

    // src/db/schema/enrollments.ts

    export const enrollments = pgTable("enrollments", {
    // columns here
    });

    export type Enrollment = typeof enrollments.$inferSelect;
    export type NewEnrollment = typeof enrollments.$inferInsert;

    That is the cleanest place for database-level types.

    Constants

    Constants live here:

    src/lib/constants/

    Examples:

    roles.ts
    enrollment-status.ts
    student-type.ts
    payment-method.ts
    fee-category.ts
    assessment-status.ts

    Example:

    // src/lib/constants/enrollment-status.ts

    export const ENROLLMENT_STATUS = {
    PENDING: "PENDING",
    ASSESSED: "ASSESSED",
    ENROLLED: "ENROLLED",
    CANCELLED: "CANCELLED",
    } as const;

    Do not hardcode "PENDING" all over the app. That is how bugs reproduce like mosquitoes.

    Utilities

    Generic helper functions live here:

    src/lib/utils/

    Examples:

    cn.ts
    format-date.ts
    format-currency.ts
    pagination.ts
    normalize-name.ts

    Use this for reusable helpers that are not tied to one feature.

    Calculations

    Money and accounting computations live here:

    src/lib/calculations/

    Examples:

    assessment.ts
    balance.ts
    payment-allocation.ts
    ledger.ts

    This is important for your system because assessment, cashier, ledger, and previous balance must be consistent.

    Do not calculate balances directly inside React components.

    Bad:

    assessment-form.tsx calculates balance

    Good:

    src/lib/calculations/balance.ts
    Validators

    Validation helpers live here:

    src/lib/validators/

    Examples:

    or-number.ts
    student-id.ts
    school-year.ts

    Use these for non-Zod reusable checks.

## PATTERN

Both Admin and Registrar can access it.
Access is controlled by permissions:
const allowedRoles = ["ADMIN", "REGISTRAR"];
Not by duplicating the page.

## RULES

1. Do not create separate Registration pages for Admin and Registrar.
2. Create one Registration page.
3. Allow Admin/ceo and Registrar through RBAC.
4. Show/hide buttons based on permissions.
