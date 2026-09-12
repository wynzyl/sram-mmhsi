# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**SRAMS (School Registration and Accounts Monitoring System)** — A production-grade K-12 school management system for managing student enrollment, fee assessments, Official Receipt (OR) tracking, payment processing, and grade encoding.

**Stack:** Next.js 16 (App Router) · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · Zod 4 · React 19 `useActionState` + Server Actions · JWT (jose)

**Critical Business Feature:** Official Receipt (OR) booklet management — every payment must consume a serialized OR number from an active booklet.

## Commands

```bash
npm run dev              # Development server
npm run build            # Production build
npm run lint             # ESLint check
npm run test             # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run db:generate      # Generate migration from schema
npm run db:migrate       # Apply migrations
npm run db:seed-config   # Seed system config
npm run db:seed          # Seed sample data
```

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/srams_db"
AUTH_SECRET="your-secret-key"
NODE_ENV="development"
```

## Architecture

### Layer Boundaries (Non-Negotiable)

| Layer             | Location                                                  | Responsibility                               |
| ----------------- | --------------------------------------------------------- | -------------------------------------------- |
| Server Actions    | `src/features/*/*.actions.ts`                             | ALL business logic and DB writes             |
| Zod Schemas       | `src/features/*/*.schema.ts` or `src/lib/validators/*.ts` | Data validation and type definitions         |
| Server Queries    | `src/features/*/*.queries.ts`                             | ALL database reads                           |
| Utility Functions | `src/lib/utils/*.ts`                                      | Pure transformations only                    |
| Client Components | `src/features/*/components/*.tsx`                         | UI state and form interactions only          |
| Auth & Sessions   | `src/lib/auth/*.ts`                                       | JWT-based session management                 |

**Violations:** No business logic in `.tsx` files. No direct DB calls in components. No raw SQL outside queries/actions. No HARD DELETE.

### Routing & Authentication

Route structure:
- `/login` — Public login page
- `/admin/*` — Admin portal (full access)
- `/staff/*` — Internal operations portal (registrar/finance/cashier/teacher)
- `/portal/*` — Student/parent portal

Authentication is JWT-based using `jose` (NOT NextAuth). Session helpers in `src/lib/auth/session.ts`:
- `requireSession()` — Throws redirect if unauthenticated
- `getCurrentUser()` — Returns user + role or null
- `createSession()` / `deleteSession()` — Login/logout

Route protection lives in `proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`).

### User Roles

| Role            | Access                                           |
| --------------- | ------------------------------------------------ |
| `super_admin`   | System setup, users, database settings           |
| `admin`         | All business operations and reports              |
| `registrar`     | Student records & enrollment                     |
| `finance_officer` | Fee schedules, assessments, invoices, OR booklets |
| `cashier`       | Payment posting only                             |
| `teacher`       | Grade encoding only                              |
| `student`       | View own records                                 |

Use `hasPermission(role, permission)` from `src/lib/rbac/permissions.ts` in server actions.

### Database Schema Key Relationships

```
users → students (optional portal account)
students ↔ parentsGuardians (via studentGuardianLinks)
schoolYears → sections → enrollments
curriculums → subjects
teacherAssignments → gradeRecords (Q1–Q4)
gradeSheets → gradeSheetEntries (adviser workflow)
registrations → enrollments → assessments → payments
feeSchedules → assessmentItems
receiptBooklets → payments (OR tracking)
```

## Next.js Patterns & Best Practices

### Server vs Client Components

```typescript
// ✅ Server Component (default) — runs on server, no "use client"
// Use for: data fetching, accessing backend, sensitive logic
async function StudentList() {
  const students = await db.query.students.findMany();  // Direct DB access
  return <ul>{students.map(s => <li key={s.id}>{s.name}</li>)}</ul>;
}

// ✅ Client Component — runs in browser
// Use for: interactivity, hooks, browser APIs, event handlers
"use client";
function SearchFilter({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState("");
  return <input value={query} onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }} />;
}
```

**Rules:**
- Default to Server Components — smaller bundles, direct backend access
- Add `"use client"` only when needed (useState, useEffect, onClick, browser APIs)
- Pass server data as props to client components (no prop drilling of functions)
- Client components can import server components, but not vice versa

### Data Fetching Patterns

```typescript
// ✅ GOOD: Fetch in Server Component (parallel queries)
async function DashboardPage() {
  const [students, payments, enrollments] = await Promise.all([
    getStudents(),
    getRecentPayments(),
    getPendingEnrollments(),
  ]);
  return <Dashboard students={students} payments={payments} enrollments={enrollments} />;
}

// ✅ GOOD: Fetch in page, pass to components
export default async function StudentsPage() {
  const students = await getStudents();
  return <StudentsTable data={students} />;  // Client component receives data
}

// ❌ BAD: Fetching in client component without TanStack Query
"use client";
function BadComponent() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch("/api/data").then(r => r.json()).then(setData); }, []);  // No caching, no error handling
}

// ✅ GOOD: Client-side fetching with TanStack Query
"use client";
function GoodComponent() {
  const { data, isLoading } = useQuery({ queryKey: ["data"], queryFn: fetchData });
}
```

### Caching Strategies

```typescript
// 1. Route Segment Cache (page-level)
// next.config.ts enables: cacheComponents: true, partialPrefetching: true

// 2. Data Cache with "use cache" directive
async function getCachedStudents() {
  "use cache";
  cacheTag("students");
  cacheLife("hours");  // or "days", "weeks", "max"
  return db.query.students.findMany();
}

// 3. Revalidation in Server Actions
"use server";
export async function createStudent(data: FormData) {
  await db.insert(students).values(parsed);
  revalidatePath("/staff/students");     // Revalidate specific path
  invalidateTag("students");             // Invalidate cache tag (non-blocking)
}

// 4. On-demand revalidation via Route Handler
export async function GET(request: Request) {
  revalidateTag("students");
  return Response.json({ revalidated: true });
}
```

### Error Handling

```typescript
// app/staff/students/error.tsx — Catches errors in segment
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="error-container">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// app/global-error.tsx — Root layout errors (rare)
"use client";
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html><body>
      <h2>Critical error</h2>
      <button onClick={reset}>Retry</button>
    </body></html>
  );
}

// Server Action error handling
"use server";
export async function riskyAction(): Promise<ActionResult> {
  try {
    await db.insert(records).values(data);
    return { ok: true, data: result };
  } catch (error) {
    console.error("Action failed:", error);
    return { ok: false, error: { code: "DB_ERROR", message: "Failed to save record" } };
  }
}
```

### Loading States

```typescript
// app/staff/students/loading.tsx — Auto loading UI for segment
export default function Loading() {
  return <TableSkeleton rows={10} />;
}

// Streaming with Suspense (preferred for instant navigation)
import { Suspense } from "react";

export default function Page() {
  return (
    <>
      <h1>Students</h1>  {/* Renders immediately */}
      <Suspense fallback={<TableSkeleton />}>
        <StudentsTable />  {/* Streams in when ready */}
      </Suspense>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsPanel />  {/* Streams independently */}
      </Suspense>
    </>
  );
}

