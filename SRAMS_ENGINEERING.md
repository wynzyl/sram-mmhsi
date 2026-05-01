# ENGINEERING_SKELETON.md — School Registration and Accounts Monitoring System

This file is the operating contract for any AI coding assistant, engineer, or contributor working in this repository. Treat it as **architecture and delivery guidance**, not casual suggestions.

This document is the **project-specific completed version** of the generic engineering skeleton for the **School Registration and Accounts Monitoring System (SRAMS)**.

---

## 1. Project Identity

- **Project Name:** `School Registration and Accounts Monitoring System (SRAMS)`  
- **Project Type:** `Internal web-based school operations and financial monitoring system`  
- **Primary Users:** `Admin, Registrar, Finance Officer, Cashier, Teacher, Student, Parent/Guardian`  
- **Deployment Context:** `Private Casa K–12 school deployment, primarily desktop-first internal operations with controlled student/parent portal access`  
- **Regulatory / Compliance Context:** `Handles student records, grades, payment records, and personal data; must follow data privacy, role-based access, auditability, and financial record integrity requirements`

### Rules

- Define the system clearly in one sentence.  
  - **System Definition:** A centralized school operations platform for registration, enrollment, student records, assessment, payments, grades, and management reporting.
- State who uses it.  
  - School administrators, registrars, finance staff, cashiers, teachers, students and parents/guardians.
- State whether it is internal, external, regulated, public-facing, or operational.  
  - Primarily internal and operational, with controlled external portal access for students and parents.
- State whether it handles sensitive, financial, medical, legal, or personal data.  
  - Handles sensitive personal data, academic data, and financial transaction records.
- If the project identity is vague, implementation must not proceed.

---

## 2. Goal

The project goals are concrete, testable, and operational.

1. Centralize registration, enrollment, assessment, payment posting, and grade viewing into one system.  
2. Reduce manual and repetitive registration and student lookup work for registrar staff.  
3. Maintain accurate student, assessment, payment, and grade records with traceable update history.  
4. Enforce strict role-based access across academic, operational, and finance workflows.  
5. Provide auditable financial posting, invoice sending, and record changes for school management review.  
6. Deliver a maintainable, modular, deployment-ready internal system suitable for a small-to-mid private school.

### Rules

- Every architectural decision must support one or more goals.  
- If a requested feature does not clearly support the goals, it must be challenged before implementation.  
- Goals must be specific enough to reject out-of-scope work.

---

## 3. Role of the AI / Engineer

Act in the following capacities:

- **Senior Full-Stack Engineer**  
- **Database / Systems Designer**  
- **Security Engineer**  
- **Domain Workflow Analyst**  
- **QA / Test Designer**  
- **DevOps / Deployment Engineer**

### Operating Procedure

When asked to implement a feature:

1. Check `PROJECT_STATUS.md` first.  
2. Check `PROJECT_ROADMAP.md` first.  
3. Confirm the feature is in scope for the current phase.  
4. Write a TODO list before coding.  
5. Reuse existing components, helpers, and patterns before creating new ones.  
6. State assumptions explicitly.  
7. Identify risk areas before implementation.  
8. Identify required tests before implementation.

### Rules

- Do not behave like a tutorial bot.  
- Do not jump directly into code without checking scope and current project state.  
- Do not introduce new architecture casually.

---

## 4. Delivery Structure

- **Application Type:** `Web app / internal operations system with controlled external portal access`  
- **Primary Interface:** `Desktop-first browser interface for Admin, Registrar, Finance Officer, Cashier, and Teacher`  
- **Secondary Interface:** `Responsive portal for Student and Parent/Guardian viewing of balance, assessments, payments, and grades`  
- **Supported Viewports / Devices:** `Desktop and laptop required; tablet acceptable for light use; mobile supported only for student/parent portal viewing, not primary staff operations`  
- **Architecture Style:** `Modular monolith`  
- **Repository Shape:** `Single package or monorepo with one main web application package; MVP defaults to single repository`

### Rules

- Define what the project is.  
  - It is an operational school records, billing, and academic monitoring system.
- Define what the project is not.  
  - It is not an LMS, not a public marketing website, not a payroll system, and not a full HR system.
- Define whether MVP excludes any platforms.  
  - MVP excludes native mobile apps.
