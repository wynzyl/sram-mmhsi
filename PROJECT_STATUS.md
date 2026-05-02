# PROJECT_STATUS.md — SRAMS

> Last updated: 2026-05-02

## Current phase

**Core school operations (Phases 1–8)** are implemented in code: auth, student records, enrollments, assessments, fees, cashier/OR posting, invoices, and teacher grade encoding.

**Active gaps:** registration **entity** workflow (`registrations` create/review actions), student/parent **portal** (`/portal/*`), executive/reporting dashboards, formal OR **receipt** print view, **E2E** tests, and wiring **rate limit** + mandatory **password-change** gate.

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
- [x] `components/auth/LoginForm.tsx` — client form with `useActionState`
- [x] `scripts/seed.ts` — admin seed (`npm run db:seed`)
- [x] Path aliases — `tsconfig.json` / `next.config.ts` for `@/` imports

### Phase 2–8 — Operational modules (high level)

- [x] **Students** — create/update with guardians, duplicate checks, list/profile/edit (`actions/students.ts`, `admin/students/*`)
- [x] **Registrations list** — read-only listing when data exists (`admin/registrations`) — *creation/review of `registrations` rows still pending*
- [x] **Enrollments** — create, status transitions, cancellation (`actions/enrollments.ts`, `admin/enrollments/*`)
- [x] **Fee schedules & assessments** — schedules, per-enrollment assessments, items, balances (`actions/finance.ts`, `actions/assessments.ts`, `admin/finance/*`, `admin/assessments/*`)
- [x] **Cashier & OR** — booklet setup, post/void payment, allocations (`actions/cashier.ts`, booklet pages, payment UI on **assessment** ledger — not a separate `/staff/payments` page)
- [x] **Invoices** — generate, send (Nodemailer/Gmail), status (`actions/invoices.ts`, `admin/finance/invoices/*`)
- [x] **Academics & grades** — subjects, assignments, teacher grade encoding and lock (`actions/academics.ts`, `actions/teacher.ts`, `/staff/grades/*`, admin assignment pages)
- [x] **Users** — admin user CRUD, password reset / `forcePasswordChange` field (`actions/users.ts`)

### Phase 11 — Tests (initial)

- [x] Vitest unit tests — `lib/validators/assessment.test.ts`, `lib/utils/enrollment-grade.test.ts`, `lib/utils/enrollment-payment.test.ts`
- [x] Scripts — `npm run test`, `npm run test:watch`; Playwright listed as `test:e2e` but no committed E2E suite yet

---

## In progress / known gaps

- [ ] **`registrations` workflow** — DB + list UI; missing server actions to insert rows and approve/reject against `registration_status`
- [ ] **Login hardening** — connect `rateLimit` to login; optional dedicated `/api/auth/*` usage
- [ ] **First-login password change** — enforce redirect when `forcePasswordChange` until password updated
- [ ] **Staff landing URLs** — `ROLE_LANDING` and dashboard quick links point at `/staff/students`, `/staff/payments`, etc.; most CRUD lives under **`/admin/*`** — align links or add staff route aliases
- [ ] **OR receipt** — formal printable OR layout (beyond success message / browser print hooks)
- [ ] **Portal** — `/portal/dashboard` referenced in auth maps; no `src/app/portal` pages yet
- [ ] **Dashboards & exports** — Phase 10 metrics are placeholders; no PDF/Excel export pipeline
- [ ] **E2E** — add Playwright config + smoke tests (login, enrollment, payment, grades)

---

## Not started (see roadmap)

- Phase 9 — Student/parent portal (full feature set)
- Phase 10 — Reporting & management dashboard (real data)
- Phase 12 — Production deployment hardening

---

## Reference

Full phased checklist: `PROJECT_ROADMAP.md`.
