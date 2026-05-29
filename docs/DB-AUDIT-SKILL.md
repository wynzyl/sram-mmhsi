# Claude Code Prompt: SRAMS Database Schema Optimization, Integrity, Performance, and Security Audit

You are a Senior Database Architect, Senior Backend Engineer, and Security Engineer.

Audit the existing database schema, relationships, indexes, queries, migrations, and data-access patterns for the SRAMS project:

Updated: 5/21/2026

**SRAMS = School Registration and Accounts Monitoring System**

The system handles:
- Student registration
- Enrollment per school year
- Assessment / fee charging
- Cashier payment transactions
- Official Receipt / OR tracking
- Student ledger / balances
- Grade levels
- Fee schedules and fee items
- User roles and permissions
- Registrar, Cashier, Finance, Teacher, Admin, Student/Parent access

Tech assumptions:
- Next.js App Router
- Drizzle ORM or current project ORM implementation
- PostgreSQL production target
- Server Actions preferred for CUD
- Tanstack query
- Reads may use queries/fetch/TanStack Query if already implemented
- Local LAN deployment first, scalable to cloud later

---

## Primary Objective

Review the database layer like a production system.

Find:
1. Schema design problems
2. Broken or weak relationships
3. Missing foreign keys
4. Missing unique constraints
5. Incorrect nullable fields
6. Missing indexes
7. Slow query risks
8. Ledger/accounting integrity issues
9. OR tracking issues
10. Security vulnerabilities
11. Migration risks
12. Data duplication risks
13. RBAC and data access weaknesses
14. Audit trail gaps
15. Concurrency/race-condition risks

Do **not** rewrite the whole system blindly. First audit, then propose safe improvements.

---

## Important Business Rules to Validate

### Student / Registration

Check if the schema supports:

- One student registration record should not be duplicated.
- Student identity must remain stable across school years.
- A student may have multiple enrollments across different school years.
- Old students should not need duplicate registration.
- New / Transferee / Old student classification should be clear.
- Student ID generation must be safe, unique, and not race-condition prone.

Validate:
- Is `studentId` unique?
- Is there a difference between internal database ID and human-readable student number?
- Is duplicate detection strong enough?
- Are name + birthdate + guardian checks needed?
- Are soft-deleted students handled safely?

---

### Enrollment

Check if the schema supports:

- One student can enroll once per school year.
- Enrollment is linked to:
  - student
  - school year
  - grade level
  - section, if applicable
  - status

Expected enrollment statuses:

```ts
PENDING     // added to enrollment, waiting for assessment
ASSESSED    // assessment created, ready for payment
ENROLLED    // payment processed / officially enrolled
CANCELLED   // manually cancelled with reason