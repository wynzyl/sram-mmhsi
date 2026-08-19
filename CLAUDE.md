# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SRAMS (School Registration and Accounts Monitoring System)** — A production-grade K-12 school management system for managing student enrollment, fee assessments, Official Receipt (OR) tracking, payment processing, and grade encoding.

**Stack:** Next.js 16 (App Router) · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · Zod 4 · React 19 `useActionState` + Server Actions (forms) · JWT (jose)

> **Forms:** The default form pattern is native React 19 `<form action={action}>` + `useActionState`, with **server-side** Zod validation in the action (`schema.safeParse(formData)`) and errors returned via `state.errors`. React Hook Form is **not** used. **TanStack Form (`@tanstack/react-form`) is adopted for complex wizard / field-array forms only** — first migration is `src/features/registrations/components/StudentRegistrationForm.tsx` (4-step wizard + guardian field array, migrated in place 2026-05-28). When migrating a form to TanStack Form: reuse the existing Zod schemas via a small `zodCheck` adapter, render array-item flags (e.g. guardian `isPrimary`) as real subscribed fields or set them through whole-array `setFieldValue`, keep the existing server action + FormData contract unchanged, and dispatch the `useActionState` action inside `startTransition`. Simple single-submit forms stay native (progressive enhancement). See `docs/TANSTACK-MIGRATION/TANSTACK-FORM-CANDIDATES.md` for the per-form assessment and migration order.
  
  #Tanstack Query 
  -Correct architecture:

      Client Component
        ↓
      TanStack Query
        ↓
      API Route / Server Action / RPC function
        ↓
      Drizzle ORM
        ↓
      Database

  -Wrong architecture:

      Client Component
        ↓
      Drizzle ORM directly
        ↓
      Database

     
  TanStack Table  = table logic: columns, sorting, filtering, pagination
  TanStack Query  = server data: fetch, cache, refetch, sync
  shadcn/ui       = visual components: Table, Button, Card, Badge

  #Rules
    Drizzle ORM        = gets data from database
    Server Action/API  = exposes data safely
    TanStack Query     = fetches/caches data in client (Use TanStack Query for server state)
    shadcn Table       = displays the data

**Critical Business Feature:** Official Receipt (OR) booklet management is a first-class accounting control feature — every payment must consume a serialized OR number from an active booklet.

### Current Delivery Snapshot (2026-07-21)

**Core Features:**

- Core operations (auth, students, registrations queue, enrollments, assessments, payments/OR, invoices, grades) are implemented and production-ready.
- **Student Archival & EOY Processing** complete: lifecycle statuses (active, graduated, transferred, withdrawn, cancelled, inactive), batch archive operations, archive directory at `/staff/archive/`
- **Document Requests** complete: full workflow (request → processing → ready → released) with eligibility gates for archived/active students
- **Academics Module Optimization** complete: performance improvements, grade sheet workflow, theme support
- Registration creation is integrated in student onboarding; dedicated intake/review actions are still pending.
- Portal has `/portal/dashboard`; detail pages (`/portal/assessments`, `/portal/payments`, `/portal/grades`) pending.
- Authentication hardening complete: login rate limiting and forced password-change gate are live.
- E2E Playwright test suite committed with CI workflow.

**Recent Updates (2026-07-21):**

- ✅ **Academics Module Optimization** — Query performance (N+1 fixes, EXISTS filters, pagination), grade completion validation, sequential period locking, AlertDialog accessibility
- ✅ **Form Pattern Consistency** — Removed redundant inline error displays in favor of `useFormToast` pattern
- ✅ **Documentation** — Updated grade encoding workflow to document adviser-based sheets as primary

**Prior Updates (2026-07-03):**

- ✅ **Student Archival** — Status lifecycle (active, graduated, transferred, withdrawn, cancelled, inactive), batch operations, archive directory
- ✅ **Document Requests** — Full workflow with eligibility/release gates, routes at `/staff/archive/documents/`
- ✅ **Production Hardening** — Docker resource limits (memory/CPU caps), Nginx tuning (timeouts, compression, caching)
- ✅ **Archive performance indexes** — Migration `0003_add_archive_indexes.sql`
- ✅ **Bug Fix** — Registration form reset after submission (bfcache/soft navigation fix)

**Prior Milestones:**

- ✅ **Performance Optimization (2026-05-13):** Enrollment queue query with SQL-level pagination (47MB → 50KB memory)
- ✅ **Folder Restructure (2026-05-09):** All features migrated to `src/features/` structure
- ✅ **Library Migration (2026-05-11):** All 58 files moved to `src/lib/`