// Multiple Suspense boundaries = parallel streaming
```

### Route Handlers (API Routes)

```typescript
// app/api/students/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");

  const students = await getStudents({ page });
  return NextResponse.json(students);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentUser();
  if (!hasPermission(session.role, "students:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const student = await createStudent(parsed.data);
  return NextResponse.json(student, { status: 201 });
}

// Dynamic route: app/api/students/[id]/route.ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(student);
}
```

### Metadata & SEO

```typescript
// Static metadata
export const metadata: Metadata = {
  title: "Students | SRAMS",
  description: "Manage student records",
};

// Dynamic metadata
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const student = await getStudent(id);
  return {
    title: `${student.name} | SRAMS`,
    description: `Student profile for ${student.name}`,
  };
}
```

### Performance Patterns

```typescript
// 1. Parallel data fetching (ALWAYS use for independent queries)
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);

// 2. Preload pattern for waterfalls
import { preload } from "react-dom";
preload("/api/heavy-data", { as: "fetch" });

// 3. Dynamic imports for heavy components
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  loading: () => <ChartSkeleton />,
  ssr: false,  // Client-only if needed
});

// 4. Image optimization
import Image from "next/image";
<Image
  src="/photo.jpg"
  width={200}
  height={200}
  alt="Student"
  placeholder="blur"
  blurDataURL={blurPlaceholder}
/>
// For runtime uploads: add unoptimized prop
<Image src={uploadedPhotoUrl} unoptimized alt="Uploaded" />

// 5. Link prefetching (automatic, can disable)
<Link href="/students" prefetch={false}>Students</Link>
```

### Security Patterns

```typescript
// 1. Validate ALL inputs in Server Actions (never trust client)
"use server";
export async function updateStudent(formData: FormData) {
  const session = await requireSession();  // Auth first

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Sanitize user input for XSS
  const sanitizedName = DOMPurify.sanitize(parsed.data.name);
}

// 2. CSRF protection (built into Server Actions, verify origin in Route Handlers)
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== process.env.NEXT_PUBLIC_URL) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
}