- Define whether API-only routes are allowed and for what purpose.  
  - API routes are allowed only for integrations, webhooks, file export triggers, and auth/session support where needed.
- Define whether third-party callbacks/webhooks are allowed.  
  - Allowed only for Stripe and tightly controlled integration endpoints.

---

## 5. UI / UX Operating Rules

- **Audience Context:** `School office staff working in high-volume operational flows; they need fast retrieval, dense information, and low-friction transaction screens`  
- **Design Priority:** `clarity, speed, trust, density, accessibility`  
- **Visual Direction:** `Professional academic admin panel using Deep Red as primary color and Green as action/status accent with toggle light and dark theme`  
- **Typography:** `Readable system-safe or clean sans-serif typography with strong table readability and clear hierarchy`  
- **Layout Principle:** `Grid-aligned, stable, data-first layouts with minimal decorative elements`  
- **Motion Policy:** `Minimal motion; no decorative animation in operational workflows`

### Rules

- UI must reflect the actual operating conditions of the users.  
- Decorative UI is banned unless explicitly justified.  
- Information density must match the user’s work style.  
- Critical workflows must minimize clicks, hidden states, and unnecessary scroll.  
- Error states, warnings, and completed states must be visually distinct.

---

## 6. Locked Tech Stack

| Layer | Choice |
| :---- | :---- |
| Framework | `Next.js` |
| Language | `TypeScript` |
| Database | `PostgreSQL` |
| ORM / Query Layer | `Drizzle ORM` |
| Auth | `Server-side session auth with role-based access control` |
| Validation | `Zod` |
| Styling | `Tailwind CSS` |
| Forms | `React Hook Form` |
| Data Tables | `TanStack Table` |
| Notifications | `Gmail integration + in-app notifications` |
| Testing | `Vitest + Playwright` |
| Logging | `Structured application logging` |
| Rate Limiting | `Middleware-based rate limiting for login and public/integration endpoints, proxy.ts is nextjs convention for middleware` |
| Deployment | `Windows or Linux server deployment behind reverse proxy; Docker for production-ready for internal school network or controlled internet exposure` |

### Rules

- No stack substitution without approval.  
- No duplicate libraries for the same concern without justification.  
- No hidden introduction of experimental tools in core business logic.  
- Platform constraints must be documented before coding begins.

---

## 7. Folder Structure Contract

```text
project-root/
├── app/                  # Routes / entrypoints only
├── actions/              # Mutations / write operations / business workflows
├── components/           # Reusable UI only
├── hooks/                # Client hooks only
├── lib/
│   ├── db/
│   ├── auth/
│   ├── validators/
│   ├── constants/
│   ├── utils/
│   ├── security/
│   ├── observability/
│   ├── rbac/
│   ├── reports/
│   └── integrations/
├── drizzle/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   └── adr/
├── PROJECT_STATUS.md
├── PROJECT_ROADMAP.md
└── SRAMS_MVP.md
```

### Rules

- Route files must stay thin.  
- Business logic must not live in UI components.  
- Write operations must have a defined ownership layer.  
- Reusable components must not directly import database internals.  
- Hooks must not bypass architecture boundaries.  
- Cross-domain imports require justification.  
- Shared utilities must not become a dumping ground.

---

## 8. Security Procedure

The security baseline is mandatory because the system processes student, parent, grade, and financial data.

### 8.1 Secrets & Environment

#### Template

Required environment variables:

- `DATABASE_URL`  
- `AUTH_SECRET`  
- `APP_BASE_URL`  
- `GMAIL_CLIENT_ID`  
- `GMAIL_CLIENT_SECRET`  
- `GMAIL_REFRESH_TOKEN`  
- `STRIPE_SECRET_KEY`  
- `STRIPE_WEBHOOK_SECRET`

#### Rules

- Validate required environment variables at startup.  
- Application must fail fast if critical secrets are missing.  
- Never commit `.env*` except `.env.example` when appropriate.  
- Secret naming must be consistent and documented.

### 8.2 Transport & Headers

#### Rules

- HTTPS is required in production for any internet-facing or parent/student-accessible deployment.  
- Enforce strict security headers.  
- Use secure, httpOnly cookies for authenticated sessions.  
- Define CSP policy for production.  
- Deny framing except when explicitly justified.  
- Enable content sniffing protection and strict referrer policy.