## Important Documentation References

- **AGENTS.md** — AI role definitions and system expectations
- **SRAMS_MVP.md** — System requirements and feature specifications
- **SRAMS_OR_WORKFLOW.md** — OR tracking workflow (MUST READ before modifying OR features)
- **PROJECT_ROADMAP.md** — Development roadmap and phases
- **PROJECT_STATUS.md** — Current implementation status and active gaps

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/srams_db"
AUTH_SECRET="your-secret-key"
NODE_ENV="development"
```

## Architecture

### Core Design Principles

1. **Feature-Based Architecture:** Code organized by domain feature in `src/features/` with actions, schemas, queries, and components co-located
2. **Hybrid Schema Strategy:** Shared schemas (common-schemas, intake-documents) in `src/lib/validators/`, feature-specific schemas in `src/features/*/`
3. **OR Tracking is Mandatory:** Every payment transaction must be linked to an OR number from an active booklet
4. **Audit Everything Financial:** All payment posts, voids, and OR consumption must generate audit log entries
5. **Role-Based Access Control (RBAC):** Enforce at 3 levels — route guard, server action validation, and audit logging
6. **Soft Delete Only:** Use `deletedAt` / `deletedBy` fields — never hard delete records
7. **Reusable Function - Always use resuable function and components, break code into smaller function for a readable and
  maintainable code. 

### Layer Boundaries (Non-Negotiable)

| Layer             | Location                                                  | Responsibility                                    | Rules                                                   |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| Server Actions    | `src/features/*/*.actions.ts`                             | ALL business logic and DB writes                  | Must use `"use server"` directive                       |
| Zod Schemas       | `src/features/*/*.schema.ts` or `src/lib/validators/*.ts` | Data validation and type definitions              | Shared schemas in src/lib, feature-specific in features |
| Server Queries    | `src/features/*/*.queries.ts`                             | ALL database reads                                | Server-only, passed as props to components              |
| Utility Functions | `src/lib/utils/*.ts`                                      | Pure transformations only (format, compute, etc.) | No database calls, no business logic                    |
| Client Components | `src/features/*/components/*.tsx`                         | UI state and form interactions only               | No direct DB access, no business logic                  |
| Auth & Sessions   | `src/lib/auth/*.ts`                                       | JWT-based session management                      | Use `requireSession()` in server components & pages     |
| Page Templates    | `src/app/page-templates/`                                 | Reusable page components for routes               | Server components that compose features                 |

**Violations:** No business logic in `.tsx` files. No direct DB calls in components. No raw SQL outside queries/actions.
* No HARD DELETE.

### Routing & Authentication

Route structure (App Router):

- `/login` — Public login page
- `/admin/*` — Admin portal (full access)
- `/staff/*` — Internal operations portal for registrar/finance/cashier/teacher role flows
- `/portal/*` — Student/parent portal (dashboard scaffold currently implemented)

Authentication is JWT-based using `jose` library (NOT NextAuth). Session management in `src/lib/auth/session.ts`:

- `requireSession()` — Throws redirect if unauthenticated (use in pages/layouts)
- `getCurrentUser()` — Returns user + role or null (use in server components)
- `createSession()` — Creates session on login
- `deleteSession()` — Logout

## NextJS Revalidate Tag Rule

1. https://nextjs.org/docs/messages/revalidate-tag-single-arg

2. Root route protection lives in `proxy.ts` (export `proxy`): unauthenticated redirects, staff vs portal separation, and `/admin` restrictions. **Next.js 16** renamed the former `middleware.ts` convention to `proxy.ts`; older writeups may still say “middleware.”

### User Roles & Permissions

**Roles (via `roleEnum` in schema):**

- `super_admin` - Manages system setup, users, roles, database-related settings.
- `admin` — Can view and access all business operations and reports
- `registrar` — Student records & enrollment management
- `finance_officer` — Fee schedules, assessments, invoices, OR booklet setup
- `cashier` — Payment posting only
- `teacher` — Grade encoding only
- `student` — View own assessments, payments, grades

**Permission checks:** Use `hasPermission(role, permission)` from `src/lib/rbac/permissions.ts` in server actions before executing sensitive operations.

### Database Schema Key Relationships

**Students & Parents:**

- `users` → `students` (optional portal account via `userId`)
- `students` ↔ `parentsGuardians` via `studentGuardianLinks` (many-to-many)

**Academic Workflow:**

- `schoolYears` (one active at a time)
- `gradeLevels` (static: Kinder, Grade 1–12)
- `sections` (per grade level + school year)
- `curriculums` → `subjects` (per curriculum + grade level)
- `teacherAssignments` (teacher + subject + section + school year)
- `gradeRecords` (student + assignment + grading period: Q1–Q4)

**Registration → Enrollment Flow:**

1. `registrations` (approved records currently created during student onboarding)
2. `enrollments` (status: pending → assessed → enrolled)
3. `feeSchedules` + `feeScheduleItems` (schedule for every group level - (Casa, Lower Elem, Higher Elem, JHS, SHS))
4. `assessments` + `assessmentItems` (copied from fee schedule on enrollment)

**Payment & OR Tracking (Critical):**

1. `receiptBooklets` — OR booklet definition (series, start/end number, status)
2. `payments` — Payment record (linked to `bookletId` + `orNumber`)
3. `paymentAllocations` — Payment distribution across assessment items
4. OR lifecycle: available → consumed (or voided if payment voided)
5. Booklet status transitions: active → exhausted (when `nextNumber > endNumber`)
6. GCash and bank transfer always require a reference number (not optional)

**Invoices:**

- `invoices` (status: draft → sent → viewed → settled/overdue)
- Linked to `assessments` for tracking outstanding balances
- Finance officers send via email integration

### Official Receipt (OR) Tracking Workflow

**CRITICAL: Read SRAMS_OR_WORKFLOW.md before modifying OR-related code.**

**Critical Requirements:**

1. **Booklet Management:**
   - Finance officers create booklets with series (e.g., "AP"), start/end numbers
   - **Multiple booklets may be active at the same time** — the cashier chooses which receipt series to consume at posting time (owner-confirmed business rule, 2026-06-04; supersedes the old "one active booklet per cashier" wording)
   - Booklet status: `active` | `exhausted` | `voided`

2. **Payment Posting:**
   - Cashier selects active booklet before posting
   - System auto-assigns next sequential OR number (e.g., AP-00001)
   - OR status: `available` → `consumed` (immutable)
   - Payment status: `pending_confirmation` → `posted`
   - **Idempotent posting:** the form sends a client-generated `idempotencyKey` (UUID per form mount); a retried submit with the same key returns the original payment instead of consuming a second OR (`payments_idempotency_key_uidx`)
   - **Enrollment side effect (confirmed policy):** the FIRST posted payment — any amount, even partial — transitions the enrollment `assessed → enrolled`; the assessment ledger stays `outstanding` until the balance is settled

3. **Validation Rules:**
   - OR number must be unique (enforced by unique index)
   - OR must be within booklet range
   - OR cannot be reused even if payment is voided
   - Voided payments mark OR as `voided` but do not return to pool
   - OR number must be 5 digit number
   - Each booklet should range 51pcs only ex: AK 00050-00100
   - Prefix is 2 digit Letter Only ex: AK

4. **Audit Trail:**
   - Every payment post, void, or booklet status change triggers audit log
   - Capture: actor, timestamp, OR number, amount, student reference

**Related Files:**

- Schema: `src/lib/db/schema.ts` (tables: `receiptBooklets`, `payments`)
- Actions: `actions/cashier.ts` (payment posting logic)
- Validators: `src/lib/validators/cashier.ts`

### Grade Encoding Workflow

**Primary Workflow: Adviser-Based Grade Sheets**

The adviser-based grade sheet workflow is the primary system for grade management:

1. Section adviser accesses their assigned section at `/staff/grades/adviser/sections/[sectionId]`
2. Adviser enters grades for all subjects per student per grading period (Q1–Q4 or T1–T3)
3. Client-side validation prevents submission of incomplete sheets (X/Y grades entered)
4. Sheet status: `draft` → `submitted` (for review) → `approved` (by principal) or `returned` (for revision)
5. Sequential period locking: Q2 cannot be submitted until Q1 is approved

**Grade Sheet Statuses:**

- `draft` — Editable by adviser
- `submitted` — Awaiting principal review (read-only)
- `approved` — Locked, published to student records
- `returned` — Returned for revision (editable again)

**Grading Periods:** Q1, Q2, Q3, Q4 (quarterly) or T1, T2, T3 (trimester)

**Related Files (Adviser Workflow):**

- Schema: `gradeSheets`, `gradeSheetEntries`
- Actions: `src/features/academics/grades/grades.actions.ts`
- Queries: `src/features/academics/grades/grades.queries.ts`
- Components: `src/features/academics/grades/components/AdviserGradeEntryGrid.tsx`, `AdviserSectionCards.tsx`

**Legacy: Teacher Assignment Workflow**

The teacher-based `teacherAssignments` + `gradeRecords` system is available but secondary:

- Schema: `gradeRecords`, `teacherAssignments`
- Actions: `actions/teacher.ts`
- Components: `src/features/academics/grades/components/GradeEncodingTable.tsx` (deprecated in favor of adviser workflow)

### Reusable Components

**Data Display:**

- `DataTable<t>` — tanstack table
- `StatusBadge` — Maps DB status enums to styled badges
- `CurrencyDisplay` — Formats amounts in PHP locale (en-PH)
- `ReferenceCode` — Displays student reference numbers

**Forms & Toast Notifications (Refactored - Phase 3.5):**

- `useFormToast` — **USE THIS** hook for form-level success/error messages (uses Sonner toasts)
- `FormStateAlert` — **DEPRECATED** — Inline alert component, replaced by `useFormToast`
- `TextInputField` — Controlled text input with inline field error display
- `SelectField` — Controlled select dropdown with inline field error display
- `CurrencyInputField` — Currency input with PHP formatting
- `FormField` — Legacy form field wrapper (migrate to above)
- `FormSection` — Form section with heading
- `FormActions` — Form submit/cancel buttons

**Toast Pattern (field vs form errors):**
- **Field errors:** Keep inline below form fields (better UX for validation)
- **Form-level errors/success:** Use toast notifications (non-blocking, bottom-right)

**Actions (Refactored - Phase 3.4):**

- `ConfirmActionButton` — **USE THIS** for all confirmation actions (delete, lock, remove, etc.)
- `InlineConfirmButton` — Inline variant (for table cells)
- `BlockConfirmButton` — Full-width variant (for modals)

**Layout:**

- `PageHeader` — Page title + breadcrumb
- `PageContainer` — Page wrapper with consistent padding

**UI Primitives (Shadcn/ui-based):**

- `Button`, `Input`, `Card`, `Badge`, `Spinner`, `ThemeToggle`

### Rules (Non-Negotiable)

1. **Soft Delete Only:** Use `deletedAt` / `deletedBy` fields. Never hard delete.
2. **No Dashboards Before Logic:** Do not build overview/dashboard pages until core CRUD operations exist.
3. **RBAC at 3 Levels:** Route guard (`proxy.ts`) + server action validation + audit logging.
4. **Always Use Reusable Components:** Do not create one-off table/form components.
5. **Defensive Key Generation:** Use `key={item.id}` for DB records, never array index.
6. **Zod for Runtime Validation:** Parse external input (forms, API responses) with Zod schemas.
7. **Create TODO List First:** Before implementing multi-step features, create a task list using `TaskCreate` tool.
8. **No Business Logic in UI:** Components render state only — all mutations via server actions.
9. **Financial Actions Require Audit:** Every payment post/void/refund must write to `auditLogs`.

### Common Patterns

**Server Component Pattern (fetching data):**

```typescript
// src/app/admin/students/page.tsx
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { students } from "@/lib/db/schema";

export default async function StudentsPage() {
  const session = await requireSession();

  const studentsList = await db.query.students.findMany({
    where: eq(students.deletedAt, null), // soft delete filter
  });

  return <StudentsTable data={studentsList} />;
}
```

**Server Action Pattern (mutations) - REFACTORED:**

```typescript
// actions/students.ts
"use server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger"; // ✅ Phase 3.1: Use centralized audit
import { db } from "@/lib/db";
import { createStudentSchema } from "@/lib/validators/student";
import type { CreateStudentFormState } from "@/lib/validators/student"; // ✅ Phase 3.2: BaseFormState

export async function createStudent(
  _prevState: CreateStudentFormState,
  formData: FormData,
): Promise<CreateStudentFormState> {
  const session = await requireSession();

  // 1. Permission check
  if (!hasPermission(session.role, "students:create")) {
    return { message: "You do not have permission to create students." };
  }

  // 2. Validate input
  const parsed = createStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    // ... other fields
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // 3. Business logic + DB write
  const [student] = await db
    .insert(students)
    .values({
      ...parsed,
      createdBy: session.userId,
    })
    .returning();

  // 4. Audit log - ✅ Use centralized logger (Phase 3.1)
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "students:create",
    targetEntity: "students",
    targetId: student.id,
    newState: { studentRef: student.studentRef },
  });

  return { success: true, studentId: student.id };
}
```

Enforce at **3 levels**: route guard → server action validation → audit logging. UI hiding is NOT security.

### ActionResult Pattern (NON-NEGOTIABLE)

All server actions must return this shape:

```typescript
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };
```

**Client Component Pattern (form submission) - REFACTORED (Phase 3.5):**

```typescript
// components/students/StudentForm.tsx
"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createStudent } from "@/actions/students";
import { useFormToast } from "@/hooks/useFormToast";  // ✅ Phase 3.5: Toast notifications
import { TextInputField } from "@/components/forms/TextInputField";

export function StudentForm() {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createStudent, {});
  const [firstName, setFirstName] = useState("");

  // ✅ Show toast for form-level success/errors (replaces FormStateAlert)
  useFormToast(state, {
    successMessage: "Student created successfully",
    onSuccess: () => router.push(`/staff/students/${state.studentId}`),
  });

  return (
    <form action={action}>
      {/* Field-level errors stay inline */}
      <TextInputField
        label="First Name"
        name="firstName"
        required
        value={firstName}
        onChange={setFirstName}
        error={state.errors?.firstName}  // ✅ Inline field error
      />

      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

