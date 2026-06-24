# PROJECT_STATUS.md — SRAMS

> Last updated: 2026-06-24

## Current phase

**Core school operations (Phases 1–8)** are implemented in code: auth, student records, registrations listing + creation through student onboarding, enrollments, assessments, fees, cashier/OR posting, invoices, and teacher grade encoding. **Student photo upload is now live** with sharp-based optimization and Docker volume persistence.

**Deployment preparation (Phase 12) is now underway** — the production Docker stack (multi-stage `runner` image, one-shot migrate job, nginx reverse proxy on :80, host bind-mounted Postgres data) is built, running, and verified. **Auth hardening (Phase 2) is closed:** login rate limiting and the forced password-change gate are live. **The Playwright E2E suite is committed** with synthetic test-data provisioning and a CI workflow.

**Active gaps:** full registration **review** workflow (approve/reject actions), expanded student/parent **portal** pages beyond dashboard, formal OR **receipt** print view, and the remaining Phase 10 reports (enrollment summary, grade summary).

## Latest updates (2026-06-24)

- [x] **Student photo upload feature complete** — Full photo upload pipeline with `sharp` image processing (resize 400x400, auto-select smallest format from WebP/PNG/JPEG), magic-byte validation (rejects non-image files), EXIF stripping, and audit logging. API route at `/api/students/[studentId]/photo` (POST/DELETE). Client component `StudentPhotoUpload` with drag-drop, file picker, and crop preview.
- [x] **Production Docker photo upload fixes** — Three-layer configuration required: (1) `nginx.conf` — `client_max_body_size 5M` (default 1MB blocks uploads); (2) `next.config.ts` — `experimental.serverActions.bodySizeLimit: '3mb'`; (3) `docker-entrypoint.sh` — fixes volume ownership (`chown -R nextjs:nextjs /app/public/uploads`) before dropping to nextjs user via `su-exec`.
- [x] **Nginx static file serving** — Next.js does NOT serve runtime-uploaded files from `public/` in production. Nginx now serves `/uploads/*` directly from the shared `uploads_data` volume (mounted read-only to nginx). Added MIME types including WebP.
- [x] **Schema migration** — `drizzle/0001_add_student_photo_url.sql` adds `photo_url` column to `students` table.
- [x] **Documentation** — Added CLAUDE.md gotcha #9 documenting the three-layer photo upload configuration for Docker.

## Previous updates (2026-06-05)