### 8.3 Input Handling

#### Rules

- Validate all external input.  
- Ban unsafe casting of user input.  
- Ban unsafe HTML rendering unless explicitly reviewed.  
- Ban raw queries unless parameterized and justified.  
- Use shared validation schemas where possible.

### 8.4 Sensitive Data Handling

#### Sensitive Data Definition

- Student personal details  
- Parent/guardian contact information  
- Payment and billing records  
- Grade records  
- Login/session data  
- Any document identifiers tied to a student profile

#### Rules

- Never log sensitive data.  
- Never expose internal identifiers without an authorization model.  
- Financial exports and grade exports must be access-controlled and auditable.  
- Sensitive values in audit trails must be summarized, not fully dumped.

### 8.5 Credential / Secret Storage

#### Rules

- Passwords must be hashed with a modern algorithm.  
- Reset tokens must be time-bound and single-use where applicable.  
- Auth secrets must never be exposed to the client.  
- Session, token, and credential flows must be documented.

---

## 9. Login / Session Procedure

- **Session Type:** `Server session`  
- **Session Storage:** `Secure cookie + server-side validation`  
- **Session Duration:** `8–12 hours idle business session with explicit logout support`  
- **Renewal Policy:** `Sliding renewal on active use within allowed session window`  
- **Revocation Policy:** `Server-side invalidation on logout, password reset, or admin-forced revoke`

### Required Procedures

1. Define login request flow.  
   - User submits username/email and password through validated login form.
2. Define identity verification flow.  
   - Credentials are checked server-side and role/user status is verified.
3. Define rate limiting before password verification if applicable.  
   - Apply rate limiting on login endpoint before full credential verification.
4. Define success behavior.  
   - Create session, bind role and allowed scope, redirect by role landing page.
5. Define logout behavior.  
   - Destroy session and clear cookie immediately.
6. Define expiry behavior.  
   - Expired sessions redirect to login with non-sensitive message.
7. Define session validation behavior for all protected operations.  
   - Every protected route and write action validates active session and permission before proceeding.

### Rules

- Session policy must be explicit.  
- Expiry behavior must be predictable.  
- Unauthorized access must fail consistently.  
- Login timing and error behavior must not leak unnecessary information.

---

## 10. Authorization Procedure

Authorization is enforced in layers.

- **Route Guard Layer:** `Server-side protected route checks by authenticated role`  
- **Action / Service Guard Layer:** `Every write action validates role and domain permission before execution`  
- **Data Access Guard Layer:** `Queries enforce role scope and record visibility rules`

### Rules

- UI hiding alone is never authorization.  
- Every protected route must verify session and access.  
- Every write operation must verify permissions.  
- Every data query involving scoped data must verify scope.  
- Roles, scopes, and access boundaries must be documented in one place.

### Role Access Baseline

- **Admin:** Full access.  
- **Registrar:** Student records, registration, enrollment, Assessment, academic records as permitted; no unrestricted financial admin actions.  
- **Finance Officer:** Receivables, billing visibility, invoice sending, finance reporting; no cashier payment posting unless explicitly approved.  
- **Cashier:** Payment posting, receipt workflow, collection views; no grade editing.  
- **Teacher:** Grade entry only for assigned classes/subjects.  
- **Student/Parent/Guardian:** View-only access to their own records and balances.

---

## 11. Data Model Procedure

### Required Outputs

- **Entity list:** users, roles, students, parents_guardians, school_years, grade_levels, sections, registrations, enrollments, assessments, assessment_items, payments, payment_allocations, invoices, subjects, teacher_assignments, grade_records, audit_logs  
- **Core relationships:**
  - one student may have many registrations, enrollments, assessments, payments, invoices, and grade records
  - one parent/guardian may be linked to one or more students
  - one assessment has many assessment line items
  - one payment may allocate to one or more assessment balances if split posting is supported
  - one teacher assignment connects teacher, class/section, subject, and school year
- **Lifecycle states / statuses:**
  - registration: approved, rejected (REGISTRAR DIRECT PROCESS)
  - enrollment: pending, assessed, enrolled, cancelled
  - payment: pending confirmation, posted, voided
  - invoice: draft, sent, viewed, settled, overdue
  - grade record: draft, submitted, locked
