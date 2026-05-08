# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SRAMS (School Registration and Accounts Monitoring System)** — A production-grade K-12 school management system for managing student enrollment, fee assessments, Official Receipt (OR) tracking, payment processing, and grade encoding.

**Stack:** Next.js 16 (App Router) · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · Zod 4 · React Hook Form · JWT (jose)

**Critical Business Feature:** Official Receipt (OR) booklet management is a first-class accounting control feature — every payment must consume a serialized OR number from an active booklet.

### Current Delivery Snapshot (2026-05-06)

**Core Features:**
- Core operations (auth, students, registrations queue, enrollments, assessments, payments/OR, invoices, grades) are implemented.
- Registration creation is integrated in student onboarding; dedicated intake/review actions are still pending.
- Portal currently has `/portal/dashboard`; portal detail pages (`/portal/assessments`, `/portal/payments`, `/portal/grades`) are pending.
- Authentication hardening still pending: login rate-limit integration and forced password-change gate.
- E2E Playwright test suite is not yet committed.

**Refactoring Status (2026-05-06):**
- ✅ **Phase 3.1 Complete:** All 11 action files use centralized `logAudit()` utility
- ✅ **Phase 3.2 Complete:** All 9 validator files use `BaseFormState` and common schemas
- ✅ **Phase 3.3 Partial:** 1/16 forms migrated, comprehensive migration guide created (`FORM-MIGRATION-GUIDE.md`)
- ✅ **Phase 3.4 Complete:** All duplicate button components replaced with `ConfirmActionButton`
- ✅ **Build & Tests:** TypeScript compiles with no errors, all 13 Vitest tests pass

## Important Documentation References

- **AGENTS.md** — AI role definitions and system expectations
- **SRAMS_MVP.md** — System requirements and feature specifications
- **SRAMS_OR_WORKFLOW.md** — OR tracking workflow (MUST READ before modifying OR features)
- **PROJECT_ROADMAP.md** — Development roadmap and phases
- **PROJECT_STATUS.md** — Current implementation status and active gaps

## Commands