- [x] **Production deployment stack live (Phase 12 kickoff)** — Dockerfile `runner` stage builds the Next.js app against an **ephemeral build-time Postgres** (so `next build` can prerender with a real schema). `docker-compose.prod.yml` runs: `srams_db` (Postgres 15) → one-shot `migrate` job → `app` → **nginx reverse proxy on :80** (`nginx.conf`); all services share an isolated `srams-network` and load `.env.production`. Verified end-to-end: migrate exits 0, app healthy behind nginx, login page served at `http://localhost`.
- [x] **Postgres data moved to a host bind mount** — prod DB data now lives at `./.postgres_data` (git-ignored) instead of a Docker named volume; the previous volume `sram-mmhsi_db-data` was physically copied over and is retained as a backup. **Gotcha fixed:** the cluster's database name is case-sensitive **`SRAMS_DB`** — pointing compose at lowercase `srams_db` fails with `3D000` because `POSTGRES_DB` is ignored once the data dir is initialized. The prod DB is intentionally **not host-exposed**; inspect via `docker exec srams_db psql -U postgres -d SRAMS_DB`.
- [x] **Auth hardening closed (Phase 2 → complete)** — login rate limiting wired into `src/features/auth/auth.actions.ts` (`checkLoginRateLimits`, per-IP + per-username, in-memory by design for this single-instance deployment); **forced password-change gate** enforced in `proxy.ts` (users with `forcePasswordChange` are redirected to `/change-password` everywhere except logout); security headers added in `next.config.ts` (CSP, HSTS, `X-Frame-Options: DENY`); privilege-escalation fix in `users.actions.ts`; client IP extraction helper (`src/lib/security/ipExtraction.ts`).
- [x] **E2E suite committed (Playwright)** — `e2e/role-redirects.spec.ts` (route-guard behavior per role) and `e2e/enrollment-assessment-payment.spec.ts` (full enroll → assess → pay scenario with **DB-level assertions**, not toast-text). Deterministic provisioning via `e2e/ensure-test-users.ts` / `ensure-test-data.ts` (synthetic `e2e_*` users, E2E-CASA students, dedicated `ZZ` OR booklet) + `global-setup.ts`. CI workflow added (`.github/workflows/ci.yml`).
- [x] **Idempotent payment posting** — the payment form sends a client-generated `idempotencyKey` (UUID per form mount); a retried submit returns the original payment instead of consuming a second OR (`payments_idempotency_key_uidx`, migration `0015_add_payment_idempotency_key`).
- [x] **DB-target safety banner** — `scripts/lib/db-target.ts` prints `target database: host:port/db` from every DB script (migrate/seed/seed-config/seed-registrations) to prevent running against the wrong instance (a stale local Postgres on 5432 had been silently absorbing host scripts; live dev DB is on **5434**).
- [x] **Smaller items** — `useHydrated` hook; soft-deleted guardian links excluded from student reads; gender options reduced to male/female across forms/queries; student directory sorting; `RegistrationQueueToolbar` + registration queue layout refresh; `advance_casa` assessment band for separate fee scheduling; pagination component refactor.

## Previous updates (2026-06-01)

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

- [x] **Students** — create/update with guardians, duplicate checks, list/profile/edit, **photo upload** with sharp optimization and Docker volume persistence (`actions/students.ts`, `admin/students/*`, `/api/students/[studentId]/photo`)
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
- [x] Playwright E2E suite — `e2e/role-redirects.spec.ts`, `e2e/enrollment-assessment-payment.spec.ts` with deterministic test-data provisioning (`ensure-test-users.ts`, `ensure-test-data.ts`) and DB-level assertions
- [x] CI workflow — `.github/workflows/ci.yml`
- [x] Scripts — `npm run test`, `npm run test:watch`, `npm run test:e2e`
- [x] Codebase audit — redirect patterns in 14 page templates audited; best practice documented for Next.js 16+

---

## In progress / known gaps

- [ ] **`registrations` workflow** — creation is now integrated during student onboarding; dedicated registration intake + approve/reject actions are still missing
- [x] **Login hardening** — `checkLoginRateLimits` wired into the login action (per-IP + per-username); forced password-change gate enforced in `proxy.ts`
- [ ] **OR receipt** — formal printable OR layout (beyond success message / browser print hooks)
- [ ] **Portal expansion** — `/portal/dashboard` exists, but `/portal/assessments`, `/portal/payments`, and `/portal/grades` pages are not implemented yet
- [x] **Dashboards** — Admin dashboard KPIs are live, and a reusable collection-summary + AR-aging insights section now renders on `/admin/dashboard` and `/staff/finance` (the latter promoted from a link hub to a real dashboard). Remaining Phase 10 items: enrollment summary and grade summary reports
- [x] **E2E** — Playwright suite committed (role redirects + full enrollment→assessment→payment scenario); grades flow not yet covered

---

## Not started (see roadmap)

- Phase 10 — enrollment-summary / grade-summary reports (the management **dashboard** with real data + AR aging and the report **export pipeline** are done — see above)
- Phase 12 remaining — production environment checklist + formal database backup strategy documentation (the prod Docker stack itself — runner image, migrate job, nginx, bind-mounted DB, security headers — is live; the old named volume `sram-mmhsi_db-data` is retained as an ad-hoc backup)

---

## Reference

Full phased checklist: `PROJECT_ROADMAP.md`.