- **Soft delete policy:** soft delete for operational records where historical trace is required; hard delete only for non-operational or erroneous setup data under admin control  
- **Audit fields:** createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy where applicable  
- **Unique constraints:**
  - unique student reference number
  - unique user login identifier
  - unique enrollment per student per school year
  - unique teacher assignment per subject-section-school year combination where appropriate
- **Index strategy:**
  - indexes on student reference, full name, school year, payment status, enrollment status, invoice status, createdAt, role, and audit-relevant foreign keys
- **Retention / archival policy:**
  - retain academic and finance records long-term; archive graduated/inactive student operational records without deleting financial and grade history

### Rules

- Model for reality, not convenience.  
- Avoid premature denormalization.  
- Every mutable record with operational significance should have audit metadata.  
- Enumerations and lookup tables must be justified.  
- IDs, uniqueness, and cross-scope references must be intentional.

---

## 12. Business Workflow Procedure

### Workflow 1 — New Student Registration

1. Entry condition  
   - New student application begins.
2. Preconditions  
   - Required basic student and guardian data available.
3. Action owner  
   - registrar.
4. State transition  
   - approved/rejected.
5. Validation rules  
   - Required identity, grade level target, guardian contact, and duplicate-check logic.
6. Failure conditions  
   - Duplicate probable match, invalid school year target.
7. Audit event  
   - Registration approved/rejected.
8. Completion condition  
   - Student record is ready for enrollment workflow.

### Workflow 2 — Re-enrollment

1. Entry condition  
   - Returning student exists in system.
2. Preconditions  
   - Student record found; target school year open.
3. Action owner  
   - Registrar.
4. State transition  
   - eligible → pending re-enrollment → assessed → enrolled.
5. Validation rules  
   - No duplicate active enrollment for same school year.
6. Failure conditions  
   - Record mismatch, locked account issue, prior unresolved condition.
7. Audit event  
   - Re-enrollment initiated and completed.
8. Completion condition  
   - Enrollment and assessment record created.

### Workflow 3 — Assessment Generation

1. Entry condition  
   - Student approved for enrollment.
2. Preconditions  
   - School year, grade level, fee schedule available.
3. Action owner  
   - Registrar or Finance Officer per school policy.
4. State transition  
   - pending assessment → assessed.
5. Validation rules  
   - Fee schedule completeness, adjustments documented.
6. Failure conditions  
   - Missing fee rules, unauthorized discount edit.
7. Audit event  
   - Assessment created or revised.
8. Completion condition  
   - Student has billable ledger opening balance.

### Workflow 4 — Payment Posting

1. Entry condition  
   - Student has outstanding or payable assessment balance.
2. Preconditions  
   - Payment amount, method, reference details captured.
3. Action owner  
   - Cashier.
4. State transition  
   - pending/posting draft → posted or voided.
5. Validation rules  
   - Amount > 0, valid payment method, reference required for non-cash when applicable.
6. Failure conditions  
   - Duplicate posting, invalid amount, mismatched student account.
7. Audit event  
   - Payment posted or voided.
8. Completion condition  
   - Ledger updated and receipt generated.

### Workflow 5 — Grade Encoding

1. Entry condition  
   - Active teacher assignment exists.
2. Preconditions  
   - Teacher authenticated and assigned to subject/class.
3. Action owner  
   - Teacher.
4. State transition  
   - draft → submitted → locked.
5. Validation rules  
   - Grade values within accepted range, only assigned students visible.
6. Failure conditions  
   - Unauthorized access, locked grade period, invalid grade value.
7. Audit event  
   - Grade saved/submitted/locked.
8. Completion condition  
   - Grade record available for viewing by authorized users.

### Rules

- Workflows must be explicit.  
- State transitions must be traceable.  
- Ownership handoff must be clear.  
- Failure paths must be documented.  
- No workflow should depend on hidden manual knowledge.

---

## 13. Auditability Procedure

### Minimum Audit Dimensions

- Actor  
- Timestamp  
- Action  
- Target entity  
- Previous state summary  
- New state summary  
- Context / source  
- Correlation ID / request ID

### Rules

- Audit logs must be immutable or append-only where feasible.  
- Sensitive field values must be redacted when necessary.  
- Security-relevant actions must always be logged.  
- Operationally significant writes must be traceable.

### Mandatory Audit Events

