# PROJECT_STATUS.md — SRAMS

> Last updated: 2026-09-07

## System Overview

SRAMS (School Registration and Accounts Monitoring System) is a production-grade K-12 school management system. Core operations are implemented and deployed.

**Stack:** Next.js 16 · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · React 19 · JWT (jose)

---

## Feature Status

### Authentication & Users

| Feature | Status | Routes |
|---------|--------|--------|
| JWT-based login/logout | ✅ Complete | `/login` |
| Role-based access control | ✅ Complete | `proxy.ts` |
| Login rate limiting | ✅ Complete | Per-IP + per-username |
| Forced password change | ✅ Complete | `/change-password` |
| User management (CRUD) | ✅ Complete | `/admin/users/*` |
| Password reset | ✅ Complete | Admin-initiated |

**Roles:** `super_admin`, `admin`, `registrar`, `finance_officer`, `cashier`, `teacher`, `student`

---

### Students

| Feature | Status | Routes |
|---------|--------|--------|
| Student registration/creation | ✅ Complete | `/staff/register`, `/staff/students/new` |
| Student profile & edit | ✅ Complete | `/staff/students/[ref]`, `/staff/students/[ref]/edit` |
| Guardian management | ✅ Complete | Many-to-many with primary flag |
| Photo upload | ✅ Complete | Sharp optimization, Docker volumes |
| Student directory | ✅ Complete | `/staff/students` |
| Duplicate detection | ✅ Complete | Name + birthdate check |

---

### Registrations

| Feature | Status | Routes |
|---------|--------|--------|
| Registration queue view | ✅ Complete | `/staff/registrations` |
| Registration on student onboarding | ✅ Complete | Auto-creates approved record |
| Dedicated intake form | ⏳ Pending | — |
| Approve/reject workflow | ⏳ Pending | — |

---

### Enrollments

| Feature | Status | Routes |
|---------|--------|--------|
| Enrollment queue (5-tab interface) | ✅ Complete | `/staff/enrollments` |
| Ready to Enroll tab | ✅ Complete | Auto-populates eligible students |
| Pending/Assessed/Enrolled/Cancelled tabs | ✅ Complete | Badge counts, filters |
| One-click confirmation drawer | ✅ Complete | New/returning student layouts |
| Grade progression suggestions | ✅ Complete | For returning students |
| Balance warnings (non-blocking) | ✅ Complete | Previous year carryover |
| Global search & grade filters | ✅ Complete | URL persistence |
| Enrollment detail view | ✅ Complete | `/staff/enrollments/[id]` |
| Enrollment cancellation | ✅ Complete | With assessment cascade |
| Manual enrollment form | ✅ Complete | `/staff/enrollments/new` |

**Status flow:** `pending` → `assessed` → `enrolled` (or `cancelled`)

---

### Assessments

| Feature | Status | Routes |
|---------|--------|--------|
| Assessment creation from fee schedule | ✅ Complete | `/staff/assessments/new/[enrollmentId]` |
| Assessment ledger view | ✅ Complete | `/staff/assessments/[id]` |
| Assessment items management | ✅ Complete | Line items from fee catalog |
| Assessment cancellation | ✅ Complete | With re-assessment support |
| Assessment list/search | ✅ Complete | `/staff/assessments` |
| Discount application | ✅ Complete | Via discount requests |

**Status flow:** `draft` → `finalized` (or `cancelled`)

---

### Payments & OR Tracking

| Feature | Status | Routes |
|---------|--------|--------|
| OR booklet management | ✅ Complete | `/staff/finance/booklets/*` |
| Payment posting (cashier) | ✅ Complete | `/staff/payments/process/[assessmentId]` |
| OR number auto-assignment | ✅ Complete | Sequential from active booklet |
| Multiple active booklets | ✅ Complete | Cashier selects at posting |
| Payment allocations | ✅ Complete | Distributes across items |
| Payment void requests | ✅ Complete | `/staff/void-requests` |
| Void approval workflow | ✅ Complete | Admin approval required |
| Reverse-chronological void | ✅ Complete | Most recent first |
| Idempotent posting | ✅ Complete | UUID prevents double-post |
| Cash discount (full payment) | ✅ Complete | Eligibility check + preview |
| Payments dashboard | ✅ Complete | `/staff/payments/dashboard` |
| Payment history | ✅ Complete | `/staff/payments` |
| Printable OR receipt | ⏳ Pending | — |

**OR lifecycle:** `available` → `consumed` (or `voided` — never reused)

**Booklet status:** `active` → `exhausted` (or `voided`)

---

### Student Ledgers

| Feature | Status | Routes |
|---------|--------|--------|
| Student ledger view | ✅ Complete | `/staff/student-ledgers` |
| Running balance tracking | ✅ Complete | Debit/credit entries |
| Multi-year ledger history | ✅ Complete | Per school year |

