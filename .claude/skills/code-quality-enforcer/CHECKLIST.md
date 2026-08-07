# Code Quality Enforcer Checklist

Quick-scan checklist for code reviews. Use this for rapid assessment before deep-diving into issues.

---

## Architecture

- [ ] Code is in `src/features/` not scattered in `src/app/`
- [ ] Actions, queries, schemas co-located in feature folder
- [ ] No circular dependencies between features
- [ ] Dependency direction respected (UI → Actions → Queries → DB)
- [ ] Shared code in `src/lib/`, not duplicated across features

---

## Server Actions

- [ ] Has `"use server"` directive
- [ ] Calls `requireSession()` for authentication
- [ ] Calls `hasPermission(role, permission)` for authorization
- [ ] Validates input with `schema.safeParse()`
- [ ] Returns `ActionResult<T>` type (ok/error pattern)
- [ ] Calls `logAudit()` for financial/sensitive operations
- [ ] Uses transactions for multi-table writes

---

## Forms & State

- [ ] Uses `useActionState` (React 19 pattern)
- [ ] Form state extends `BaseFormState<T>`
- [ ] Uses `useFormToast` for form-level notifications
- [ ] Field errors displayed inline (not toasted)
- [ ] Uses `ConfirmActionButton` for destructive actions

---

## Database

- [ ] Soft delete only (`deletedAt`/`deletedBy`) — no hard deletes
- [ ] Queries include `deletedAt IS NULL` for active records
- [ ] Independent queries use `Promise.all` (not sequential await)
- [ ] List queries have SQL-level pagination
- [ ] No N+1 queries (use `with:` relations or batch)
- [ ] Transactions wrap related writes

---

## Performance

- [ ] Cache invalidation uses `invalidateTag()` not `forceUpdateTag()`
- [ ] No blocking revalidatePath in actions
- [ ] Large lists paginated server-side
- [ ] Client-side filtering only for small datasets

---

## Components

- [ ] Under ~300 lines (decompose if larger)
- [ ] Single responsibility (one purpose per component)
- [ ] No business logic in JSX
- [ ] No direct DB access in client components
- [ ] Server Components used where possible (no unnecessary `"use client"`)

---

## Dates & Currency

- [ ] Uses `formatDate`/`formatDateTime` from `src/lib/utils/date.ts`
- [ ] No raw `toLocaleDateString()` (causes hydration mismatch)
- [ ] Uses `CurrencyDisplay` or `en-PH` locale for money
- [ ] Timezone is `Asia/Manila` for all formatting

---

## SRAMS-Specific

### Finance Operations
- [ ] Payment posts consume OR from active booklet
- [ ] OR numbers never reused (even if voided)
- [ ] All payment operations have audit log entries
- [ ] Idempotency key for payment posting

### Grades
- [ ] Grade sheet follows status workflow (draft → submitted → approved)
- [ ] Sequential period locking enforced
- [ ] Completeness validated before submission

### Students
- [ ] Lifecycle status respected (active, graduated, etc.)
- [ ] Archive operations use batch patterns
- [ ] Document requests check eligibility

---

## Security

- [ ] No secrets in client-side code
- [ ] RBAC at 3 levels: route guard, action validation, audit log
- [ ] Input sanitized/validated with Zod
- [ ] No SQL injection risks (Drizzle parameterizes)

---

## File Organization

| File Type | Max Lines | Check |
|-----------|-----------|-------|
| Component | ~300 | [ ] |
| Hook | ~200 | [ ] |
| Action file | ~300 | [ ] |
| Query file | ~250 | [ ] |
| Utility | ~150 | [ ] |

---

## Before Approving

- [ ] Business context understood
- [ ] All Critical/High issues addressed
- [ ] ActionResult pattern used
- [ ] Soft delete pattern used
- [ ] Audit logging for financial ops
- [ ] No hydration mismatch risks
- [ ] No blocking cache invalidation