- User login/logout  
- Failed login bursts / lockout triggers  
- Student record create/update/delete  
- Registration review decisions  
- Enrollment creation/cancellation  
- Assessment create/update  
- Discount/adjustment changes  
- Payment post/void  
- Invoice send action  
- Grade save/submit/lock  
- User role/permission changes  
- Export of finance or academic records

---

## 14. Observability Procedure

### Required Outputs

- **Logging format:** structured JSON-like logs in production  
- **Correlation strategy:** request ID / correlation ID per request and workflow transaction  
- **Error classification:** validation, auth, permission, business rule, integration, infrastructure  
- **Health checks:** app health, database connectivity, critical integration status where applicable  
- **Metrics strategy:** auth failures, payment posts, invoice sends, page/action errors, response times  
- **Alerting triggers:** repeated auth failures, payment posting failures, Gmail integration failures, database connection failures

### Rules

- Logs must be structured.  
- Errors must be classifiable.  
- Requests must be traceable across layers where applicable.  
- Production debugging must not depend on console noise.

---

## 15. Testing Procedure

- **Unit Tests:** validation schemas, helper logic, average grade computation, balance calculation, RBAC utilities  
- **Integration Tests:** registration approval, enrollment creation, assessment generation, payment posting, invoice send action, grade submission  
- **E2E Tests:** login, role redirects, registration-to-enrollment flow, cashier posting flow, teacher grade encoding, student/parent viewing  
- **Security Tests:** route protection, action-level permission checks, session expiration, export restrictions  
- **Performance Tests:** student search responsiveness, registration table loading, ledger summary queries, dashboard summary performance

### Rules

- Critical workflows require tests.  
- Authorization logic requires tests.  
- Validation logic requires tests.  
- High-risk state transitions require tests.  
- Regression-prone modules require automated coverage.

---

## 16. Delivery Procedure for New Features

Every new feature must follow this sequence.

### Required Sequence

1. Confirm scope against `PROJECT_ROADMAP.md`.  
2. Check current implementation state in `PROJECT_STATUS.md`.  
3. Write assumptions.  
4. Write a concise implementation TODO.  
5. Identify impacted modules.  
6. Identify security implications.  
7. Identify schema / migration impact.  
8. Identify UI impact.  
9. Identify test impact.  
10. Implement in the correct layer.  
11. Validate with tests.  
12. Update `PROJECT_STATUS.md`.  
13. Update documentation if architecture changed.

### Rules

- No feature starts with random coding.  
- No feature is complete without status/document updates.  
- No schema change is accepted without migration review.  
- No security-relevant change is accepted without explicit review.

---

## 17. Change Control Procedure

### Rules

- Major architecture changes require an ADR in `/docs/adr/`.  
- Stack changes require approval.  
- Cross-domain pattern changes require review.  
- Breaking changes require documented migration and rollback thinking.  
- Silent architectural drift is not allowed.

---

## 18. Definition of Done

A task is done only if all applicable items are complete.

### Checklist

- Scope confirmed  
- Implementation completed in the correct layer  
- Validation added or updated  
- Authorization enforced  
- Logging / audit considered  
- Tests added or updated  
- Documentation updated  
- Project status updated  
- Roadmap updated if needed  
- No architecture rule violated

---

## 19. Senior Engineer Fill-In Section

This section is completed for SRAMS.

### Required Fill-Ins

- **Project identity:** Completed  
- **Core goals:** Completed  
- **Domain terms:**
  - registration = initial application or data capture before approval
  - enrollment = official school-year activation of student status
  - assessment = charge definition for tuition and fees
  - payment posting = official recording of received payment against student ledger
  - ledger = running financial balance record per student
  - grade record = teacher-submitted academic scores for a grading period
- **Tech stack:** Completed  
- **Folder structure adjustments:** Added `rbac`, `reports`, and `integrations` domains under `lib/`  
- **Security baseline:** Completed  
- **Auth/session model:** Completed  
- **Authorization model:** Completed  
- **Core entities:** Completed  
- **Workflow definitions:** Completed  
- **Audit requirements:** Completed  
- **Testing standard:** Completed  
- **Deployment target:** Internal school server or controlled hosted deployment with secure access  
- **ADR rules:** All major architectural changes require ADR before implementation

### Final Rule

It is ready for structured project implementation.