---

### Discounts

| Feature | Status | Routes |
|---------|--------|--------|
| Discount types management | ✅ Complete | `/staff/finance/discount-types` |
| Discount requests | ✅ Complete | `/staff/finance/discount-requests` |
| Discount approval workflow | ✅ Complete | Admin/finance approval |
| Auto-reject on assessment cancel | ✅ Complete | Cascade logic |

---

### Invoices

| Feature | Status | Routes |
|---------|--------|--------|
| Invoice generation | ✅ Complete | From assessment |
| Invoice list & detail | ✅ Complete | `/staff/finance/invoices/*` |
| Invoice PDF export | ✅ Complete | `@react-pdf/renderer` |
| Email sending (Gmail/Nodemailer) | ✅ Complete | HTML template |
| Batch invoice generation | ✅ Complete | `/staff/finance/invoices/batch` |
| Batch send | ✅ Complete | `/staff/finance/invoices/batch-send` |

**Status flow:** `draft` → `sent` → `viewed` → `settled` (or `overdue`)

---

### Finance Setup

| Feature | Status | Routes |
|---------|--------|--------|
| Fee schedules | ✅ Complete | `/staff/finance/fee-schedules/*` |
| Fee templates | ✅ Complete | `/staff/finance/fee-templates/*` |
| Fee item types | ✅ Complete | `/staff/finance/fee-item-types` |
| Finance dashboard | ✅ Complete | `/staff/finance` |
| Finance setup wizard | ✅ Complete | `/staff/finance/setup` |

---

### Academics — Curriculum

| Feature | Status | Routes |
|---------|--------|--------|
| Curriculum management | ✅ Complete | `/staff/academics/curriculums/*` |
| Curriculum detail/edit | ✅ Complete | CRUD operations |
| Curriculum cloning | ✅ Complete | `/staff/academics/curriculums/[id]/clone` |
| Curriculum adoption | ✅ Complete | `/staff/academics/curriculums/adoptions` |
| Subject management | ✅ Complete | Per curriculum + grade level |
| Strands (SHS tracks) | ✅ Complete | `/staff/academics/strands` |
| Electives | ✅ Complete | `/staff/academics/electives` |

---

### Academics — Sections & Assignments

| Feature | Status | Routes |
|---------|--------|--------|
| Section management | ✅ Complete | `/staff/academics/sections/*` |
| Section detail view | ✅ Complete | `/staff/academics/sections/[id]` |
| Section assignments | ✅ Complete | `/staff/academics/section-assignments` |
| Adviser assignments | ✅ Complete | `/staff/academics/advisers` |
| Coordinator assignments | ✅ Complete | `/staff/academics/coordinators` |

---

### Grades — Adviser Workflow (Primary)

| Feature | Status | Routes |
|---------|--------|--------|
| Section grade sheets | ✅ Complete | `/staff/grades/sections/[sectionId]` |
| Grade entry grid | ✅ Complete | All subjects per student |
| Grade sheet detail | ✅ Complete | `/staff/grades/sheets/[sheetId]` |
| Completion validation | ✅ Complete | Client + server side |
| Submit for approval | ✅ Complete | `draft` → `submitted` |
| Sequential period locking | ✅ Complete | Q1 → Q2 → Q3 → Q4 |
| Grade approval workflow | ✅ Complete | `/staff/grades/approvals` |
| Return for revision | ✅ Complete | `submitted` → `returned` |
| Locked grades view | ✅ Complete | `/staff/grades/locked` |
| Grade publishing | ✅ Complete | `/staff/grades/publish` |
| Published grades view | ✅ Complete | `/staff/grades/published` |
| Grades dashboard | ✅ Complete | `/staff/grades` |

**Sheet status flow:** `draft` → `submitted` → `approved` (or `returned`)

**Grading periods:** Q1, Q2, Q3, Q4 (quarterly) or T1, T2, T3 (trimester)

---

### Approvals Hub

| Feature | Status | Routes |
|---------|--------|--------|
| Centralized approvals page | ✅ Complete | `/staff/approvals` |
| Grade sheet approvals | ✅ Complete | Batch operations |
| Discount approvals | ✅ Complete | Admin/finance |
| Void request approvals | ✅ Complete | Admin only |
| Cancellation request approvals | ✅ Complete | `/admin/cancellation-requests/*` |

---

### Student Archival & EOY Processing

| Feature | Status | Routes |
|---------|--------|--------|
| Archive directory | ✅ Complete | `/staff/archive` |
| Student archive detail | ✅ Complete | `/staff/archive/[id]` |
| Lifecycle status management | ✅ Complete | active/graduated/transferred/withdrawn/cancelled/inactive |
| Batch archive operations | ✅ Complete | Multi-select + bulk status change |
| Performance indexes | ✅ Complete | Migration `0003_add_archive_indexes.sql` |

