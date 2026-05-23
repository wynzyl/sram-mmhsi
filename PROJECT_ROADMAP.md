# PROJECT_ROADMAP.md — SRAMS

> Per SRAMS Engineering spec §16 — Delivery Procedure

> Last sync: 2026-05-23

### Current update highlights (2026-05-23)
- **Assessment cancellation & reassessment** — Fixed re-assessment blocking issue; students can now receive new assessments after cancellation.
- **Discount auto-rejection** — Linked discount requests are automatically rejected when assessments are cancelled.
- **Applied discounts in profile** — Student profile now shows discounts applied to current assessment.
- **Client-side navigation fix** — Resolved blank screen on `/staff/students` by replacing redirect-to-add-default-param pattern with direct value usage. Audited 14 page templates; documented best practice for Next.js 16+ redirect patterns.

### Previous highlights (2026-05-13)
- **Enrollment queue query optimization** — `getReadyToEnrollStudents()` rewritten with SQL-level pagination using CTEs and UNION ALL. Memory usage reduced from ~47MB to ~50KB per page load (for 5000 students). Query execution time ~60-119ms.
- **SQL-level document completeness** — Moved `areDocumentsComplete()` logic to SQL CASE expression, eliminating JavaScript post-processing.

### Previous highlights (2026-05-11)
- **Library migration completed** — All 58 files migrated from `lib/` to `src/lib/` for unified source structure. All application code now under `src/` directory with git history preserved via `git mv`.
- **Architecture alignment** — Path alias `@/lib/*` updated in tsconfig.json; cleaner project structure aligned with modern Next.js conventions and monorepo best practices.

### Previous highlights (2026-05-08)
- **Enrollment queue system** now operational with list-first workflow — students automatically populate when eligible, global filters persist across tabs via URL params, and one-click confirmation replaces multi-step wizard.
- Auto-population of old students with grade progression and balance warnings; new/transferee students flow from approved registrations.
- Queue architecture includes 5-tab interface (Ready/Pending/Assessed/Enrolled/Cancelled) with parallel data loading and client-side filtering for instant response.
- Near-term priority remains unchanged: close registration review workflow, portal detail pages, auth hardening, and E2E coverage.

---

## Phase 1 — Project Initialization & Base Scaffold
**Status: ✅ Complete**

- [x] Next.js scaffold and locked stack installation
- [x] Folder structure per Engineering spec §7
- [x] Docker Compose (PostgreSQL + pgAdmin)
- [x] Database schema (all entities from §11)
- [x] RBAC permission map (§10)
- [x] Environment validation (§8.1)
- [x] Structured logger (§14)
- [x] Login page UI
- [x] Auth session implementation (JWT `jose`, httpOnly cookie, `actions/auth.ts`)
- [x] Route protection (`proxy.ts` — staff vs portal vs admin; Next.js 16 proxy convention replaces `middleware.ts`)
- [x] DB migrations applied (`drizzle/0000` … `0008`+ as generated)
- [x] `npm run dev` baseline

---

## Phase 2 — Authentication & Session Layer
**Status: 🟡 Mostly complete**

- [x] Login action: credential validation, bcrypt compare, session creation
- [x] Session validation helper for server actions (`requireSession`, `src/lib/auth/session.ts`)
- [x] Audit logging: user login success / failed login
- [ ] Rate limiting middleware on `/api/auth/*` — `src/lib/security/rateLimit.ts` exists; not wired to login yet
- [ ] Force-password-change flow — field + admin reset exist; no post-login gate enforcing change
- [x] Role-based landing redirect after login (`auth.ts` + `proxy.ts`)
- [x] Protected route behavior per role group (staff vs portal vs admin-only)
- [x] Logout action (`logoutAction`)

---

## Phase 3 — Student Registration Module
**Status: 🟡 Mostly complete**

- [x] Student creation form (Registrar / permitted roles) — `admin/students/new`
- [x] Parent/Guardian linking — `createStudentAction` / `updateStudentAction`
- [x] Registration submission during student onboarding — `createStudentAction` inserts approved `registrations` rows in same transaction
- [ ] Dedicated registration intake action (separate from student-create flow)
- [ ] Registration review (approve/reject) workflow (NOT Implemented)
- [x] Duplicate student detection (name / optional DOB / LRN)
- [x] Audit events: student created / updated
- [x] Student list/search table (TanStack Table)
- [x] Student profile + edit pages
- [x] Registration queue pages for admin/staff (`/admin/registrations`, `/staff/registrations`) with school-year filtering + pagination

---

## Phase 4 — Enrollment Module
**Status: ✅ Complete (Enhanced with queue-based workflow)**

