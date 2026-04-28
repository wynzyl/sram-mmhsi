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
- [ ] Auth session implementation (login action, session cookies)
- [ ] Route middleware with role redirect
- [ ] First DB migration applied
- [ ] `npm run dev` running cleanly

---

## Phase 2 — Authentication & Session Layer
**Status: ✅ Complete**

- [ ] Login action: credential validation, bcrypt compare, session creation
- [ ] Session validation helper for server actions
- [ ] Audit logging: user login / logout / failed login
- [ ] Rate limiting middleware on `/api/auth/*`
- [ ] Force-password-change flow
- [ ] Role-based dashboard redirect after login
- [ ] Protected route layout per role group (staff vs portal)
- [ ] Logout endpoint

---

## Phase 3 — Student Registration Module
**Status: ✅ Complete**

- [ ] Student creation form (Registrar)
- [ ] Parent/Guardian linking
- [ ] Registration submission
- [ ] Registration review (approve/reject) workflow
- [ ] Duplicate student detection
- [ ] Audit events: registration approved/rejected
- [ ] Student list/search table (TanStack Table)
- [ ] Student profile view page

---

## Phase 4 — Enrollment Module
**Status: 🟡 In Progress**

- [ ] New enrollment workflow (pending → assessed → enrolled)
- [ ] Re-enrollment from existing student record
- [ ] Grade level and section assignment
- [ ] Enrollment status management
- [ ] Audit events: enrollment created/cancelled

---

## Phase 5 — Assessment & Fee Schedule
**Status: ⏳ Not Started**

- [ ] Fee schedule configuration (Admin/Finance Officer)
- [ ] Assessment generation per enrollment
- [ ] Assessment item CRUD (tuition, fees, discounts)
- [ ] Assessment balance calculation
- [ ] Audit events: assessment created/revised

---

## Phase 6 — Payment Posting & OR Booklet
**Status: ⏳ Not Started**

- [ ] Receipt booklet management (Admin/Finance Officer)
- [ ] OR number auto-assignment on payment post
- [ ] Payment posting form (Cashier)
- [ ] Payment void workflow
- [ ] OR status tracking (consumed, voided)
- [ ] Payment allocation to assessment items
- [ ] Ledger balance recalculation
- [ ] Receipt generation/print view
- [ ] Audit events: payment posted/voided, booklet consumed/exhausted

---

## Phase 7 — Invoice Management
**Status: ⏳ Not Started**

- [ ] Invoice generation from assessment
- [ ] Invoice send via Gmail integration
- [ ] Invoice status tracking (draft → sent → viewed → settled)
- [ ] Invoice list view (Finance Officer)
- [ ] Audit events: invoice sent

---

## Phase 8 — Grade Encoding
**Status: ⏳ Not Started**

- [ ] Teacher assignment management (Admin)
- [ ] Grade entry per assigned class/subject/period (Teacher)
- [ ] Grade submission and lock workflow
- [ ] Grade period locking (Admin)
- [ ] Audit events: grade saved/submitted/locked

---

## Phase 9 — Student/Parent Portal
**Status: ⏳ Not Started**

- [ ] Portal login (student/parent accounts)
- [ ] Balance and payment history view
- [ ] Invoice view
- [ ] Grade view (per student)
- [ ] Responsive portal layout (mobile-friendly)

---

## Phase 10 — Reporting & Management Dashboard
**Status: ⏳ Not Started**

- [ ] Admin/Finance dashboard (collection summary, AR aging)
- [ ] Enrollment summary report (per school year)
- [ ] Grade summary report (per section/school year)
- [ ] Payment collection report
- [ ] Export to PDF/Excel (access-controlled, auditable)

---

## Phase 11 — Testing & Hardening
**Status: ⏳ Not Started**

- [ ] Unit tests: validators, RBAC, balance calculations
- [ ] Integration tests: registration flow, payment posting, grade submission
- [ ] E2E tests: login, registration-to-enrollment, cashier flow, grade encoding
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