---

### Document Requests

| Feature | Status | Routes |
|---------|--------|--------|
| Document request list | ✅ Complete | `/staff/archive/documents` |
| Document request detail | ✅ Complete | `/staff/archive/documents/[id]` |
| Request workflow | ✅ Complete | request → processing → ready → released |
| Eligibility gates | ✅ Complete | For archived/active students |
| Release tracking | ✅ Complete | With audit |

---

### Clearances

| Feature | Status | Routes |
|---------|--------|--------|
| Clearance management | ✅ Complete | `/staff/clearances/*`, `/admin/clearances/*` |
| Clearance detail | ✅ Complete | `/staff/clearances/[clearanceId]` |
| Clearance workflow | ✅ Complete | Multi-department sign-off |

---

### School Years

| Feature | Status | Routes |
|---------|--------|--------|
| School year management | ✅ Complete | `/staff/school-years/*` |
| Create/edit school year | ✅ Complete | `/staff/school-years/new`, `[id]/edit` |
| Active year designation | ✅ Complete | One active at a time |

---

### Reports & Exports

| Feature | Status | Routes |
|---------|--------|--------|
| Payment Collection report | ✅ Complete | `/staff/reports/payment-collection` |
| Balance Forwards report | ✅ Complete | `/staff/reports/balance-forwards` |
| Student List (masterlist) | ✅ Complete | `/staff/reports/student-list` |
| Accounts Receivable report | ✅ Complete | `/staff/reports/accounts-receivable` |
| PDF export (`@react-pdf/renderer`) | ✅ Complete | All reports |
| Excel export (`exceljs`) | ✅ Complete | All reports |
| Invoice PDF | ✅ Complete | Per invoice |
| Enrollment summary report | ⏳ Pending | — |
| Grade summary report | ⏳ Pending | — |

---

### Dashboards

| Feature | Status | Routes |
|---------|--------|--------|
| Admin dashboard | ✅ Complete | `/admin/dashboard` |
| Staff dashboard | ✅ Complete | `/staff/dashboard` |
| Finance dashboard | ✅ Complete | `/staff/finance` |
| Payments dashboard | ✅ Complete | `/staff/payments/dashboard` |
| Collection summary + AR aging | ✅ Complete | Reusable component |

---

### Student/Parent Portal

| Feature | Status | Routes |
|---------|--------|--------|
| Portal dashboard | ✅ Complete | `/portal/dashboard` |
| Portal password change | ✅ Complete | `/portal/change-password` |
| Portal assessments view | ⏳ Pending | `/portal/assessments` (route exists, content pending) |
| Portal payments view | ⏳ Pending | `/portal/payments` (route exists, content pending) |
| Portal grades view | ⏳ Pending | `/portal/grades` (route exists, content pending) |

---

### Settings

| Feature | Status | Routes |
|---------|--------|--------|
| Cancellation settings | ✅ Complete | `/admin/settings/cancellation` |
| System settings | ✅ Complete | Various admin settings |

---

### Cancellation Requests

| Feature | Status | Routes |
|---------|--------|--------|
| Cancellation request list | ✅ Complete | `/admin/cancellation-requests` |
| Request detail & approval | ✅ Complete | `/admin/cancellation-requests/[requestId]` |
| Staff cancelled view | ✅ Complete | `/staff/enrollments/cancelled` |

---

### Record Verification

| Feature | Status | Routes |
|---------|--------|--------|
| Verify records page | ✅ Complete | `/staff/verify-records` |

---

## Infrastructure Status

| Component | Status |
|-----------|--------|
| Docker multi-stage build | ✅ Complete |
| PostgreSQL 15 + migrations | ✅ Complete |
| Nginx reverse proxy | ✅ Complete |
| Resource limits (memory/CPU) | ✅ Complete |
| Security headers (CSP, HSTS) | ✅ Complete |
| Playwright E2E suite | ✅ Complete |
| Vitest unit tests | ✅ Complete |
| CI workflow (GitHub Actions) | ✅ Complete |
| Instant navigation (Suspense) | ✅ Complete |

---

## Pending Items

### High Priority
- [ ] Portal detail pages (`/portal/assessments`, `/portal/payments`, `/portal/grades`)
- [ ] Printable OR receipt layout

### Medium Priority
- [ ] Dedicated registration intake form
- [ ] Registration approve/reject workflow
- [ ] Enrollment summary report
- [ ] Grade summary report

### Low Priority
- [ ] Formal database backup documentation
- [ ] Additional E2E coverage (grades flow)

---

## Reference

- `CLAUDE.md` — Development patterns and coding standards
- `SRAMS_OR_WORKFLOW.md` — OR tracking workflow details
- `PROJECT_ROADMAP.md` — Full phased checklist
- `memory.md` — Session decisions and debugging notes
