# SRAMS Security Audit Checklist

**Version:** 1.0

**Target Stack**

- Next.js 16.2
- React 19
- TypeScript
- PostgreSQL
- Drizzle ORM
- Auth.js / Better Auth
- TanStack Query
- TanStack Form
- Zod
- Tailwind CSS v4

---

# Purpose

This checklist defines the mandatory security review process for every feature, module, pull request, and release within the School Registration & Account Monitoring System (SRAMS).

No security review is considered complete until every applicable section has been evaluated.

---

# Severity Levels

| Level       | Description                                        |
| ----------- | -------------------------------------------------- |
| 🔴 Critical | Immediate exploitation possible                    |
| 🟠 High     | Serious vulnerability requiring prompt remediation |
| 🟡 Medium   | Moderate security weakness                         |
| 🔵 Low      | Minor issue or best-practice improvement           |
| ✅ Pass     | Requirement satisfied                              |
| ❌ Fail     | Requirement not satisfied                          |
| N/A         | Not applicable                                     |

---

# 1. Authentication

## Login

- [ ] Session created only after successful authentication
- [ ] Passwords hashed using a strong algorithm (Argon2 or bcrypt)
- [ ] Password comparison performed server-side
- [ ] Failed login attempts logged
- [ ] Brute-force protection implemented
- [ ] Login endpoint rate-limited
- [ ] Generic authentication error messages
- [ ] No user enumeration
- [ ] Session ID regenerated after login

---

## Session

- [ ] Secure cookies enabled
- [ ] HTTPOnly enabled
- [ ] SameSite configured
- [ ] Secure flag enabled in production
- [ ] Session expiration configured
- [ ] Idle timeout configured
- [ ] Logout invalidates session
- [ ] Session revocation supported
- [ ] No sensitive data stored in cookies

---

## Password Reset

- [ ] Reset tokens expire
- [ ] Reset tokens single-use
- [ ] Secure random token generation
- [ ] Password reset audited
- [ ] Email verification required

---

# 2. Authorization

Every mutation must verify authorization.

- [ ] User authenticated
- [ ] User active
- [ ] User role verified
- [ ] User permission verified
- [ ] Record ownership verified
- [ ] School year access verified
- [ ] Campus access verified (if multi-campus)
- [ ] Unauthorized requests rejected
- [ ] Authorization occurs before business logic

---

# 3. RBAC

Review every role.

## Super Admin

- [ ] Full access
- [ ] Restricted to trusted users
- [ ] Cannot bypass audit logging

## Principal

- [ ] Grade approval
- [ ] Archive students
- [ ] Reports
- [ ] User approval

## Coordinator

- [ ] Curriculum review
- [ ] Grade review
- [ ] Subject approval

## Registrar

- [ ] Registration
- [ ] Enrollment
- [ ] Student records

## Adviser

- [ ] Grade entry
- [ ] Attendance
- [ ] Assigned students only

## Teacher

- [ ] Assigned classes only
- [ ] Assigned subjects only

## Student

- [ ] Own profile only
- [ ] Own grades only
- [ ] Own enrollment only

## Parent

- [ ] Linked students only

---

# 4. Input Validation

All external input must be validated.

Review:

- [ ] FormData
- [ ] JSON
- [ ] Query Parameters
- [ ] Route Parameters
- [ ] Search Parameters
- [ ] Cookies
- [ ] Headers
- [ ] File Uploads

Validation requirements:

- [ ] Zod schema exists
- [ ] Unknown fields rejected
- [ ] Required fields validated
- [ ] String lengths validated
- [ ] Number ranges validated
- [ ] Enum validation
- [ ] Date validation
- [ ] File validation

---

# 5. Database Security

## Queries

- [ ] Drizzle ORM used
- [ ] No SQL concatenation
- [ ] No unsafe raw SQL
- [ ] Transactions used for critical workflows
- [ ] Queries use least privilege
- [ ] Sensitive columns excluded from responses

---

## Transactions

Required for:

- [ ] Registration
- [ ] Enrollment
- [ ] Promotion
- [ ] Archive
- [ ] Grade Approval
- [ ] Role Assignment
- [ ] Password Change

---

## Data Protection

- [ ] No plaintext passwords
- [ ] No secrets stored
- [ ] Sensitive data minimized
- [ ] Soft deletes where appropriate
- [ ] Foreign keys enforced
- [ ] Cascading rules reviewed

---

# 6. Server Actions

Every Server Action must verify:

- [ ] Authentication
- [ ] Authorization
- [ ] Input validation
- [ ] Business rules
- [ ] Transaction
- [ ] Audit logging
- [ ] Structured error handling

Server Actions must NOT:

- [ ] Trust client input
- [ ] Skip authorization
- [ ] Leak stack traces
- [ ] Expose internal IDs unnecessarily

---

# 7. Route Handlers

Review every endpoint.

GET

