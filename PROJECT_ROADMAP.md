# PROJECT_ROADMAP.md — SRAMS

> Per SRAMS Engineering spec §16 — Delivery Procedure

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
- [x] Route protection (`proxy.ts` — staff vs portal vs admin; Next.js 16 proxy convention)
- [x] DB migrations applied (`drizzle/0000` … `0008`+ as generated)
- [x] `npm run dev` baseline

---

## Phase 2 — Authentication & Session Layer
**Status: 🟡 Mostly complete**

- [x] Login action: credential validation, bcrypt compare, session creation
- [x] Session validation helper for server actions (`requireSession`, `lib/auth/session.ts`)
- [x] Audit logging: user login success / failed login
- [ ] Rate limiting middleware on `/api/auth/*` — `lib/security/rateLimit.ts` exists; not wired to login yet
- [ ] Force-password-change flow — field + admin reset exist; no post-login gate enforcing change
- [x] Role-based landing redirect after login (`auth.ts` + `proxy.ts`)
- [x] Protected route behavior per role group (staff vs portal vs admin-only)
- [x] Logout action (`logoutAction`)

---

## Phase 3 — Student Registration Module
**Status: 🟡 Mostly complete**

- [x] Student creation form (Registrar / permitted roles) — `admin/students/new`
- [x] Parent/Guardian linking — `createStudentAction` / `updateStudentAction`
- [ ] Registration submission — `registrations` table + list UI exist; no create/review server actions yet
- [ ] Registration review (approve/reject) workflow
- [x] Duplicate student detection (name / optional DOB / LRN)
- [x] Audit events: student created / updated
- [x] Student list/search table (TanStack Table)
- [x] Student profile + edit pages

---

## Phase 4 — Enrollment Module
**Status: ✅ Complete**

- [x] Enrollment workflow (pending → assessed → enrolled, plus cancellation rules)
- [x] Re-enrollment from existing student record (new enrollment for active school year)
- [x] Grade level and section assignment
- [x] Enrollment status management (`actions/enrollments.ts`)
- [x] Audit events: enrollment created / status changes / cancellation

---

## Phase 5 — Assessment & Fee Schedule
**Status: ✅ Complete**

- [x] Fee schedule configuration (Admin/Finance Officer)
- [x] Assessment generation per enrollment
- [x] Assessment item CRUD (tuition, fees, discounts)
- [x] Assessment balance calculation
- [x] Audit events: assessment created/revised; cancellation metadata (migration `0008`)

---

## Phase 6 — Payment Posting & OR Booklet
**Status: 🟡 Mostly complete**

- [x] Receipt booklet management (Admin/Finance Officer)
- [x] OR number auto-assignment on payment post
- [x] Payment posting UI (Cashier) — embedded on assessment ledger (`AssessmentLedgerRegister` / `PostPaymentForm`)
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
**Status: ✅ Complete**

- [x] Teacher assignment management (Admin)
- [x] Grade entry per assigned class/subject/period (Teacher) — `/staff/grades`
- [x] Grade submission and lock workflow
- [x] Grade period locking (Admin)
- [x] Audit events: grade saved/submitted/locked

---

## Phase 9 — Student/Parent Portal
**Status: ⏳ Not Started**

- [ ] Portal routes (`/portal/*` guarded in `proxy.ts`; pages not implemented)
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
- [ ] Performance tests: student search, ledger queries

---

## Phase 12 — Deployment Preparation
**Status: ⏳ Not Started**

- [ ] Production Docker configuration
- [ ] Reverse proxy setup (nginx)
- [ ] Security headers (CSP, HSTS, X-Frame-Options)
- [ ] Production environment checklist
- [ ] Database backup strategy documentation