// 3. Rate limiting in proxy.ts
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
export function proxy(request: NextRequest) {
  const ip = request.ip || "unknown";
  // ... rate limit logic
}

// 4. Never expose sensitive data
// ❌ BAD: return entire user object
return { user };
// ✅ GOOD: return only needed fields
return { id: user.id, name: user.name, role: user.role };

// 5. Environment variables
// NEXT_PUBLIC_* = exposed to client (safe for public URLs)
// Others = server-only (use for secrets)
```

### Component Organization

```typescript
// Page component (Server Component) — data fetching + composition
// app/staff/students/page.tsx
export default async function StudentsPage() {
  const students = await getStudents();
  return (
    <PageContainer>
      <PageHeader title="Students" action={<CreateButton />} />
      <StudentsTable data={students} />
    </PageContainer>
  );
}

// Feature component (Client Component) — interactivity
// src/features/students/components/StudentsTable.tsx
"use client";
export function StudentsTable({ data }: { data: Student[] }) {
  const [filter, setFilter] = useState("");
  // ... table logic with TanStack Table
}

// Shared UI component (can be either) — reusable primitives
// src/components/ui/Button.tsx
export function Button({ children, ...props }: ButtonProps) {
  return <button className="btn" {...props}>{children}</button>;
}
```

## Rules (Non-Negotiable)

1. **Soft Delete Only:** Use `deletedAt` / `deletedBy` fields. Never hard delete.
2. **RBAC at 3 Levels:** Route guard (`proxy.ts`) + server action validation + audit logging.
3. **Always Use Reusable Components:** `DataTable`, `StatusBadge`, `ConfirmActionButton`, etc.
4. **No Business Logic in UI:** Components render state only — all mutations via server actions.
5. **Financial Actions Require Audit:** Every payment post/void/refund must write to `auditLogs`.
6. **Defensive Key Generation:** Use `key={item.id}` for DB records, never array index.
7. **Zod for Runtime Validation:** Parse external input with Zod schemas.
8. **OR Tracking is Mandatory:** Every payment must consume an OR number from an active booklet.

## Form Patterns

### Default: React 19 `useActionState`

```typescript
// Simple forms use native pattern
"use client";
import { useActionState } from "react";
import { useFormToast } from "@/hooks/useFormToast";

export function SimpleForm() {
  const [state, action, isPending] = useActionState(createAction, {});
  useFormToast(state, { successMessage: "Created!" });

  return (
    <form action={action}>
      <input name="field" />
      <button disabled={isPending}>Submit</button>
    </form>
  );
}
```

### Complex Forms: TanStack Form

For wizard / field-array forms only. See `src/features/registrations/components/StudentRegistrationForm.tsx`.

### Data Fetching Architecture

```
Client Component → TanStack Query → API Route/Server Action → Drizzle ORM → Database
```

Never call Drizzle directly from client components.

## Server Action Pattern

```typescript
"use server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";

export async function createStudent(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  // 1. Permission check
  if (!hasPermission(session.role, "students:create")) {
    return { message: "Permission denied." };
  }

  // 2. Validate
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // 3. DB write + audit
  const [student] = await db.insert(students).values(parsed.data).returning();
  await logAudit({ actor: session.userId, action: "students:create", targetId: student.id });

  return { success: true, studentId: student.id };
}
```

## Instant Navigation & Prefetching (Next.js 16)

### Configuration (next.config.ts)

```typescript
const nextConfig: NextConfig = {
  cacheComponents: true,      // Cache rendered component trees
  partialPrefetching: true,   // Prefetch static shells on link hover
};
```

### The Pattern: Sync Shell + Async Content

```typescript
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// ✅ Page component is SYNC — prefetchable, renders instantly
export default function StudentsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Students</h1>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <StudentsContent />
      </Suspense>
    </div>
  );
}

// ✅ Async component handles auth + data fetching
async function StudentsContent() {
  const session = await requireSession();
  const students = await getStudents();
  return <StudentsTable data={students} />;
}

// ✅ Skeleton matches content shape (no layout shift)
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}
```

### Multiple Suspense Boundaries (Parallel Streaming)

```typescript
export default function DashboardPage() {
  return (
    <div className="grid">
      <Suspense fallback={<StatsSkeleton />}><StatsPanel /></Suspense>
      <Suspense fallback={<ChartSkeleton />}><RevenueChart /></Suspense>
      <Suspense fallback={<TableSkeleton />}><RecentPayments /></Suspense>
    </div>
  );
}
```

### Fallback: Opt-Out

```typescript
export const instant = false;  // Blocks navigation until fully rendered