```bash
# Development
npm run dev

# Database
npm run db:generate      # Generate migration from schema changes
npm run db:migrate       # Apply migrations
npm run db:push          # Push schema changes directly (use with caution)
npm run db:studio        # Launch Drizzle Studio

# Seeding
npm run db:seed          # Seed with sample data
npm run db:seed-config   # Seed system configuration only
npm run db:seed-teacher  # Seed teacher grade-encoding demo data

# Testing
npm run test             # Run unit tests (Vitest)
npm run test:watch       # Watch mode
npm run test:e2e         # End-to-end tests (Playwright)

# Build
npm run build
npm run lint
```

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/srams_db"
AUTH_SECRET="your-secret-key"
NODE_ENV="development"
```

## Architecture

### Core Design Principles

1. **Strict Layer Separation:** Business logic lives exclusively in server actions (`actions/*.ts`), data reads in queries, validation in Zod schemas (`lib/validators/*.ts`)
2. **OR Tracking is Mandatory:** Every payment transaction must be linked to an OR number from an active booklet
3. **Audit Everything Financial:** All payment posts, voids, and OR consumption must generate audit log entries
4. **Role-Based Access Control (RBAC):** Enforce at 3 levels — route guard, server action validation, and audit logging
5. **Soft Delete Only:** Use `deletedAt` / `deletedBy` fields — never hard delete records

### Layer Boundaries (Non-Negotiable)

| Layer             | Location              | Responsibility                                    | Rules                                               |
| ----------------- | --------------------- | ------------------------------------------------- | --------------------------------------------------- |
| Server Actions    | `actions/*.ts`        | ALL business logic and DB writes                  | Must use `"use server"` directive                   |
| Zod Schemas       | `lib/validators/*.ts` | Single source of truth for all data shapes        | Export schemas AND TypeScript types                 |
| Utility Functions | `lib/utils/*.ts`      | Pure transformations only (format, compute, etc.) | No database calls, no business logic                |
| Client Components | `components/**/*.tsx` | UI state and form interactions only               | No direct DB access, no business logic              |
| Auth & Sessions   | `lib/auth/*.ts`       | JWT-based session management                      | Use `requireSession()` in server components & pages |

**Violations:** No business logic in `.tsx` files. No direct DB calls in components. No raw SQL outside actions.

### Routing & Authentication

Route structure (App Router):

- `/login` — Public login page
- `/admin/*` — Admin portal (full access)
- `/staff/*` — Internal operations portal for registrar/finance/cashier/teacher role flows
- `/portal/*` — Student/parent portal (dashboard scaffold currently implemented)

Authentication is JWT-based using `jose` library (NOT NextAuth). Session management in `lib/auth/session.ts`:

- `requireSession()` — Throws redirect if unauthenticated (use in pages/layouts)
- `getCurrentUser()` — Returns user + role or null (use in server components)
- `createSession()` — Creates session on login
- `deleteSession()` — Logout

Root route protection lives in `proxy.ts` (export `proxy`): unauthenticated redirects, staff vs portal separation, and `/admin` restrictions. **Next.js 16** renamed the former `middleware.ts` convention to `proxy.ts`; older writeups may still say “middleware.”

### User Roles & Permissions

**Roles (via `roleEnum` in schema):**
- `super_admin` - Manages system setup, users, roles, database-related settings.
- `admin` —  Can view and access all business operations and reports
- `registrar` — Student records & enrollment management
- `finance_officer` — Fee schedules, assessments, invoices, OR booklet setup
- `cashier` — Payment posting only
- `teacher` — Grade encoding only
- `student` — View own assessments, payments, grades
- `parent_guardian` — View linked student's assessments, payments, grades

**Permission checks:** Use `hasPermission(role, permission)` from `lib/rbac/permissions.ts` in server actions before executing sensitive operations.

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
1. `registrations` (approved records currently created during student onboarding; dedicated review actions pending)
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
   - Only one booklet can be "active" for a cashier at a time
   - Booklet status: `active` | `exhausted` | `voided`

2. **Payment Posting:**
   - Cashier selects active booklet before posting
   - System auto-assigns next sequential OR number (e.g., AP-00001)
   - OR status: `available` → `consumed` (immutable)
   - Payment status: `pending_confirmation` → `posted`

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
- Schema: `lib/db/schema.ts` (tables: `receiptBooklets`, `payments`)
- Actions: `actions/cashier.ts` (payment posting logic)
- Validators: `lib/validators/cashier.ts`

### Grade Encoding Workflow

**Grade Lifecycle:**
1. Admin assigns teacher to subject + section via `teacherAssignments`
2. Teacher encodes grades per student per grading period (Q1–Q4)
3. Grade status: `draft` → `submitted` → `locked`
4. Once `locked`, grades are immutable (admin-only unlock)

**Grading Periods:** Q1, Q2, Q3, Q4 (hardcoded in system)

**Related Files:**
- Schema: `gradeRecords`, `teacherAssignments`
- Actions: `actions/teacher.ts` (encode/submit), `actions/academics.ts` (assign/lock)
- Components: `components/academics/GradeEncodingTable.tsx`

### Reusable Components

**Data Display:**
- `DataTable<t>` — tanstack table 
- `StatusBadge` — Maps DB status enums to styled badges
- `CurrencyDisplay` — Formats amounts in PHP locale (en-PH)
- `ReferenceCode` — Displays student reference numbers

**Forms (Refactored - Phase 3.2/3.3):**
- `FormStateAlert` — **USE THIS** for all error/success messages (replaces manual alert blocks)
- `TextInputField` — Controlled text input with error display
- `SelectField` — Controlled select dropdown with error display
- `CurrencyInputField` — Currency input with PHP formatting
- `FormField` — Legacy form field wrapper (migrate to above)
- `FormSection` — Form section with heading
- `FormActions` — Form submit/cancel buttons

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
import { logAudit } from "@/lib/utils/audit-logger";  // ✅ Phase 3.1: Use centralized audit
import { db } from "@/lib/db";
import { createStudentSchema } from "@/lib/validators/student";
import type { CreateStudentFormState } from "@/lib/validators/student";  // ✅ Phase 3.2: BaseFormState

export async function createStudent(
  _prevState: CreateStudentFormState,
  formData: FormData
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
  const [student] = await db.insert(students).values({
    ...parsed,
    createdBy: session.userId,
  }).returning();

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

**Client Component Pattern (form submission) - REFACTORED:**
```typescript
// components/students/StudentForm.tsx
"use client";
import { useActionState } from "react";
import { createStudent } from "@/actions/students";
import { FormStateAlert } from "@/components/forms/FormStateAlert";  // ✅ Phase 3.3
import { TextInputField } from "@/components/forms/TextInputField";

export function StudentForm() {
  const [state, action, isPending] = useActionState(createStudent, {});

  return (
    <form action={action}>
      <FormStateAlert state={state} />  {/* ✅ Replaces manual alert blocks */}

      <TextInputField
        label="First Name"
        name="firstName"
        required
        value={firstName}
        onChange={setFirstName}
        error={state.errors?.firstName}
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
// lib/validators/student.ts
import { z } from "zod";
import {
  nameSchema,
  emailSchema,
  phoneSchema,
  type BaseFormState,  // ✅ Use shared base type
} from "./common-schemas";

export const CreateStudentSchema = z.object({
  firstName: nameSchema,        // ✅ Use common schemas
  middleName: z.string().trim().optional(),
  lastName: nameSchema.toUpperCase(),
  email: emailSchema,           // ✅ Reusable validation
  mobileNumber: phoneSchema,    // ✅ Reusable validation
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

// ✅ Extend BaseFormState instead of redefining
export type CreateStudentFormState = BaseFormState<CreateStudentInput> & {
  studentId?: string;  // Additional fields beyond base
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

### Reference Number Generation

Use `lib/utils/reference.ts` for generating student reference numbers:

```typescript
import { generateStudentReference } from "@/lib/utils/reference";

const referenceNumber = await generateStudentReference(); // e.g., "STU-2024-00001"
```

### Currency Formatting

Always use `CurrencyDisplay` component or format manually with `en-PH` locale:

```typescript
// In component
<CurrencyDisplay amount={1500.00} />

// In utility
new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(1500);
```

### Testing

**Unit Tests:** Use Vitest for utility functions and schema validation.

**E2E Tests:** Playwright is configured as target tooling, but the committed end-to-end suite is still pending.

**Test Commands:**
- `npm run test` — Run all unit tests
- `npm run test:watch` — Watch mode for TDD
- `npm run test:e2e` — Run Playwright tests

### Migrations

**Workflow:**
1. Modify `lib/db/schema.ts`
2. Run `npm run db:generate` — Creates migration file in `drizzle/`
3. Review generated SQL in `drizzle/*.sql`
4. Run `npm run db:migrate` — Applies migration to database
5. Commit both schema changes AND migration files

### Rule

Create migration files with clear, human-readable, descriptive filenames; avoid fancy or non-descriptive names.

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

### Integration Points (Future)

- **Stripe:** Optional for online tuition payments (not yet implemented)
- **Google Sheets:** Backup/export only (not main database)
- **Gmail (Nodemailer):** Invoice sending via `lib/email/` (implementation in progress)
