# PROJECT_ROADMAP.md — SRAMS

> Last updated: 2026-09-07

This document outlines completed phases, current work, and future feature roadmap for SRAMS.

---

## Completed Phases

### Phase 1 — Infrastructure & Scaffold ✅

- Next.js 16 + TypeScript + Tailwind CSS 4 + App Router
- PostgreSQL + Drizzle ORM + migrations
- Docker Compose (dev + prod)
- RBAC permission system
- Structured logging
- Environment validation

### Phase 2 — Authentication ✅

- JWT-based sessions (jose library)
- Login/logout with bcrypt
- Role-based route protection (`proxy.ts`)
- Login rate limiting (per-IP + per-username)
- Forced password change flow
- Security headers (CSP, HSTS, X-Frame-Options)
- Audit logging (login success/failure)

### Phase 3 — Student Registration ✅

- Student CRUD with guardian linking
- Multi-step registration wizard (TanStack Form)
- Duplicate detection (name + DOB)
- Photo upload with optimization (sharp/WebP)
- Registration queue views
- Student archival & EOY processing
- Document requests workflow

### Phase 4 — Enrollment ✅

- Queue-based enrollment workflow (5-tab interface)
- Auto-population from previous year
- Grade progression suggestions
- Balance warnings (non-blocking)
- One-click confirmation drawer
- Global search & grade filters
- Enrollment cancellation with cascade

### Phase 5 — Assessment & Fees ✅

- Fee schedule configuration
- Assessment generation per enrollment
- Assessment items (tuition, fees, discounts)
- Balance calculation
- Assessment cancellation with re-assessment
- Discount request workflow
- Auto-reject discounts on assessment cancel

### Phase 6 — Payments & OR Tracking ✅

- OR booklet management
- Payment posting with OR auto-assignment
- Multiple active booklets support
- Payment allocations
- Void workflow (reverse-chronological)
- Idempotent posting (UUID key)
- Cash discount for full payment
- Ledger balance tracking

### Phase 7 — Invoices ✅

- Invoice generation from assessment
- PDF export (@react-pdf/renderer)
- Email sending (Gmail/Nodemailer)
- Batch generation & send
- Status tracking (draft → sent → viewed → settled)

### Phase 8 — Grade Encoding ✅

- Adviser-based grade sheet workflow (primary)
- Section grade entry grid
- Completion validation (client + server)
- Sequential period locking (Q1 → Q2 → Q3 → Q4)
- Submit → Approve/Return workflow
- Grade publishing
- Legacy teacher assignment workflow
- N+1 query optimizations

### Phase 9 — Student Portal 🟡

- ✅ Portal dashboard
- ✅ Portal password change
- ⏳ Assessments view
- ⏳ Payments view
- ⏳ Grades view

### Phase 10 — Reports ✅

- Report pipeline (PDF + Excel)
- Payment Collection report
- Balance Forwards report
- Student List (masterlist)
- Accounts Receivable report
- Invoice PDF export
- Admin/Finance dashboards

### Phase 11 — Testing 🟡

- ✅ Vitest unit tests
- ✅ Playwright E2E (auth, enrollment → payment flow)
- ✅ CI workflow (GitHub Actions)
- ⏳ Integration tests
- ⏳ Security tests
- ⏳ Grades E2E coverage

### Phase 12 — Deployment ✅

- Docker multi-stage build
- Nginx reverse proxy
- Static file serving for uploads
- Resource limits (memory/CPU)
- Production hardening

---

## Current Sprint

| Item | Status | Priority |
|------|--------|----------|
| Portal assessments page | ⏳ Pending | High |
| Portal payments page | ⏳ Pending | High |
| Portal grades page | ⏳ Pending | High |
| Printable OR receipt | ⏳ Pending | Medium |
| Registration intake form | ⏳ Pending | Medium |
| Registration approve/reject | ⏳ Pending | Medium |
| Enrollment summary report | ⏳ Pending | Low |
| Grade summary report | ⏳ Pending | Low |

---

## Future Roadmap

### Phase 13 — Online Payment Integration

| Feature | Description | Priority |
|---------|-------------|----------|
| Payment gateway integration | Stripe/PayMongo for credit card, GCash, Maya | High |
| Online payment portal | Student/parent can pay online | High |
| Payment confirmation webhooks | Auto-post payments on gateway confirmation | High |
| Partial online payments | Support installments via gateway | Medium |
| Payment receipt email | Auto-send receipt on successful payment | Medium |
| Refund processing | Handle gateway refunds with ledger sync | Low |