- [ ] Authorization
- [ ] Pagination
- [ ] Data filtering
- [ ] Sensitive fields removed

POST

- [ ] Validation
- [ ] Authorization
- [ ] Audit logging

PUT/PATCH

- [ ] Ownership verified
- [ ] Validation
- [ ] Transactions

DELETE

- [ ] Soft delete considered
- [ ] Audit logging
- [ ] Authorization

---

# 8. File Uploads

- [ ] MIME validation
- [ ] Extension validation
- [ ] Filename sanitization
- [ ] File size limits
- [ ] Virus scanning (if available)
- [ ] Private storage
- [ ] Access control

---

# 9. Frontend Security

## React

- [ ] No authorization in Client Components
- [ ] No sensitive props
- [ ] No secrets exposed
- [ ] No dangerouslySetInnerHTML
- [ ] Escape user content

---

## Browser Storage

- [ ] No JWT in localStorage
- [ ] No passwords stored
- [ ] No personal data cached unnecessarily

---

## Forms

- [ ] CSRF protection
- [ ] Client validation
- [ ] Server validation
- [ ] Error messages sanitized

---

# 10. Next.js

Review:

- [ ] Server Components
- [ ] Client Components
- [ ] Middleware
- [ ] Route Handlers
- [ ] Server Actions
- [ ] Dynamic routes
- [ ] Metadata
- [ ] Cache configuration

---

# 11. Headers

Verify:

- [ ] CSP
- [ ] HSTS
- [ ] X-Frame-Options
- [ ] X-Content-Type-Options
- [ ] Referrer Policy
- [ ] Permissions Policy

---

# 12. CORS

- [ ] Allowed origins restricted
- [ ] Credentials reviewed
- [ ] Allowed methods restricted
- [ ] Allowed headers reviewed

---

# 13. Rate Limiting

Protect:

- [ ] Login
- [ ] Registration
- [ ] Password reset
- [ ] Search
- [ ] Reports
- [ ] APIs
- [ ] Uploads

---

# 14. Audit Logging

Verify logging for:

- [ ] Login
- [ ] Logout
- [ ] Registration
- [ ] Enrollment
- [ ] Grade Entry
- [ ] Grade Approval
- [ ] Promotion
- [ ] Archive
- [ ] Role Changes
- [ ] Password Reset
- [ ] User Creation
- [ ] User Deletion

Log includes:

- [ ] User ID
- [ ] Role
- [ ] Timestamp
- [ ] Entity
- [ ] Entity ID
- [ ] Previous Value
- [ ] New Value
- [ ] IP Address (if available)
- [ ] User Agent (if available)

Never log:

- [ ] Passwords
- [ ] Tokens
- [ ] Secrets

---

# 15. Secrets Management

- [ ] Environment variables server-only
- [ ] No secrets committed
- [ ] Rotation policy documented
- [ ] Development secrets isolated
- [ ] Production secrets protected

---

# 16. Dependency Review

- [ ] Outdated packages reviewed
- [ ] Deprecated packages removed
- [ ] High severity vulnerabilities resolved
- [ ] Lockfile committed

---

# 17. OWASP Top 10

Review for:

- [ ] A01 Broken Access Control
- [ ] A02 Cryptographic Failures
- [ ] A03 Injection
- [ ] A04 Insecure Design
- [ ] A05 Security Misconfiguration
- [ ] A06 Vulnerable Components
- [ ] A07 Authentication Failures
- [ ] A08 Software Integrity
- [ ] A09 Logging Failures
- [ ] A10 SSRF

---

# 18. SRAMS Critical Workflows

Review security of:

- [ ] Student Registration
- [ ] Enrollment
- [ ] Subject Offering
- [ ] Curriculum Management
- [ ] Adviser Assignment
- [ ] Teacher Assignment
- [ ] Grade Entry
- [ ] Grade Review
- [ ] Grade Approval
- [ ] Student Promotion
- [ ] Student Archive
- [ ] User Management
- [ ] Role Management

Every workflow must verify:

- [ ] Authentication
- [ ] Authorization
- [ ] Validation
- [ ] Transactions
- [ ] Audit Logging

---

# Final Security Score

| Category       | Score |
| -------------- | ----: |
| Authentication |   /10 |
| Authorization  |   /10 |
| RBAC           |   /10 |
| Validation     |   /10 |
| Database       |   /10 |
| Server Actions |   /10 |
| API Security   |   /10 |
| Frontend       |   /10 |
| Infrastructure |   /10 |
| Audit Logging  |   /10 |

---

# Overall Score

```
90–100  Production Ready

80–89   Minor Improvements

70–79   Moderate Risk

60–69   Significant Security Work Required

Below 60   Not Production Ready
```

---

# Exit Criteria

A security audit is complete only if:

- All Critical findings have been documented.
- All High findings have remediation plans.
- Security score has been calculated.
- Every applicable checklist item has been reviewed.
- Recommendations are prioritized by business impact.
