# PROJECT_STATUS.md — SRAMS

> Last updated: 2026-06-01

## Current phase

**Core school operations (Phases 1–8)** are implemented in code: auth, student records, registrations listing + creation through student onboarding, enrollments, assessments, fees, cashier/OR posting, invoices, and teacher grade encoding.

**Reporting (Phase 10) is now underway** — a reusable two-track report/document pipeline (PDF via `@react-pdf/renderer` + XLSX via `exceljs`) is live with four reports: Payment Collection, Balance Forward, Invoice, and a new Student List masterlist.

**Active gaps:** full registration **review** workflow (approve/reject actions), expanded student/parent **portal** pages beyond dashboard, executive **dashboards** with real data (metrics still placeholders), formal OR **receipt** print view, **E2E** tests, and wiring **rate limit** + mandatory **password-change** gate.

## Latest updates (2026-06-01)

- [x] **Report & Document Generation standard** — established a two-track pipeline with a shared foundation in `src/features/reports/shared/` (`TabularReportDocument` PDF primitive, `buildReportWorkbook` XLSX builder, `pdfResponse`/`xlsxResponse`, `parseReportDateRange`, and `logReportExport`). **Track 1 = official documents → `@react-pdf/renderer`**; **Track 2 = analytical reports → XLSX (`exceljs`)**. Every report is a route handler at `…/<name>/export?format=pdf|xlsx`, RBAC-gated (`reports:view`) and audited (`reports:export`). Documented in CLAUDE.md. New dep: `exceljs`; Roboto TTF embedded in `public/fonts/` so the **₱** glyph renders (replacing the old `"PHP "` workaround).
- [x] **Payment Collection report migrated + de-duplicated** — collapsed three redundant routes (`/pdf`, `/pdf-data`, `/print`) into one `/export?format=pdf|xlsx`; rebuilt the PDF on the shared primitive and added an Excel export.
- [x] **Invoice moved to real PDF** — replaced the browser `window.print()` HTML route with a server-rendered `@react-pdf/renderer` document (`src/features/finance/invoices/invoice-document.tsx`) at `…/invoices/[id]/export`. The HTML template is retained for the Gmail email path only.
- [x] **Balance Forward (BFX) exports added** — previously screen-only; now has PDF + Excel export (`getAllBfxData` + `balance-forwards/export` route + on-page buttons).
- [x] **NEW: Student List (masterlist) report** — `/staff/reports/student-list`: enrolled students for the selected year (defaults to active), filterable by grade level, with on-screen preview + PDF/Excel export. Columns: Student Name (Lastname, Firstname Middlename), Grade, Address, primary Guardian Name, Contact No., Email. Primary guardian resolved via a `DISTINCT ON` subquery (no row duplication).
- [x] **Shared PDF robustness fixes** (found via sample-render dogfood) — added inter-column spacing so right-aligned amounts don't collide with the next column, and `wrap={false}` on table rows so a row never splits across a page boundary into an orphaned fragment.
- [x] **Ops note** — the app runs in Docker with `node_modules` as a persistent named volume; adding a dependency requires reinstalling inside the container (`up --build` alone won't refresh the volume). Captured for future sessions.

## Previous updates (2026-05-28)

- [x] **TanStack Form adopted for the registration wizard** — `src/features/registrations/components/StudentRegistrationForm.tsx` migrated in place from the native `useActionState` pattern to TanStack Form (`@tanstack/react-form`). Adds live per-field validation (reusing the existing Zod schemas via a `zodCheck` adapter) and a typed guardian field array. Server contract is unchanged — `createStudentAction` and its FormData keys are identical, so server validation + audit logging stay authoritative.
- [x] **Two bugs fixed during migration** (found via browser dogfood): (1) the guardian *single-primary* toggle now works — "Set as primary" moves the badge and removing the primary falls back to the first guardian (implemented via whole-array `setFieldValue` so the array store updates reactively); (2) submit now redirects + toasts correctly — the `useActionState` dispatch is wrapped in `startTransition` (previously called outside a transition, so `state` never updated).
- [x] **Forms-stack cleanup** — removed the phantom `react-hook-form` + `@hookform/resolvers` dependencies (zero source imports) and corrected the forms guidance in CLAUDE.md. The throwaway prototype (`StudentRegistrationFormTanstack.tsx`) and the `?form=tanstack` toggle were retired now that the migration is in place.
- [x] **Docs** — added `docs/01-STATUS-REPORT/TANSTACK-FORM-TRIAL-REPORT.md`, `docs/TANSTACK-MIGRATION/TANSTACK-FORM-CANDIDATES.md` (per-form assessment + migration order), and `docs/TANSTACK-MIGRATION/TANSTACK-FORM-IMPLEMENTATION-REPORT.md`. The remaining ~15 simple single-submit forms stay native (progressive enhancement); next TanStack targets are the field-array forms `StudentForm` / `EditStudentForm`.

## Previous updates (2026-05-23)

- [x] **Assessment cancellation & reassessment** — Students can now receive a new assessment after their previous assessment is cancelled. Fixed logic that previously blocked re-assessment.
- [x] **Discount rejection on cancellation** — When an assessment is cancelled, any linked discount requests are automatically rejected with appropriate status updates.
- [x] **Applied discounts visibility** — Student profile now displays applied discounts from their current assessment.
- [x] **Client-side navigation fix** — Fixed blank screen issue on `/staff/students` caused by redirect-to-add-default-param pattern. Replaced with direct value usage to ensure Next.js 16+ client-side navigation works correctly.
- [x] **Codebase audit** — Audited 14 page templates for problematic redirect patterns; only 1 instance found and fixed.

### Best Practice Documented: Redirect Patterns in Server Components

When a page needs a default URL parameter:
- **DO:** Fetch the default and use it directly in the query
- **DON'T:** Redirect to inject it into the URL (breaks client-side navigation in Next.js 16+)

```typescript
// ✅ CORRECT: Use default value directly
if (!schoolYearId) {
  const activeId = await fetchActiveSchoolYearId();
  if (activeId) schoolYearId = activeId;
}

// ❌ WRONG: Redirect to add default param
if (!schoolYearId) {
  const activeId = await fetchActiveSchoolYearId();
  if (activeId) redirect(`/page?schoolYearId=${activeId}`);
}
```

## Previous updates (2026-05-13)

- [x] **Enrollment queue query optimization** — `getReadyToEnrollStudents()` in `src/features/enrollments/enrollments-queue.queries.ts` rewritten with SQL-level pagination using CTEs and UNION ALL. Applies LIMIT/OFFSET at database level instead of loading all records into memory.
- [x] **Performance improvement** — Memory usage reduced from ~47MB to ~50KB per page load (5000 students scenario). Query response time ~60-119ms.
- [x] **SQL document completeness** — Moved `areDocumentsComplete()` helper to SQL CASE expression, removed unused JavaScript helper and imports.

## Previous updates (2026-05-11)

- [x] **Library migration** — Migrated all 58 files from `lib/` to `src/lib/` for unified source structure. All application code now under `src/` directory with git history preserved.
- [x] **Architecture alignment** — Path alias `@/lib/*` updated in tsconfig.json; import statements remain unchanged. Cleaner project structure aligned with modern Next.js conventions.
- [x] **Documentation updated** — CLAUDE.md, PROJECT_STATUS.md, and PROJECT_ROADMAP.md reflect new `src/lib/` paths and migration status.

## Previous updates (2026-05-08)

- [x] **Enrollment queue system** implemented with list-first workflow at `/staff/enrollments` replacing form-first manual wizard — students automatically appear in queue when eligible for enrollment.
- [x] **Auto-population** of old students from previous year with grade progression suggestions and balance warnings (non-blocking).
- [x] **Global filters** with URL persistence across all enrollment tabs — search by name/student ID and filter by grade level.
- [x] **EnrollmentConfirmationDrawer** for one-click enrollment confirmation with different layouts for new/transferee vs returning students.
- [x] **5-tab interface** (Ready to Enroll, Pending, Assessed, Enrolled, Cancelled) with badge counts and parallel queue queries.

## Previous updates (2026-05-07)

- [x] Assessment draft creation UX refreshed in `components/assessments/AssessmentDraftForm.tsx` with stronger student context, fee-catalog-driven line rendering, computed summary totals, and explicit assessment audit/finalization guidance.
- [x] Shared assessment-ledger page abstraction added in `src/app/_internal/pages/assessment-ledger-page.tsx` to centralize permission checks, data loading, and handoff into `AssessmentLedgerRegister`.
- [x] Assessment-to-ledger workflow messaging clarified so teams create assessment once, then continue payment/invoice operations in the ledger/finance flow.

---

## Completed

### Phase 1 — Infrastructure & scaffold

- [x] Next.js 16 + TypeScript + Tailwind + App Router + `src/`
- [x] Folder structure per Engineering spec §7
- [x] `docker-compose.yml` — PostgreSQL 16 + pgAdmin
- [x] `.env.local` / `.env.example` per spec §8.1
- [x] `drizzle.config.ts` with dotenv loading
- [x] Dependencies per locked stack (`package.json`)

### Phase 1 — Database

- [x] Schema in `src/lib/db/schema.ts` (students, guardians, enrollments, assessments, payments, OR booklets, invoices, grades, audit, etc.)
- [x] DB client — `src/lib/db/index.ts`
- [x] Migrations through `drizzle/` (including recent journals such as assessment cancellation / fee-catalog constraints — e.g. `0005`–`0008` range)

### Phase 1 — Core library

- [x] Role constants — `src/lib/constants/roles.ts`
- [x] Environment validation — `src/lib/utils/env.ts`
- [x] RBAC permission map — `src/lib/rbac/permissions.ts`
- [x] Structured JSON logger — `src/lib/observability/logger.ts`
- [x] In-memory rate limiter **module** — `src/lib/security/rateLimit.ts` (not yet integrated with login)

### Phase 2 — Authentication & session

- [x] `src/lib/auth/session.ts` — JWT (jose), httpOnly cookie, DB-backed sessions, renewal/revocation patterns
- [x] `src/lib/validators/auth.ts` — Zod login schema
- [x] `actions/auth.ts` — login + logout; bcrypt; audit for success/failure
- [x] `proxy.ts` — unauthenticated redirect; staff vs portal vs admin-only routes; role landing redirects  
  *(Next.js 16: the root file was `middleware.ts`; it is now `proxy.ts` with a named `proxy` export. Doc or comments that say “middleware” for this layer mean `proxy.ts`.)*
- [x] `components/auth/LoginForm.tsx` — client form with `useActionState`
- [x] `scripts/seed.ts` — admin seed (`npm run db:seed`)
- [x] Path aliases — `tsconfig.json` / `next.config.ts` for `@/` imports

### Phase 2–8 — Operational modules (high level)

- [x] **Students** — create/update with guardians, duplicate checks, list/profile/edit (`actions/students.ts`, `admin/students/*`)
- [x] **Registrations list + intake visibility** — paginated approved-registration queues for `admin` and `staff` (`admin/registrations`, `staff/registrations`)
- [x] **Registration creation on student onboarding** — student creation now inserts an approved `registrations` row in the same transaction (`actions/students.ts`)
- [x] **Enrollments** — queue-based list-first workflow with automatic eligibility detection, global search/grade filters, one-click confirmation drawer, status transitions (pending → assessed → enrolled), and cancellation (`src/lib/queries/enrollment-queue.ts`, `actions/enrollment-confirmation.ts`, `components/enrollments/EnrollmentConfirmationDrawer.tsx`, `/staff/enrollments`)
- [x] **Fee schedules & assessments** — schedules, per-enrollment assessments, items, balances, refreshed assessment draft UX, assessment cancellation with re-assessment support, discount requests with auto-rejection on cancellation (`actions/finance.ts`, `actions/assessments.ts`, `admin/finance/*`, `admin/assessments/*`, `components/assessments/AssessmentDraftForm.tsx`, `src/features/discounts/`)
- [x] **Cashier & OR** — booklet setup, post/void payment, allocations, and shared internal ledger composition (`actions/cashier.ts`, booklet pages, payment UI on **assessment** ledger, `src/app/_internal/pages/assessment-ledger-page.tsx`)
- [x] **Invoices** — generate, send (Nodemailer/Gmail), status (`actions/invoices.ts`, `admin/finance/invoices/*`)
- [x] **Academics & grades** — subjects, assignments, teacher grade encoding and lock (`actions/academics.ts`, `actions/teacher.ts`, `/staff/grades/*`, admin assignment pages)
- [x] **Users** — admin user CRUD, password reset / `forcePasswordChange` field (`actions/users.ts`)
- [x] **Staff route coverage** — staff aliases/pages exist for key operational flows (`/staff/students`, `/staff/enrollments`, `/staff/payments`, `/staff/registrations`, `/staff/finance`, `/staff/grades`)
- [x] **Portal shell** — authenticated `/portal/dashboard` page with role-aware links

### Phase 10 — Reporting & exports (foundation)

- [x] **Two-track report pipeline** — shared foundation `src/features/reports/shared/*` (PDF primitives + fonts, `exceljs` workbook builder, response/request/audit helpers); `…/export?format=pdf|xlsx` route convention; `reports:export` audit
- [x] **Payment Collection report** — PDF + Excel (`src/features/reports/payment-collection-report.export.tsx`, `staff/reports/payment-collection/export`)
- [x] **Balance Forward (BFX) report** — PDF + Excel (`…/balance-forward-report.export.tsx`, `staff/reports/balance-forwards/export`)
- [x] **Student List masterlist** — enrolled students + primary guardian, grade filter, PDF + Excel (`…/student-list-report.*`, `staff/reports/student-list`)
- [x] **Invoice document** — server-rendered PDF (`src/features/finance/invoices/invoice-document.tsx`, `…/invoices/[id]/export`)

### Phase 11 — Tests (initial)

- [x] Vitest unit tests — `src/lib/validators/assessment.test.ts`, `src/lib/utils/enrollment-grade.test.ts`, `src/lib/utils/enrollment-payment.test.ts`
- [x] Scripts — `npm run test`, `npm run test:watch`; Playwright listed as `test:e2e` but no committed E2E suite yet
- [x] Codebase audit — redirect patterns in 14 page templates audited; best practice documented for Next.js 16+

---

## In progress / known gaps

- [ ] **`registrations` workflow** — creation is now integrated during student onboarding; dedicated registration intake + approve/reject actions are still missing
- [ ] **Login hardening** — connect `rateLimit` to login; optional dedicated `/api/auth/*` usage
- [ ] **First-login password change** — enforce redirect when `forcePasswordChange` until password updated
- [ ] **OR receipt** — formal printable OR layout (beyond success message / browser print hooks)
- [ ] **Portal expansion** — `/portal/dashboard` exists, but `/portal/assessments`, `/portal/payments`, and `/portal/grades` pages are not implemented yet
- [ ] **Dashboards** — Phase 10 dashboard metrics are still placeholders (the PDF/Excel **export pipeline now exists**; AR aging, enrollment summary, and grade summary reports are still pending)
- [ ] **E2E** — add Playwright config + smoke tests (login, enrollment, payment, grades)

---

## Not started (see roadmap)

- Phase 10 — Management **dashboard** with real data + AR aging / enrollment-summary / grade-summary reports (the report **export pipeline** is done — see above)
- Phase 12 — Production deployment hardening

---

## Reference

Full phased checklist: `PROJECT_ROADMAP.md`.