**Validator Pattern - REFACTORED (Phase 3.2):**

```typescript
// src/lib/validators/student.ts
import { z } from "zod";
import {
  nameSchema,
  emailSchema,
  phoneSchema,
  type BaseFormState, // ✅ Use shared base type
} from "./common-schemas";

export const CreateStudentSchema = z.object({
  firstName: nameSchema, // ✅ Use common schemas
  middleName: z.string().trim().optional(),
  lastName: nameSchema.toUpperCase(),
  email: emailSchema, // ✅ Reusable validation
  mobileNumber: phoneSchema, // ✅ Reusable validation
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

// ✅ Extend BaseFormState instead of redefining
export type CreateStudentFormState = BaseFormState<CreateStudentInput> & {
  studentId?: string; // Additional fields beyond base
};
```

**Confirmation Button Pattern - REFACTORED (Phase 3.4):**

```typescript
// Instead of creating custom button components, use ConfirmActionButton:
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { deleteSubjectAction } from "@/actions/academics";

<InlineConfirmButton
  action={deleteSubjectAction}
  confirmMessage="Are you sure you want to delete this subject?"
  hiddenFields={{ subjectId: subject.id }}
  label="Delete"
  loadingLabel="Deleting..."
  variant="danger"
/>
```

### System Constants Pattern

