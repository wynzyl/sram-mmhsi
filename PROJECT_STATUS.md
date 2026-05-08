# PROJECT_STATUS.md — SRAMS

> Last updated: 2026-05-08

## Current phase

**Core school operations (Phases 1–8)** are implemented in code: auth, student records, registrations listing + creation through student onboarding, enrollments, assessments, fees, cashier/OR posting, invoices, and teacher grade encoding.

**Active gaps:** full registration **review** workflow (approve/reject actions), expanded student/parent **portal** pages beyond dashboard, executive/reporting dashboards, formal OR **receipt** print view, **E2E** tests, and wiring **rate limit** + mandatory **password-change** gate.

## Latest updates (2026-05-08)

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

- [x] Schema in `lib/db/schema.ts` (students, guardians, enrollments, assessments, payments, OR booklets, invoices, grades, audit, etc.)
- [x] DB client — `lib/db/index.ts`
- [x] Migrations through `drizzle/` (including recent journals such as assessment cancellation / fee-catalog constraints — e.g. `0005`–`0008` range)

### Phase 1 — Core library

- [x] Role constants — `lib/constants/roles.ts`
- [x] Environment validation — `lib/utils/env.ts`
- [x] RBAC permission map — `lib/rbac/permissions.ts`
- [x] Structured JSON logger — `lib/observability/logger.ts`
- [x] In-memory rate limiter **module** — `lib/security/rateLimit.ts` (not yet integrated with login)

### Phase 2 — Authentication & session

- [x] `lib/auth/session.ts` — JWT (jose), httpOnly cookie, DB-backed sessions, renewal/revocation patterns
- [x] `lib/validators/auth.ts` — Zod login schema
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
- [x] **Enrollments** — queue-based list-first workflow with automatic eligibility detection, global search/grade filters, one-click confirmation drawer, status transitions (pending → assessed → enrolled), and cancellation (`lib/queries/enrollment-queue.ts`, `actions/enrollment-confirmation.ts`, `components/enrollments/EnrollmentConfirmationDrawer.tsx`, `/staff/enrollments`)
- [x] **Fee schedules & assessments** — schedules, per-enrollment assessments, items, balances, and refreshed assessment draft UX (`actions/finance.ts`, `actions/assessments.ts`, `admin/finance/*`, `admin/assessments/*`, `components/assessments/AssessmentDraftForm.tsx`)
- [x] **Cashier & OR** — booklet setup, post/void payment, allocations, and shared internal ledger composition (`actions/cashier.ts`, booklet pages, payment UI on **assessment** ledger, `src/app/_internal/pages/assessment-ledger-page.tsx`)
- [x] **Invoices** — generate, send (Nodemailer/Gmail), status (`actions/invoices.ts`, `admin/finance/invoices/*`)
- [x] **Academics & grades** — subjects, assignments, teacher grade encoding and lock (`actions/academics.ts`, `actions/teacher.ts`, `/staff/grades/*`, admin assignment pages)
- [x] **Users** — admin user CRUD, password reset / `forcePasswordChange` field (`actions/users.ts`)
- [x] **Staff route coverage** — staff aliases/pages exist for key operational flows (`/staff/students`, `/staff/enrollments`, `/staff/payments`, `/staff/registrations`, `/staff/finance`, `/staff/grades`)
- [x] **Portal shell** — authenticated `/portal/dashboard` page with role-aware links

### Phase 11 — Tests (initial)

- [x] Vitest unit tests — `lib/validators/assessment.test.ts`, `lib/utils/enrollment-grade.test.ts`, `lib/utils/enrollment-payment.test.ts`
- [x] Scripts — `npm run test`, `npm run test:watch`; Playwright listed as `test:e2e` but no committed E2E suite yet

---

## In progress / known gaps

- [ ] **`registrations` workflow** — creation is now integrated during student onboarding; dedicated registration intake + approve/reject actions are still missing
- [ ] **Login hardening** — connect `rateLimit` to login; optional dedicated `/api/auth/*` usage
- [ ] **First-login password change** — enforce redirect when `forcePasswordChange` until password updated
- [ ] **OR receipt** — formal printable OR layout (beyond success message / browser print hooks)
- [ ] **Portal expansion** — `/portal/dashboard` exists, but `/portal/assessments`, `/portal/payments`, and `/portal/grades` pages are not implemented yet
- [ ] **Dashboards & exports** — Phase 10 metrics are placeholders; no PDF/Excel export pipeline
- [ ] **E2E** — add Playwright config + smoke tests (login, enrollment, payment, grades)

---

## Not started (see roadmap)

- Phase 10 — Reporting & management dashboard (real data)
- Phase 12 — Production deployment hardening

---

## Reference

Full phased checklist: `PROJECT_ROADMAP.md`.
