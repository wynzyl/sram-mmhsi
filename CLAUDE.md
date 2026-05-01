# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SRAMS (School Registration and Accounts Monitoring System)** — A production-grade K-12 school management system for managing student enrollment, fee assessments, Official Receipt (OR) tracking, payment processing, and grade encoding.

**Stack:** Next.js 16 (App Router) · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · Zod 4 · React Hook Form · JWT (jose)

**Critical Business Feature:** Official Receipt (OR) booklet management is a first-class accounting control feature — every payment must consume a serialized OR number from an active booklet.

## Important Documentation References

- **AGENTS.md** — AI role definitions and system expectations
- **SRAMS_MVP.md** — System requirements and feature specifications
- **SRAMS_OR_WORKFLOW.md** — OR tracking workflow (MUST READ before modifying OR features)
- **PROJECT_ROADMAP.md** — Development roadmap and phases

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
- `/staff/*` — Teacher portal (grade encoding only)

Authentication is JWT-based using `jose` library (NOT NextAuth). Session management in `lib/auth/session.ts`:

- `requireSession()` — Throws redirect if unauthenticated (use in pages/layouts)
- `getCurrentUser()` — Returns user + role or null (use in server components)
- `createSession()` — Creates session on login
- `deleteSession()` — Logout

Middleware enforces role checks at route level.

### User Roles & Permissions

**Roles (via `roleEnum` in schema):**

- `admin` — Super user (full access)
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
1. `registrations` (status: pending → approved/rejected)
2. `enrollments` (status: pending → assessed → enrolled)
3. `feeSchedules` + `feeScheduleItems` (per grade level + school year)
4. `assessments` + `assessmentItems` (copied from fee schedule on enrollment)

**Payment & OR Tracking (Critical):**
1. `receiptBooklets` — OR booklet definition (series, start/end number, status)
2. `payments` — Payment record (linked to `bookletId` + `orNumber`)
3. `paymentAllocations` — Payment distribution across assessment items
4. OR lifecycle: available → consumed (or voided if payment voided)
5. Booklet status transitions: active → exhausted (when `nextNumber > endNumber`)

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
- `DataTable<T>` — Generic table with client-side search (all tables should use this)
- `StatusBadge` — Maps DB status enums to styled badges
- `CurrencyDisplay` — Formats amounts in PHP locale (en-PH)
- `ReferenceCode` — Displays student reference numbers

**Forms:**
- `FormField` — Form field wrapper with error display
- `FormSection` — Form section with heading
- `FormActions` — Form submit/cancel buttons

**Layout:**
- `PageHeader` — Page title + breadcrumb
- `PageContainer` — Page wrapper with consistent padding

**UI Primitives (Shadcn/ui-based):**
- `Button`, `Input`, `Card`, `Badge`, `Spinner`, `ThemeToggle`

All UI components use CSS custom properties for theming (deep red primary color, green accents).

### Rules (Non-Negotiable)

1. **Soft Delete Only:** Use `deletedAt` / `deletedBy` fields. Never hard delete.
2. **No Dashboards Before Logic:** Do not build overview/dashboard pages until core CRUD operations exist.
3. **RBAC at 3 Levels:** Route guard (middleware) + server action validation + audit logging.
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

**Server Action Pattern (mutations):**
```typescript
// actions/students.ts
"use server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { createStudentSchema } from "@/lib/validators/student";

export async function createStudent(data: unknown) {
  const session = await requireSession();

  // 1. Permission check
  if (!hasPermission(session.role, "students:create")) {
    throw new Error("Forbidden");
  }

  // 2. Validate input
  const parsed = createStudentSchema.parse(data);

  // 3. Business logic + DB write
  const [student] = await db.insert(students).values({
    ...parsed,
    createdBy: session.userId,
  }).returning();

  // 4. Audit log (if needed)
  await db.insert(auditLogs).values({
    actor: session.userId,
    action: "students:create",
    targetEntity: "students",
    targetId: student.id,
  });

  return { success: true, data: student };
}
```

**Client Component Pattern (form submission):**
```typescript
// components/students/StudentForm.tsx
"use client";
import { useForm } from "react-hook-form";
import { createStudent } from "@/actions/students";

export function StudentForm() {
  const form = useForm();

  async function onSubmit(data: unknown) {
    try {
      const result = await createStudent(data);
      // handle success
    } catch (error) {
      // handle error
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}
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

**E2E Tests:** Use Playwright for critical workflows (login, payment posting, grade encoding).

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