**When to use constants vs database tables:**

| Aspect               | Constants (recommended)                        | Database Tables            |
| -------------------- | ---------------------------------------------- | -------------------------- |
| **Use for**          | System configuration (roles, assessment bands) | User-managed data          |
| **Change frequency** | Rarely (requires migrations)                   | Frequently (via UI)        |
| **Type safety**      | Compile-time validation                        | Runtime only               |
| **Performance**      | No queries needed                              | Requires DB queries        |
| **Examples**         | Roles, assessment bands, grading periods       | Students, payments, grades |

**Location:** `src/lib/constants/`

**Pattern (Constants + PostgreSQL Enum):**

```typescript
// File: src/lib/constants/system-values.ts

// 1. Define constant array with const assertion
export const SYSTEM_VALUES = ["value1", "value2"] as const;

// 2. Derive TypeScript type
export type SystemValue = (typeof SYSTEM_VALUES)[number];

// 3. Provide human-readable labels
export const SYSTEM_VALUE_LABELS: Record<SystemValue, string> = {
  value1: "Label 1",
  value2: "Label 2",
};
```

**Usage in schema:**

```typescript
// File: src/lib/db/schema.ts
import { SYSTEM_VALUES } from "@/lib/constants/system-values";

// Create PostgreSQL enum from constants (automatic sync)
export const systemValueEnum = pgEnum("system_value", SYSTEM_VALUES);

// Use in table definitions
export const someTable = pgTable("some_table", {
  systemValue: systemValueEnum("system_value").notNull(),
});
```