### Phase 14 — Mobile App / PWA

| Feature | Description | Priority |
|---------|-------------|----------|
| Progressive Web App | Installable mobile experience | High |
| Push notifications | Payment reminders, grade releases | High |
| Offline grade viewing | Cache grades for offline access | Medium |
| Mobile payment flow | Streamlined mobile checkout | Medium |
| Biometric login | Fingerprint/Face ID for portal | Low |

### Phase 15 — Communication & Notifications

| Feature | Description | Priority |
|---------|-------------|----------|
| SMS notifications | Payment reminders, enrollment updates | High |
| Email templates | Customizable email templates | High |
| In-app notifications | Notification center in portal | Medium |
| Announcement system | School-wide announcements | Medium |
| Parent-teacher messaging | Direct messaging feature | Low |

### Phase 16 — Advanced Academics

| Feature | Description | Priority |
|---------|-------------|----------|
| Class scheduling | Automated class schedule generation | High |
| Attendance tracking | Daily attendance with reports | High |
| Report card generation | Official report card PDF | High |
| Transcript generation | Official transcript of records | Medium |
| Learning management | Assignment posting, submissions | Medium |
| Online exams | Quiz/exam module with grading | Low |

### Phase 17 — Advanced Finance

| Feature | Description | Priority |
|---------|-------------|----------|
| Payment plans | Installment plan configuration | High |
| Auto-late fees | Automatic late fee assessment | High |
| Financial aid management | Scholarship tracking | Medium |
| Budget tracking | School budget vs actual | Medium |
| Bank reconciliation | Match bank statements to payments | Low |
| Multi-currency support | For international students | Low |

### Phase 18 — Analytics & BI

| Feature | Description | Priority |
|---------|-------------|----------|
| Enrollment analytics | Trends, projections, demographics | High |
| Financial analytics | Revenue trends, collection rates | High |
| Academic analytics | Grade distributions, pass rates | Medium |
| Custom report builder | User-defined report creation | Medium |
| Data export API | External BI tool integration | Low |
| Predictive analytics | At-risk student identification | Low |

### Phase 19 — Multi-Campus / SaaS

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-tenant architecture | Support multiple schools | High |
| Campus-level admin | Per-campus user management | High |
| Centralized reporting | Cross-campus consolidated reports | Medium |
| White-labeling | Custom branding per school | Medium |
| Subscription billing | SaaS pricing tiers | Low |

### Phase 20 — Integrations

| Feature | Description | Priority |
|---------|-------------|----------|
| DepEd LIS integration | Learner Information System sync | High |
| Google Workspace | SSO, Calendar, Classroom | Medium |
| Microsoft 365 | SSO, Teams integration | Medium |
| Accounting software | QuickBooks, Xero export | Medium |
| Student ID printing | ID card generation with barcode | Low |
| Library system | Book checkout integration | Low |

### Phase 21 — Security & Compliance

| Feature | Description | Priority |
|---------|-------------|----------|
| Two-factor authentication | TOTP/SMS 2FA for staff | High |
| Session management | View/revoke active sessions | High |
| Data privacy compliance | GDPR/DPA audit tools | High |
| Audit log export | Compliance reporting | Medium |
| Data retention policies | Automated data archival | Medium |
| Penetration testing | Security audit & fixes | Medium |

### Phase 22 — Performance & Scale

| Feature | Description | Priority |
|---------|-------------|----------|
| Database read replicas | Scale read operations | Medium |
| CDN for static assets | Faster global delivery | Medium |
| Background job queue | Async processing (reports, emails) | Medium |
| API rate limiting | Per-user API throttling | Low |
| Horizontal scaling | Multi-instance deployment | Low |

---

## Technical Debt

| Item | Description | Priority |
|------|-------------|----------|
| Legacy teacher workflow | Deprecate in favor of adviser workflow | Low |
| Form pattern migration | Remaining forms to TanStack Form | Low |
| Test coverage gaps | Integration + security tests | Medium |
| API documentation | OpenAPI/Swagger spec | Low |
| Code documentation | JSDoc for core functions | Low |

---

## Reference

- `PROJECT_STATUS.md` — Current feature implementation status
- `CLAUDE.md` — Development patterns and coding standards
- `SRAMS_OR_WORKFLOW.md` — OR tracking workflow details
- `memory.md` — Session decisions and debugging notes