- [x] **Queue-based enrollment workflow** with automatic student eligibility detection (`src/lib/queries/enrollment-queue.ts`)
- [x] **Auto-population** of old students from previous year with grade progression and balance warnings
- [x] **Global filters** with URL persistence — search by name/ID, filter by grade level across all tabs
- [x] **5-tab interface** (Ready to Enroll, Pending, Assessed, Enrolled, Cancelled) with badge counts
- [x] **EnrollmentConfirmationDrawer** for one-click enrollment with student type-aware layouts
- [x] Enrollment workflow (pending → assessed → enrolled, plus cancellation rules)
- [x] Re-enrollment from existing student record (new enrollment for active school year)
- [x] Grade level and section assignment
- [x] Enrollment status management (`actions/enrollment-confirmation.ts`)
- [x] Audit events: enrollment created / status changes / cancellation
- [x] Manual entry form preserved at `/staff/enrollments/new` for edge cases

---

## Phase 5 — Assessment & Fee Schedule
**Status: ✅ Complete**

- [x] Fee schedule configuration (Admin/Finance Officer)
- [x] Assessment generation per enrollment
- [x] Assessment item CRUD (tuition, fees, discounts)
- [x] Assessment balance calculation
- [x] Assessment draft creation UX refresh (student context + fee-catalog line visibility + computed net summary)
- [x] Assessment cancellation with re-assessment support (students can receive new assessment after cancellation)
- [x] Discount request workflow with auto-rejection on assessment cancellation
- [x] Applied discounts visibility in student profile
- [x] Audit events: assessment created/revised; cancellation metadata (migration `0008`)

---

## Phase 6 — Payment Posting & OR Booklet
**Status: 🟡 Mostly complete**

- [x] Receipt booklet management (Admin/Finance Officer)
- [x] OR number auto-assignment on payment post
- [x] Payment posting UI (Cashier) — embedded on assessment ledger (`AssessmentLedgerRegister` / `PostPaymentForm`)
- [x] Shared internal assessment-ledger composition to support consistent payment posting and RBAC checks
- [x] Payment void workflow
- [x] OR status tracking (consumed, voided)
- [x] Payment allocation to assessment items
- [x] Ledger balance recalculation
- [ ] Dedicated receipt generation/print view (button label references print; formal OR receipt layout TBD)
- [x] Audit events: payment posted/voided, booklet consumed/exhausted

---

## Phase 7 — Invoice Management
**Status: ✅ Complete**

- [x] Invoice generation from assessment
- [x] Invoice send via Gmail integration
- [x] Invoice status tracking (draft → sent → viewed → settled)
- [x] Invoice list view (Finance Officer)
- [x] Audit events: invoice sent

---

## Phase 8 — Grade Encoding
**Status:  NOT STARTED**

- [ ] Teacher assignment management (Admin)
- [ ] Grade entry per assigned class/subject/period (Teacher) — `/staff/grades`
- [ ] Grade submission and lock workflow
- [ ] Grade period locking (Admin)
- [ ] Audit events: grade saved/submitted/locked

---

## Phase 9 — Student/Parent Portal
**Status: 🟡 In progress**

- [x] Portal route guard and role landing to `/portal/dashboard`
- [x] Portal dashboard page scaffold (`/portal/dashboard`)
- [ ] Balance and payment history view
- [ ] Invoice view
- [ ] Grade view (per student)
- [ ] Responsive portal layout (mobile-friendly)

---

## Phase 10 — Reporting & Management Dashboard
**Status: ⏳ Not Started**

- [ ] Admin/Finance dashboard (collection summary, AR aging) — admin dashboard shell exists with placeholder metrics
- [ ] Enrollment summary report (per school year)
- [ ] Grade summary report (per section/school year)
- [ ] Payment collection report
- [ ] Export to PDF/Excel (access-controlled, auditable)

---

## Phase 11 — Testing & Hardening
**Status: 🟡 In progress**

- [x] Unit tests: validators (`assessment.test.ts`), enrollment helpers (`enrollment-grade.test.ts`, `enrollment-payment.test.ts`)
- [ ] Integration tests: registration flow, payment posting, grade submission
- [ ] E2E tests — Playwright dependency present; suite/config not yet in repo
- [ ] Security tests: route protection, action-level permission, session expiry
- [x] Performance optimization: enrollment queue query (`getReadyToEnrollStudents`) — SQL-level pagination with CTEs/UNION ALL (47MB → 50KB memory per page)
- [x] **Client-side navigation audit** — Audited 14 page templates for redirect patterns; documented best practice for Next.js 16+ (avoid redirect-to-add-default-param; use direct value instead)
- [ ] Performance tests: student search, ledger queries

---

## Phase 12 — Deployment Preparation
**Status: ⏳ Not Started**

- [ ] Production Docker configuration
- [ ] Reverse proxy setup (nginx)
- [ ] Security headers (CSP, HSTS, X-Frame-Options)
- [ ] Production environment checklist
- [ ] Database backup strategy documentation