**Database Design (Normalized Storage):**

Store the actual value **once** in a logical table, access via relationships:

```typescript
// ✅ GOOD: Single source of truth
gradeLevels → has assessment_band field
assessments → enrollment → gradeLevel.assessmentBand (access via relationship)

// ❌ BAD: Duplication
gradeLevels → has assessment_band
assessments → also has assessment_band (must keep in sync)
```

**Access pattern:**

```typescript
const assessment = await db.query.assessments.findFirst({
  with: {
    enrollment: {
      with: {
        gradeLevel: true, // Pull assessmentBand from here
      },
    },
  },
});

const band = assessment.enrollment.gradeLevel.assessmentBand;
```

**When to use this pattern:**

- ✅ Values are system configuration, not user data
- ✅ Rarely change (require schema migrations)
- ✅ Need TypeScript type safety
- ✅ Used in forms/UI dropdowns (no DB query needed)
- ✅ Part of business logic structure (like roles, assessment bands)

### Reference Number Generation

Student reference numbers use a 7-digit plain number format: `NNNNNNN`
- e.g., `0000001`, `0000002`, `0000100`, `9999999`

The sequence is managed by PostgreSQL `student_ref_seq` for concurrency safety.

```typescript
import { generateStudentRef } from "@/lib/utils/reference";

// In students.actions.ts:
const seq = await getNextStudentSequence(); // Uses nextval('student_ref_seq')
const referenceNumber = generateStudentRef(seq);
// e.g., "0000001", "0000002", "0000100"
```

