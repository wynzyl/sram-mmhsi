# SRAMS Architecture Documentation

> **SRAMS (School Registration and Accounts Monitoring System)** — A production-grade K-12 school management system for managing student enrollment, fee assessments, Official Receipt (OR) tracking, payment processing, and grade encoding.

This document captures the architectural patterns, best practices, and gotchas for the SRAMS project. It serves as a reference for developers working on the codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Feature-Based Architecture](#2-feature-based-architecture)
3. [Layer Boundaries](#3-layer-boundaries-non-negotiable)
4. [Database Patterns](#4-database-patterns)
5. [Server Action Pattern](#5-server-action-pattern)
6. [Query Patterns](#6-query-patterns)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Form Patterns](#8-form-patterns)
9. [Reusable Components Reference](#9-reusable-components-reference)
10. [Constants Pattern](#10-constants-pattern)
11. [Report Generation Pattern](#11-report-generation-pattern)
12. [Gotchas & Common Pitfalls](#12-gotchas--common-pitfalls)
13. [Testing Patterns](#13-testing-patterns)
14. [Migration Workflow](#14-migration-workflow)

---

## 1. Project Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS 4 |
| Validation | Zod 4 |
| Forms | React 19 `useActionState` + Server Actions |
| Auth | JWT via `jose` library |
| UI Components | shadcn/ui |
| Data Fetching | TanStack Query (client), Server Components (server) |
| Tables | TanStack Table |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Browser                                                                 │
│  ├── React 19 Client Components (UI state, forms)                       │
│  ├── TanStack Query (client-side data fetching/caching)                 │
│  └── TanStack Table (table logic: sorting, filtering, pagination)       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Server Layer                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js App Router                                                      │
│  ├── proxy.ts (route protection, auth redirects)                        │
│  ├── Server Components (data fetching, rendering)                       │
│  ├── Server Actions (mutations, business logic)                         │
│  └── Route Handlers (API endpoints, report exports)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Data Layer                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Drizzle ORM                                                             │
│  ├── Schema definitions (src/lib/db/schema.ts)                          │
│  ├── Query functions (*.queries.ts)                                     │
│  └── Transactions (db.transaction())                                    │
│                                                                          │
│  PostgreSQL                                                              │
│  ├── Tables, indexes, constraints                                       │
│  ├── Enums (from TypeScript constants)                                  │
│  └── Sequences (student_ref_seq)                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── (auth)/               # Public auth routes (login)
│   ├── admin/                # Admin-only routes
│   ├── staff/                # Staff portal routes
│   ├── portal/               # Student/parent portal routes
│   └── page-templates/       # Reusable page components
├── components/               # Shared UI components
├── features/                 # Feature-based modules (primary)
│   ├── academics/            # Grades, sections, curriculums
│   ├── assessments/          # Fee assessments
│   ├── auth/                 # Authentication
│   ├── documents/            # Document requests
│   ├── enrollments/          # Enrollment management
│   ├── finance/              # Invoices, fee templates
│   ├── payments/             # Payment posting
│   ├── registrations/        # Student registration
│   ├── reports/              # Report generation
│   ├── students/             # Student management
│   └── users/                # User management
├── hooks/                    # Custom React hooks
├── lib/                      # Shared utilities & infrastructure
│   ├── auth/                 # JWT session management
│   ├── cache/                # Cache tag definitions
│   ├── constants/            # System constants
│   ├── db/                   # Database schema & connection
│   ├── rbac/                 # Role-based access control
│   ├── utils/                # Pure utility functions
│   └── validators/           # Shared Zod schemas
└── styles/                   # Global styles
```

---

## 2. Feature-Based Architecture

### Organization Pattern

Code is organized by **domain feature** in `src/features/`. Each feature module is self-contained with co-located files:

```
src/features/<feature-name>/
├── index.ts                  # Barrel export
├── <feature>.actions.ts      # Server actions (mutations)
├── <feature>.schema.ts       # Zod schemas + form state types
├── <feature>.queries.ts      # Database queries
├── <feature>.utils.ts        # Feature-specific utilities
└── components/               # Feature UI components
    ├── <Component>.tsx
    └── ...
```

### Example: Students Feature

```
src/features/students/
├── index.ts
├── students.actions.ts       # createStudentAction, updateStudentAction
├── students.schema.ts        # CreateStudentSchema, UpdateStudentSchema
├── students.queries.ts       # fetchStudentDirectoryPage, getStudentById
├── students.utils.ts         # buildCreateStudentFormSnapshot
├── students-photo.schema.ts  # Photo upload schemas
└── components/
    ├── StudentForm.tsx
    ├── StudentAvatar.tsx
    └── ...
```

### Feature Encapsulation Rules

1. **Co-location**: Actions, schemas, queries, and components for a feature live together
2. **Barrel Exports**: Each feature has an `index.ts` for clean imports
3. **No Cross-Feature DB Access**: Features should not directly query other features' tables; use queries instead
4. **Shared Code in `src/lib/`**: Infrastructure code (auth, db, utils) stays in lib

### When to Use `src/lib/` vs `src/features/`

| Location | Use For |
|----------|---------|
| `src/lib/validators/` | **Shared schemas** used across multiple features (common-schemas, intake-documents) |
| `src/lib/constants/` | **System configuration** (roles, assessment bands, grading periods) |
| `src/lib/utils/` | **Pure functions** (formatters, calculators, generators) |
| `src/lib/auth/` | **Authentication** (session management, JWT handling) |
| `src/lib/rbac/` | **Authorization** (permissions, role checks) |
| `src/features/*/` | **Feature-specific** schemas, actions, queries, components |

---

## 3. Layer Boundaries (Non-Negotiable)

Each layer has a specific responsibility. Violations break maintainability and testability.

| Layer | Location | Responsibility | Rules |
|-------|----------|----------------|-------|
| **Server Actions** | `src/features/*/*.actions.ts` | ALL business logic and DB writes | Must use `"use server"` directive |
| **Zod Schemas** | `src/features/*/*.schema.ts` or `src/lib/validators/*.ts` | Data validation and type definitions | Shared schemas in lib, feature-specific in features |
| **Server Queries** | `src/features/*/*.queries.ts` | ALL database reads | Server-only, passed as props to components |
| **Utility Functions** | `src/lib/utils/*.ts` | Pure transformations only | No database calls, no business logic |
| **Client Components** | `src/features/*/components/*.tsx` | UI state and form interactions | No direct DB access, no business logic |
| **Auth & Sessions** | `src/lib/auth/*.ts` | JWT-based session management | Use `requireSession()` in server components |
| **Page Templates** | `src/app/page-templates/` | Reusable page components | Server components that compose features |

### Violations to Avoid

```typescript
// ❌ BAD: Business logic in component
function StudentForm({ student }) {
  const handleSubmit = async () => {
    // Don't do this - business logic belongs in server action
    await db.insert(students).values({ ...formData });
  };
}

// ❌ BAD: Direct DB call in component
function StudentList() {
  const students = await db.query.students.findMany(); // Wrong!
}

// ❌ BAD: Raw SQL in route handler
export async function GET() {
  const result = await sql`SELECT * FROM students`; // Use query functions
}
```

```typescript
// ✅ GOOD: Component receives data as props
async function StudentsPage() {
  const students = await fetchStudents(); // Query function
  return <StudentList students={students} />;
}

// ✅ GOOD: Mutation via server action
"use server";
export async function createStudentAction(formData: FormData) {
  // All business logic here
}
```

---

## 4. Database Patterns

### Drizzle ORM Conventions

**Schema Location**: `src/lib/db/schema.ts`

**Table Definitions:**

```typescript
import { pgTable, uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  referenceNumber: varchar("reference_number", { length: 7 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),

  // Soft delete fields (MANDATORY)
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id),

  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),

  // Status fields
  isActive: boolean("is_active").default(true).notNull(),
});
```

### Soft Delete Pattern (Non-Negotiable)

**NEVER hard delete records.** Use `deletedAt` / `deletedBy` fields.

```typescript
// ❌ BAD: Hard delete
await db.delete(students).where(eq(students.id, id));

// ✅ GOOD: Soft delete
await db.update(students).set({
  deletedAt: new Date(),
  deletedBy: session.userId,
}).where(eq(students.id, id));
```

**Query Active Records Only:**

```typescript
// Always filter for non-deleted records
const activeStudents = await db.query.students.findMany({
  where: isNull(students.deletedAt),
});
```

### PostgreSQL Enums from Constants

Define constants first, then create PostgreSQL enums:

```typescript
// src/lib/constants/roles.ts
export const ROLES = [
  "super_admin", "admin", "registrar", "finance_officer",
  "cashier", "teacher", "student", "parent_guardian"
] as const;

export type Role = (typeof ROLES)[number];

// src/lib/db/schema.ts
import { ROLES } from "@/lib/constants/roles";

export const roleEnum = pgEnum("role", ROLES);

export const users = pgTable("users", {
  role: roleEnum("role").notNull(),
});
```

### Relationship Definitions

```typescript
export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  enrollments: many(enrollments),
  guardianLinks: many(studentGuardianLinks),
}));
```

### Index Strategies

```typescript
// Add indexes for frequently queried columns
export const students = pgTable("students", {
  // ... columns
}, (table) => ({
  referenceNumberIdx: uniqueIndex("students_reference_number_idx")
    .on(table.referenceNumber),
  statusIdx: index("students_status_idx")
    .on(table.status),
  // Composite index for archive queries
  archiveIdx: index("students_archive_idx")
    .on(table.status, table.deletedAt),
}));
```

---

## 5. Server Action Pattern

### Standard Structure

Every server action follows this sequence:

```
Auth → Permission → Validate → Execute → Audit → Cache Invalidate → Return
```

```typescript
// src/features/students/students.actions.ts
"use server";

import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction } from "@/lib/utils/audit-logger";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { CreateStudentSchema, type CreateStudentFormState } from "./students.schema";

export async function createStudentAction(
  _prevState: CreateStudentFormState,
  formData: FormData
): Promise<CreateStudentFormState> {
  // 1. Authentication
  const session = await requireSession();

  // 2. Permission Check
  if (!hasPermission(session.role, "students:create")) {
    return { message: "You do not have permission to create students." };
  }

  // 3. Validation
  const parsed = CreateStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    // ... other fields
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // 4. Execute Business Logic
  const [student] = await db.insert(students).values({
    ...parsed.data,
    createdBy: session.userId,
  }).returning();

  // 5. Audit Log (for financial/sensitive operations)
  await logCreateAction({
    actor: session.userId,
    actorRole: session.role,
    action: "students:create",
    targetEntity: "students",
    targetId: student.id,
    newState: { studentRef: student.referenceNumber },
  });

  // 6. Cache Invalidation (UI updates instantly)
  revalidatePath("/staff/students");
  invalidateTag(CACHE_TAGS.DASHBOARD);

  // 7. Return Result
  return { success: true, studentId: student.id };
}
```

### Transaction Pattern

For multi-table operations, use transactions:

```typescript
import { db } from "@/lib/db";

export async function createEnrollmentWithAssessment(data: EnrollmentData) {
  return await db.transaction(async (tx) => {
    // All operations in this block use the same transaction
    const [enrollment] = await tx.insert(enrollments).values({
      studentId: data.studentId,
      schoolYearId: data.schoolYearId,
    }).returning();

    const [assessment] = await tx.insert(assessments).values({
      enrollmentId: enrollment.id,
      totalAmount: data.totalAmount,
    }).returning();

    // If any operation fails, all are rolled back
    return { enrollment, assessment };
  });
}
```

### Pessimistic Locking

For concurrent access scenarios:

```typescript
// src/lib/db/tx-helpers.ts
export async function withPessimisticLock<T>(
  tx: typeof db,
  table: string,
  id: string,
  callback: () => Promise<T>
): Promise<T> {
  await tx.execute(sql`SELECT * FROM ${sql.raw(table)} WHERE id = ${id} FOR UPDATE`);
  return callback();
}
```

### Form State Return Pattern

```typescript
// BaseFormState from src/lib/validators/common-schemas.ts
export type BaseFormState<TInput = Record<string, unknown>> = {
  errors?: Partial<Record<keyof TInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// Extended form state with additional fields
export type CreateStudentFormState = BaseFormState<CreateStudentInput> & {
  studentId?: string;
  fieldValues?: CreateStudentFormFieldSnapshot;
};
```

---

## 6. Query Patterns

### Server-Only Directive

All query files must include the server-only directive:

```typescript
// src/features/students/students.queries.ts
import "server-only";
import { db } from "@/lib/db";
```

### Parallel Query Execution

**Always use `Promise.all()` for independent queries:**

```typescript
// ❌ BAD: Sequential queries (200ms+ total)
const student = await getStudentById(id);
const eligibility = await checkEligibility(student.id);
const balance = await getBalance(student.id);

// ✅ GOOD: Parallel queries (50ms total)
const student = await getStudentById(id);
const [eligibility, balance] = await Promise.all([
  checkEligibility(student.id),
  getBalance(student.id),
]);
```

### Pagination Pattern

```typescript
import { calculateOffset } from "@/lib/utils/pagination";

export async function fetchStudentPage(params: {
  page: number;
  pageSize: number;
  query?: string;
}) {
  const offset = calculateOffset(params.page, params.pageSize);

  const [rows, countResult] = await Promise.all([
    db.select().from(students)
      .where(/* conditions */)
      .limit(params.pageSize)
      .offset(offset)
      .orderBy(asc(students.lastName)),

    db.select({ count: sql<number>`count(*)` })
      .from(students)
      .where(/* same conditions */),
  ]);

  return {
    rows,
    totalCount: countResult[0].count,
    totalPages: Math.ceil(countResult[0].count / params.pageSize),
    currentPage: params.page,
  };
}
```

### Cache Directives

```typescript
import { cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";

export async function getDashboardMetrics() {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);

  return await db.query.enrollments.findMany(/* ... */);
}
```

### Filter Condition Building

```typescript
export function buildStudentSearchCondition(query: string): SQL | undefined {
  if (!query.trim()) return undefined;

  const searchTerm = `%${query.trim()}%`;
  return or(
    ilike(students.firstName, searchTerm),
    ilike(students.lastName, searchTerm),
    ilike(students.referenceNumber, searchTerm),
  );
}
```

---

## 7. Authentication & Authorization

### JWT-Based Sessions

Authentication uses `jose` library (NOT NextAuth). Session management is in `src/lib/auth/session.ts`.

**Key Functions:**

| Function | Use Case |
|----------|----------|
| `requireSession()` | Throws redirect if unauthenticated. Use in pages/layouts. |
| `getCurrentUser()` | Returns user + role or null. Use in server components. |
| `createSession(userId, role)` | Creates session on login. |
| `deleteSession()` | Logout. |
| `renewSession()` | Extends session expiry. Use sparingly. |

### Usage in Pages

```typescript
// src/app/staff/students/page.tsx
import { requireSession } from "@/lib/auth/session";

export default async function StudentsPage() {
  const session = await requireSession(); // Redirects if not logged in

  // Session is guaranteed to exist here
  return <StudentList userId={session.userId} />;
}
```

### RBAC at 3 Levels (Non-Negotiable)

Security is enforced at three levels:

1. **Route Guard** (`proxy.ts`): Blocks unauthenticated access
2. **Server Action Validation**: Checks permissions before executing
3. **Audit Logging**: Records all sensitive operations

```typescript
// Level 1: proxy.ts (route protection)
// Handled automatically by Next.js proxy

// Level 2: Server action permission check
export async function createStudentAction(formData: FormData) {
  const session = await requireSession();

  if (!hasPermission(session.role, "students:create")) {
    return { message: "Permission denied." };
  }

  // ... action logic

  // Level 3: Audit log
  await logCreateAction({
    actor: session.userId,
    action: "students:create",
    // ...
  });
}
```

### Permission Matrix

```typescript
// src/lib/rbac/permissions.ts
type Permission =
  | "students:read" | "students:create" | "students:update" | "students:delete"
  | "enrollments:read" | "enrollments:create" | "enrollments:confirm"
  | "payments:read" | "payments:post" | "payments:void_request"
  | "grades:read" | "grades:encode" | "grades:submit"
  // ... etc

const PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [/* all permissions */],
  admin: [/* most permissions */],
  registrar: ["students:read", "students:create", "enrollments:read", /* ... */],
  cashier: ["payments:read", "payments:post", /* ... */],
  teacher: ["grades:read", "grades:encode", "grades:submit"],
  // ...
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}
```

---

## 8. Form Patterns

### React 19 `useActionState` + Native Forms

The default pattern uses React 19's `useActionState` with native HTML forms:

```typescript
// Client component
"use client";
import { useActionState } from "react";
import { useFormToast } from "@/hooks/useFormToast";
import { createStudentAction } from "./students.actions";

export function StudentForm() {
  const [state, action, isPending] = useActionState(createStudentAction, {});

  // Toast for form-level success/errors
  useFormToast(state, {
    successMessage: "Student created successfully",
    onSuccess: () => router.push(`/staff/students/${state.studentId}`),
  });

  return (
    <form action={action}>
      <TextInputField
        label="First Name"
        name="firstName"
        required
        error={state.errors?.firstName}  // Inline field error
      />

      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

### Reusable Form Components

| Component | Purpose |
|-----------|---------|
| `TextInputField` | Text input with label and inline error |
| `SelectField` | Select dropdown with label and error |
| `CurrencyInputField` | PHP currency input with formatting |
| `FormSection` | Form section with heading |
| `FormActions` | Submit/cancel button group |

### Toast Pattern (Field vs Form Errors)

- **Field errors**: Keep inline below form fields (better UX for validation)
- **Form-level errors/success**: Use toast notifications (non-blocking)

```typescript
import { useFormToast } from "@/hooks/useFormToast";

// In component:
useFormToast(state, {
  successMessage: "Operation completed",
  onSuccess: () => router.refresh(),
});
```

### TanStack Form for Complex Wizards

Use TanStack Form only for complex multi-step wizards or field arrays:

```typescript
// src/features/registrations/components/StudentRegistrationForm.tsx
import { useForm } from "@tanstack/react-form";

// Used for: 4-step wizard with guardian field array
// Simple forms stay native (progressive enhancement)
```

---

## 9. Reusable Components Reference

### Data Display

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataTable<T>` | `src/components/ui/data-table.tsx` | TanStack Table wrapper with pagination |
| `StatusBadge` | `src/components/shared/StatusBadge.tsx` | Maps status enums to styled badges |
| `CurrencyDisplay` | `src/components/shared/CurrencyDisplay.tsx` | PHP currency formatting |
| `ReferenceCode` | `src/components/shared/ReferenceCode.tsx` | Student reference number display |

### Confirmation Actions

```typescript
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";

<InlineConfirmButton
  action={deleteSubjectAction}
  confirmMessage="Are you sure you want to delete this subject?"
  hiddenFields={{ subjectId: subject.id }}
  label="Delete"
  loadingLabel="Deleting..."
  variant="danger"
/>
```

### Layout Components

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Page title with breadcrumb |
| `PageContainer` | Page wrapper with consistent padding |
| `Card`, `Button`, `Badge` | shadcn/ui primitives |

---

## 10. Constants Pattern

### When to Use Constants vs Database Tables

| Aspect | Constants | Database Tables |
|--------|-----------|-----------------|
| **Use for** | System configuration (roles, assessment bands) | User-managed data |
| **Change frequency** | Rarely (requires deployment) | Frequently (via UI) |
| **Type safety** | Compile-time validation | Runtime only |
| **Performance** | No queries needed | Requires DB queries |
| **Examples** | Roles, grading periods, blood types | Students, payments |

### Pattern: Constants + PostgreSQL Enum

```typescript
// 1. Define constant array with const assertion
// src/lib/constants/grading-periods.ts
export const GRADING_PERIODS = ["Q1", "Q2", "Q3", "Q4"] as const;

// 2. Derive TypeScript type
export type GradingPeriod = (typeof GRADING_PERIODS)[number];

// 3. Provide human-readable labels
export const GRADING_PERIOD_LABELS: Record<GradingPeriod, string> = {
  Q1: "First Quarter",
  Q2: "Second Quarter",
  Q3: "Third Quarter",
  Q4: "Fourth Quarter",
};

// 4. Create PostgreSQL enum in schema
// src/lib/db/schema.ts
export const gradingPeriodEnum = pgEnum("grading_period", GRADING_PERIODS);

export const gradeRecords = pgTable("grade_records", {
  gradingPeriod: gradingPeriodEnum("grading_period").notNull(),
});
```

### Normalized Storage Pattern

Store values once, access via relationships:

```typescript
// ✅ GOOD: Single source of truth
// Grade level has assessment_band
// Access via: assessment → enrollment → gradeLevel.assessmentBand

const assessment = await db.query.assessments.findFirst({
  with: {
    enrollment: {
      with: { gradeLevel: true },
    },
  },
});
const band = assessment.enrollment.gradeLevel.assessmentBand;

// ❌ BAD: Duplicated data (must keep in sync)
// Both gradeLevel AND assessment have assessment_band
```

---

## 11. Report Generation Pattern

All reports follow a **two-track standard** built on `src/features/reports/shared/`.

### Track 1: Official Documents (PDF)

Use `@react-pdf/renderer` for presentation-grade artifacts:

- Invoices, receipts, official letters
- Server-rendered via `renderToBuffer` in route handler

### Track 2: Analytical Reports (XLSX)

Use `exceljs` for tabular finance data:

- Payment Collection, Balance Forward, ledgers
- Usually paired with a Track-1 PDF

### Route Handler Convention

Every export is a route handler at `…/<name>/export?format=pdf|xlsx`:

```typescript
// src/app/staff/reports/payment-collection/export/route.ts
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { pdfResponse, xlsxResponse, parseReportFormat } from "@/features/reports/shared";
import { logReportExport } from "@/features/reports/shared/audit-report";

export async function GET(request: Request) {
  // 1. Auth check
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "reports:view")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse format
  const { searchParams } = new URL(request.url);
  const format = parseReportFormat(searchParams.get("format"));

  // 3. Generate report
  const data = await fetchReportData(/* filters */);

  // 4. Audit log
  await logReportExport({
    actor: user.id,
    report: "payment-collection",
    format,
    rowCount: data.length,
  });

  // 5. Return response
  if (format === "pdf") {
    return pdfResponse(await renderReport(data), "payment-collection.pdf");
  }
  return xlsxResponse(await buildWorkbook(data), "payment-collection.xlsx");
}
```

### Shared Module (`src/features/reports/shared/`)

| File | Purpose |
|------|---------|
| `report-format.ts` | `pesoText()`, `reportDate()`, `reportDateTime()` |
| `pdf-fonts.ts` | `registerReportFonts()` for ₱ character |
| `pdf-primitives.tsx` | `TabularReportDocument<T>`, `Letterhead`, `ReportColumn<T>` |
| `xlsx-report.ts` | `buildReportWorkbook()` |
| `report-response.ts` | `pdfResponse()`, `xlsxResponse()`, `parseReportFormat()` |
| `report-request.ts` | `parseReportDateRange()`, `reportFilename()` |
| `audit-report.ts` | `logReportExport()` |

---

## 12. Gotchas & Common Pitfalls

### 1. Date Hydration Mismatch (Timezone)

**Problem**: Server (UTC) and client (Asia/Manila) format dates differently, causing React hydration errors.

```typescript
// ❌ BAD: Causes hydration mismatch
new Date(timestamp).toLocaleDateString("en-PH")

// ✅ GOOD: Use utility functions that pin timezone
import { formatDate, formatDateTime } from "@/lib/utils/date";
formatDate(timestamp)  // Always Asia/Manila
```

**Symptom**: "server rendered text didn't match the client" error, UI freeze/infinite re-render.

### 2. Session Cookie over HTTP (LAN Production)

**Problem**: Browsers drop `Secure` cookies on non-HTTPS origins.

**Solution**: Set `SESSION_COOKIE_SECURE=false` in `.env.production` for LAN deployments without TLS.

### 3. Photo Upload in Docker

Four layers must align:

1. **Nginx**: `client_max_body_size 5M`
2. **Next.js**: `experimental.serverActions.bodySizeLimit: '3mb'`
3. **Volume permissions**: `chown nextjs:nextjs /app/public/uploads`
4. **Static serving**: Nginx serves `/uploads/*` directly (Next.js doesn't serve runtime uploads)
5. **Image optimization**: Use `unoptimized` prop on `<Image>` for uploaded photos

### 4. Parallel DB Queries in Server Components

```typescript
// ❌ BAD: Sequential (200ms)
const a = await queryA();
const b = await queryB();

// ✅ GOOD: Parallel (50ms)
const [a, b] = await Promise.all([queryA(), queryB()]);
```

### 5. Blocking Cache Invalidation

**Problem**: `forceUpdateTag()` is blocking and can freeze server actions.

```typescript
// ❌ BAD: Blocks response
forceUpdateTag(CACHE_TAGS.DOCUMENT_REQUESTS);
revalidatePath("/staff/archive/documents");
return { success: true };

// ✅ GOOD: Non-blocking (client calls router.refresh())
invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);
return { success: true };
```

### 6. Cache Revalidation for `"use cache"` Queries

**Problem**: `invalidateTag()` alone may not update UI instantly.

```typescript
// ✅ GOOD: Instant UI updates
revalidatePath("/staff/academics/sections");
invalidateTag(CACHE_TAGS.SECTIONS);
return { success: true };
```

### 7. OR Number Immutability

Once consumed, OR numbers **cannot be reused** even if payment is voided. Voided payments mark OR as `voided` but do not return to pool.

### 8. Soft Delete Filter Requirements

**Always** include `deletedAt IS NULL` in queries:

```typescript
const activeRecords = await db.query.students.findMany({
  where: isNull(students.deletedAt),
});
```

### 9. Booklet Exhaustion

When `nextNumber > endNumber`, automatically mark booklet as `exhausted` and require new booklet selection.

### 10. Grade Locking

- Locked grades (`status: 'approved'`) can only be unlocked by admin role
- Sequential period locking: Q2 cannot be submitted until Q1 is approved

### 11. Session Renewal

Use `renewSession()` sparingly — only on critical user actions. Excessive renewal creates unnecessary DB writes.

### 12. Unique Constraints

Respect unique indexes:
- Student reference number
- OR number (payments)
- Invoice number
- Email (users)

---

## 13. Testing Patterns

### Unit Tests (Vitest)

```bash
npm run test        # Run all tests
npm run test:watch  # Watch mode for TDD
```

Test utilities and schema validation:

```typescript
// src/lib/utils/__tests__/currency.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency } from "../currency";

describe("formatCurrency", () => {
  it("formats PHP currency correctly", () => {
    expect(formatCurrency(1500)).toBe("₱1,500.00");
  });
});
```

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

Test organization:

```
tests/
├── e2e/
│   ├── auth.spec.ts
│   ├── students.spec.ts
│   └── payments.spec.ts
└── fixtures/
    └── test-data.ts
```

---

## 14. Migration Workflow

### Step-by-Step Process

1. **Modify schema**: `src/lib/db/schema.ts`
2. **Generate migration**: `npm run db:generate --name=descriptive_name`
3. **Review SQL**: Check `drizzle/*.sql`
4. **Apply migration**: `npm run db:migrate`
5. **Commit both**: Schema changes AND migration files

### Migration Naming (Non-Negotiable)

```bash
# ✅ GOOD: Descriptive names
npm run db:generate --name=add_student_lrn_field
npm run db:generate --name=create_payment_allocations_table
npm run db:generate --name=add_archive_indexes

# ❌ BAD: Auto-generated random names
npm run db:generate  # Generates "rich_gamora" or similar
```

### Important Rules

- **Never** use `db:push` in production
- **Always** use migrations for traceability
- Migration files are immutable once deployed
- Test migrations on staging before production

### Seeding

```bash
# System configuration (school years, grade levels, admin user)
npm run db:seed-config

# Sample data for testing
npm run db:seed
```

---

## Quick Reference

### Essential Commands

```bash
npm run dev           # Development server
npm run build         # Production build
npm run lint          # Run linter
npm run test          # Unit tests
npm run test:e2e      # E2E tests
npm run db:generate   # Generate migration
npm run db:migrate    # Apply migrations
npm run db:seed-config # Seed system config
```

### Key Files

| Purpose | Location |
|---------|----------|
| Database schema | `src/lib/db/schema.ts` |
| Session management | `src/lib/auth/session.ts` |
| Permissions | `src/lib/rbac/permissions.ts` |
| Cache tags | `src/lib/cache/cache-tags.ts` |
| Common schemas | `src/lib/validators/common-schemas.ts` |
| Route protection | `proxy.ts` |

### Documentation References

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | AI assistant instructions |
| `AGENTS.md` | AI role definitions |
| `SRAMS_MVP.md` | System requirements |
| `SRAMS_OR_WORKFLOW.md` | OR tracking workflow |
| `PROJECT_ROADMAP.md` | Development roadmap |
| `docs/SECURITY.md` | Security guidelines |