export default async function LegacyPage() {
  const data = await fetchData();
  return <Content data={data} />;
}
```

### Anti-Patterns

```typescript
// ❌ Async page component — blocks prefetching
export default async function Page() {
  const data = await fetchData();
  return <Content data={data} />;
}

// ❌ Single Suspense — no parallel streaming
<Suspense fallback={<Spinner />}>
  <SlowTable /><FastSidebar />  {/* Sidebar waits for table */}
</Suspense>

// ✅ Sync shell + multiple Suspense boundaries
export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<TableSkeleton />}><SlowTable /></Suspense>
      <Suspense fallback={<SidebarSkeleton />}><FastSidebar /></Suspense>
    </>
  );
}
```

### Dynamic Routes: params/searchParams Access

**CRITICAL:** Never await `params` or `searchParams` outside a Suspense boundary. This causes the "instant-shell-url-data" error and blocks instant navigation.

```typescript
// ❌ BAD: params accessed before Suspense — breaks instant navigation
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;  // Error: URL data outside Suspense
  return (
    <Suspense fallback={<Skeleton />}>
      <Content id={id} />
    </Suspense>
  );
}

// ✅ GOOD: params accessed inside Suspense via wrapper component
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ContentWrapper params={params} />
    </Suspense>
  );
}

async function ContentWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Content id={id} />;
}
```

The same pattern applies to `searchParams`. For pages with both:

```typescript
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}

export default function Page({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ContentWrapper params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ContentWrapper({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { filter } = await searchParams;
  return <Content id={id} filter={filter} />;
}
```

## Official Receipt (OR) Workflow

**CRITICAL: Read `SRAMS_OR_WORKFLOW.md` before modifying OR-related code.**

- Finance officers create booklets with series prefix (e.g., "AP") and 51-receipt range
- Multiple booklets may be active simultaneously
- Cashier selects booklet → system auto-assigns next OR number
- OR status: `available` → `consumed` (immutable, never reused)
- Voided payments mark OR as `voided` but don't return to pool
- Every payment post/void triggers audit log

## Grade Encoding Workflow

**Primary: Adviser-Based Grade Sheets**

1. Adviser accesses section at `/staff/grades/adviser/sections/[sectionId]`
2. Enters grades for all subjects per student per period (Q1–Q4)
3. Sheet status: `draft` → `submitted` → `approved` or `returned`
4. Sequential period locking: Q2 cannot submit until Q1 approved

## Reusable Components

**Data:** `DataTable<T>`, `StatusBadge`, `CurrencyDisplay`, `ReferenceCode`
**Forms:** `useFormToast`, `TextInputField`, `SelectField`, `CurrencyInputField`
**Actions:** `ConfirmActionButton`, `InlineConfirmButton`, `BlockConfirmButton`
**Layout:** `PageHeader`, `PageContainer`

## Report Generation

All reports use `src/features/reports/shared/`:
- **PDF:** `@react-pdf/renderer` via `TabularReportDocument`, `pdfResponse`
- **XLSX:** `exceljs` via `buildReportWorkbook`, `xlsxResponse`

Route: `…/<name>/export?format=pdf|xlsx&<filters>`

## Migrations

```bash
# 1. Modify src/lib/db/schema.ts
# 2. Generate (NEVER manually create SQL files)
npm run db:generate -- --name=descriptive_name
# 3. Review drizzle/*.sql
# 4. Apply
npm run db:migrate
```

Use snake_case names: `add_student_lrn_field`, NOT auto-generated names.

## Common Gotchas

1. **Soft Delete:** Always filter `deletedAt IS NULL` in queries.
2. **Date Formatting:** Use `formatDate`/`formatDateTime` from `src/lib/utils/date.ts` (pins Asia/Manila timezone). Never hand-roll `toLocaleDateString()`.
3. **Parallel Queries:** Use `Promise.all()` for independent DB queries.
4. **Cache Invalidation:** Use `invalidateTag()` (non-blocking) in actions, not `forceUpdateTag()`. Add `revalidatePath()` before `invalidateTag()` for `"use cache"` queries.
5. **Photo Uploads:** Use `unoptimized` prop on `<Image>` for runtime-uploaded photos.
6. **Session Cookie HTTP:** `.env.production` sets `SESSION_COOKIE_SECURE=false` for LAN deployments without TLS.
7. **Turbopack Errors:** Ignore "negative time stamp" errors in dev — harmless bug.

## Documentation References

- `SRAMS_MVP.md` — System requirements
- `SRAMS_OR_WORKFLOW.md` — OR tracking (MUST READ before modifying OR features)
- `PROJECT_STATUS.md` — Current implementation status