### Currency Formatting

Always use `CurrencyDisplay` component or format manually with `en-PH` locale:

```typescript
// In component
<CurrencyDisplay amount={1500.00} />

// In utility
new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(1500);
```

### Report & Document Generation (Standard — Non-Negotiable)

All reports and printable documents follow **one two-track standard** built on the shared module
`src/features/reports/shared/`. Do **not** invent a new per-report mechanism, and do **not** use
browser `window.print()` for documents.

**Track 1 — Official documents → `@react-pdf/renderer`.** Presentation-grade artifacts that must look
identical for everyone and may be emailed/attached: invoices, receipts, official letters, and the
"official" PDF of any report. Server-rendered via `renderToBuffer` in a route handler.

**Track 2 — Analytical reports → XLSX via `exceljs`.** Tabular finance data officers pivot/total
themselves: Payment Collection, Balance Forward, ledgers. Usually paired with a Track-1 PDF.

**Route convention:** every export is a route handler at `…/<name>/export?format=pdf|xlsx&<filters>`
that (1) checks `getCurrentUser()` + `hasPermission(role, "reports:view")` (or `invoices:read` for
invoice docs), (2) returns via `pdfResponse` / `xlsxResponse`, and (3) calls `logReportExport(...)`
(`reports:export` audit entry). See `src/app/staff/reports/payment-collection/export/route.ts` as the
reference implementation.

**Shared module (`src/features/reports/shared/`) — always reuse, never re-roll:**

- `report-format.ts` — `pesoText` (real `₱`), `pesoNumber` + `PESO_NUMBER_FORMAT` (Excel), `reportDate`
  / `reportDateTime` / `reportPeriodLabel`. Wraps `src/lib/utils/currency.ts` + `date.ts`
  (Asia/Manila). **Never** hand-roll `Intl` or print the literal `"PHP "` in a report.
- `pdf-fonts.ts` — `registerReportFonts()` embeds Roboto (`public/fonts/Roboto-*.ttf`) so `₱` (U+20B1)
  renders; the PDF built-in Helvetica cannot. Call it before rendering (the primitives do this).
- `pdf-primitives.tsx` — `TabularReportDocument<T>` (generic paginated report: header + summary +
  repeating table header + page-numbered footer), `Letterhead`, `ReportColumn<T>`. Build a new tabular
  report by supplying a `columns` config — do not duplicate `StyleSheet`/pagination.
- `xlsx-report.ts` — `buildReportWorkbook({ columns, rows, summaryItems, … })` → `Buffer`.
- `report-response.ts` — `pdfResponse` (supports `{ inline: true }` for print/preview), `xlsxResponse`,
  `parseReportFormat`.
- `report-request.ts` — `parseReportDateRange`, `reportFilename`.
- `audit-report.ts` — `logReportExport({ actor, report, format, rowCount, filters })`.

**Per-report wiring:** put the shared PDF document + XLSX builder for a report in a single
`*-report.export.tsx` so the two formats never drift (e.g. `payment-collection-report.export.tsx`,
`balance-forward-report.export.tsx`; invoices: `src/features/finance/invoices/invoice-document.tsx`).
Client "Export PDF / Export Excel" buttons download via a temporary `<a>` (filename comes from the
server's `Content-Disposition`).

**Email stays HTML:** `generateAssessmentLetterHtml` is for the Gmail invoice path only — email clients
need HTML. Only the print/download path uses react-pdf.

### Testing

**Unit Tests:** Use Vitest for utility functions and schema validation.

**E2E Tests:** Playwright is configured as target tooling, but the committed end-to-end suite is still pending.

**Test Commands:**

- `npm run test` — Run all unit tests
- `npm run test:watch` — Watch mode for TDD
- `npm run test:e2e` — Run Playwright tests

### Migrations

**Workflow:**

1. Modify `src/lib/db/schema.ts`
2. Run `npm run db:generate --name=descriptive_migration_name` — Creates migration file in `drizzle/`
3. Review generated SQL in `drizzle/*.sql`
4. Run `npm run db:migrate` — Applies migration to database
5. Commit both schema changes AND migration files

**Migration Naming (Non-Negotiable):**

- **ALWAYS** use clear, human-readable, descriptive names for migrations
- Use snake_case format: `add_student_lrn_field`, `create_payment_allocations_table`, `fix_assessment_balance_constraint`
- **NEVER** use auto-generated random names like `rich_gamora` or `fancy_unicorn`
- Name should describe what the migration does

**Important:** Never use `db:push` in production. Always use migrations for traceability.

### Seeding

**System Configuration Seed:**

```bash
npm run db:seed-config
```

Seeds: school years, grade levels, sections, default admin user.

**Sample Data Seed:**

```bash
npm run db:seed
```

Seeds: students, enrollments, assessments (for testing).

### Style Guidelines

**CSS:** Use Tailwind utility classes for layout, CSS custom properties for theming.

**Color Palette:**

- Primary: Deep Red (`--color-primary`)
- Accent: Green (`--color-success`)
- Surface: Light gray backgrounds (`--color-surface`, `--color-surface-2`)

**Design Principles:**

- Clean, grid-aligned layouts
- High information density for operational screens (cashier, registrar)
- Professional academic feel
- Prioritize readability over flashy UI

### Common Gotchas

1. **Session Renewal:** Use `renewSession()` sparingly — only on critical user actions.
2. **Soft Delete Filters:** Always include `deletedAt IS NULL` in queries for active records.
3. **OR Number Immutability:** Once consumed, OR numbers cannot be reused even if payment is voided.
4. **Grade Locking:** Locked grades can only be unlocked by admin role.
5. **Booklet Exhaustion:** When booklet reaches end number, auto-mark as `exhausted` and require new booklet selection.
6. **Unique Constraints:** Respect unique indexes (student reference, OR number, invoice number, etc.).
7. **Date Hydration Mismatch (Timezone):** NEVER hand-roll `new Date(x).toLocaleDateString("en-PH")` / `toLocaleString(...)` in components. With no fixed `timeZone`, the server (UTC) and client (Asia/Manila, UTC+8) format the same timestamp as **different calendar dates**, causing a React hydration mismatch ("server rendered text didn't match the client") that regenerates the subtree on the client — observed as instability/"infinite re-render"/freeze. **Always format dates via `formatDate` / `formatDateTime` from `src/lib/utils/date.ts`**, which pin `SCHOOL_TIME_ZONE = "Asia/Manila"`. Do not mask the symptom with `suppressHydrationWarning`. When a "freeze / re-render loop" is reported, check the browser console for a hydration mismatch first. (Regressed in the enrollment-cancellation feature, fixed 2026-05-29.)
8. **Session Cookie over HTTP (LAN prod):** The session cookie's `Secure` flag is env-driven via `SESSION_COOKIE_SECURE` (`src/lib/auth/session.ts`). The Ubuntu prod deployment serves plain HTTP through nginx on :80, and browsers drop `Secure` cookies on non-HTTPS origins (except localhost) — login from another machine silently fails with a login → change-password redirect loop. `.env.production` sets `SESSION_COOKIE_SECURE=false`; flip to `true` when TLS is added at nginx. (Diagnosed 2026-06-05.)
9. **Photo Upload in Docker (Volume Permissions + Static Serving):** Four layers must align for photo uploads to work in production Docker:
   - **Nginx body size:** `client_max_body_size 5M` in `nginx.conf` (default 1MB blocks uploads)
   - **Next.js body size:** `experimental.serverActions.bodySizeLimit: '3mb'` in `next.config.ts`
   - **Volume permissions:** Docker named volumes are owned by root; `docker-entrypoint.sh` runs `chown -R nextjs:nextjs /app/public/uploads` at container start before dropping to nextjs user via `su-exec`
   - **Static file serving:** Next.js does NOT serve runtime-uploaded files from `public/` in production; nginx serves `/uploads/*` directly from the shared volume (`uploads_data:/app/public/uploads:ro` in docker-compose). If photos upload but don't display, check nginx has the volume mounted and the `/uploads/` location block exists.
   - **Next.js Image `unoptimized` prop:** Next.js Image Optimization (`/_next/image`) only works for images present at build time. Runtime-uploaded photos return 400 errors. **Always use `unoptimized` prop** on `<Image>` components displaying uploaded photos (see `StudentAvatar.tsx`, `StudentPhotoUpload.tsx`). (Fixed 2026-06-24.)
10. **Parallel DB Queries in Server Components:** When a page needs multiple pieces of data, **always use `Promise.all`** to parallelize independent queries. Sequential `await` calls add latency (each round-trip is ~10-50ms). Pattern:
    ```typescript
    // ❌ BAD: Sequential queries (200ms+ total)
    const request = await getRequest(id);
    const eligibility = await checkEligibility(request.studentId);
    const balance = await getBalance(request.studentId);

    // ✅ GOOD: Parallel queries (50ms total)
    const request = await getRequest(id);
    const [eligibility, balance] = await Promise.all([
      checkEligibility(request.studentId),
      getBalance(request.studentId),
    ]);
    ```
    This applies to page components, query functions with multiple sub-queries, and anywhere multiple independent DB calls occur. The document detail page (`/staff/archive/documents/[id]`) was fixed for this pattern (2026-06-29).
11. **Blocking Cache Invalidation in Server Actions (Production Freeze):** Next.js 16's `updateTag()` (used by `forceUpdateTag` in `src/lib/cache/cache-tags.ts`) is a **BLOCKING operation** that can cause server actions to hang indefinitely in production Docker, leaving forms stuck on "Creating..." / "Marking Ready..." etc. The server action completes (DB writes succeed) but the response never reaches the client. **Use `invalidateTag()` (stale-while-revalidate, non-blocking) instead of `forceUpdateTag()` for server actions where the client handles page refresh via `router.refresh()`.** Similarly, avoid `revalidatePath()` in actions that need fast response times. Pattern:
    ```typescript
    // ❌ BAD: Blocks response (causes "Creating..." freeze)
    forceUpdateTag(CACHE_TAGS.DOCUMENT_REQUESTS);
    revalidatePath("/staff/archive/documents");
    return { success: true };

    // ✅ GOOD: Non-blocking (client calls router.refresh())
    invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);
    return { success: true };
    ```
    All document request actions (`createDocumentRequestAction`, `processDocumentRequestAction`, `readyDocumentRequestAction`, `releaseDocumentRequestAction`, `rejectDocumentRequestAction`, `cancelDocumentRequestAction`) were fixed for this pattern (2026-06-29).
12. **Cache Revalidation for `"use cache"` Queries:** When queries use the `"use cache"` directive with `cacheTag()`, calling only `invalidateTag()` may not update the UI instantly — users may need a hard refresh. **Add `revalidatePath()` before `invalidateTag()` for instant UI updates.** Pattern:
    ```typescript
    // ❌ BAD: UI doesn't update instantly (needs hard refresh)
    invalidateTag(CACHE_TAGS.SECTIONS);
    return { success: true };

    // ✅ GOOD: UI updates instantly (matches Fee Templates pattern)
    revalidatePath("/staff/academics/sections");
    invalidateTag(CACHE_TAGS.SECTIONS);
    return { success: true };
    ```
    The client component should still call `router.refresh()` in `onSuccess`. This pattern was validated in sections CRUD actions (2026-08-06).
13. **Turbopack Performance Measurement Bug (Next.js 16):** During development, you may see `Failed to execute 'measure' on 'Performance': '[PageName] [Prerender]' cannot have a negative time stamp`. This is a **harmless internal Turbopack bug** where the performance timing API calculates negative durations during prerendering. It does **not** affect functionality — pages render and work correctly. The `dynamic = "force-dynamic"` workaround is incompatible with `cacheComponents`, so simply ignore these console errors. This affects redirect-only pages like `StaffDashboardPage` most frequently. (Documented 2026-08-19.)

### Integration Points (Future)

- **Stripe:** Optional for online tuition payments (not yet implemented)
- **Google Sheets:** Backup/export only (not main database)
- **Gmail (Nodemailer):** Invoice sending via `src/lib/email/` (implementation in progress)
