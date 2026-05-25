# SRAMS Error Handling Implementation Plan

## Overview

Add production-grade error handling with user-friendly messages across all SRAMS modules while maintaining backward compatibility with existing patterns.

### User Requirements (Confirmed)
- **Inline errors only** - No toast system, keep FormStateAlert
- **Audit ALL failures** - Permission denied, validation, DB errors → audit_logs
- **Monitoring hooks** - Prepare interface without specific provider
- **No retry logic** - Keep simple, manual retry only

## Architecture Summary

```
User Form → Server Action → wrapServerAction()
                               ↓
                    ┌──────────┴──────────┐
                    │                     │
             transformError()        Success path
                    │                     │
           ┌────────┼────────┐           logAudit()
           │        │        │
        ZodError  DB Error  AppError
           │        │        │
           └────────┴────────┘
                    │
           auditError() + reportError()
                    │
           errorToFormState()
                    │
           FormStateAlert displays
```

## Implementation Phases

### Phase 1: Core Infrastructure (Create New Files)

| File | Purpose |
|------|---------|
| `src/lib/errors/error-codes.ts` | 50+ standardized error codes with severity mapping |
| `src/lib/errors/types.ts` | AppError class, specialized errors, type guards |
| `src/lib/errors/messages.ts` | User-friendly messages, constraint mapping |
| `src/lib/errors/transform.ts` | Central error transformation pipeline |
| `src/lib/errors/index.ts` | Public exports |

**Key Error Code Categories:**
- `AUTH_*` - Authentication/authorization (e.g., AUTH_PERMISSION_DENIED)
- `VAL_*` - Validation errors (e.g., VAL_SCHEMA_MISMATCH)
- `DB_*` - Database constraints (e.g., DB_UNIQUE_VIOLATION)
- `STU_*` - Student operations (e.g., STU_REFERENCE_DUPLICATE)
- `ENR_*` - Enrollment (e.g., ENR_INVALID_STATUS_TRANSITION)
- `PAY_*` - Payments (e.g., PAY_AMOUNT_EXCEEDS_BALANCE)
- `OR_*` - Receipt tracking (e.g., OR_BOOKLET_EXHAUSTED)
- `GRD_*` - Grades (e.g., GRD_RECORD_LOCKED)
- `SYS_*` - System errors (e.g., SYS_INTERNAL_ERROR)

### Phase 2: Auditing & Monitoring

| File | Purpose |
|------|---------|
| `src/lib/errors/audit-failures.ts` | logFailure(), auditError(), convenience wrappers |
| `src/lib/errors/monitoring.ts` | MonitoringAdapter interface, console default, hooks |
| `src/lib/errors/action-helpers.ts` | wrapServerAction(), createServerAction(), createFinancialAction() |

**Server Action Pattern After Migration:**
```typescript
export const createStudent = createServerAction<CreateStudentInput, { studentId: string }>(
  'students:create',
  'students:create',
  async (input, session) => {
    // Business logic only - error handling automatic
    const [student] = await db.insert(students).values(input).returning();
    return { studentId: student.id };
  },
);
```

### Phase 3: Update Error Boundaries

**Files to Update:**
- `src/app/error.tsx` - Add reportError() call, improve UI
- `src/app/admin/error.tsx` - Same pattern
- `src/app/staff/error.tsx` - Same pattern
- `src/app/portal/error.tsx` - Same pattern

### Phase 4: Migrate Server Actions (Priority Order)

**Critical Financial Operations (First):**
1. `src/features/payments/payments.actions.ts` - postPaymentAction, voidPaymentAction
2. `src/features/assessments/assessments.actions.ts` - createAssessment, transferBalance
3. `src/features/finance/fee-schedules/fee-schedules.actions.ts` - fee management

**Core Operations:**
4. `src/features/students/students.actions.ts` - CRUD operations
5. `src/features/enrollments/enrollments.actions.ts` - enrollment workflow
6. `src/features/auth/auth.actions.ts` - login/logout (already has partial auditing)

**Remaining Operations:**
7. `src/features/grades/grades.actions.ts` - grade encoding
8. `src/features/academics/*.actions.ts` - subjects, sections, assignments
9. `src/features/users/*.actions.ts` - user management

### Phase 5: Testing & Documentation

**Unit Tests:** `src/lib/errors/__tests__/transform.test.ts`
**Integration Tests:** `src/lib/errors/__tests__/action-helpers.test.ts`
**Update:** `CLAUDE.md` error handling section

## Files to Create

```
src/lib/errors/
├── index.ts           # Public exports
├── error-codes.ts     # ERROR_CODES, ErrorCode type, severity mapping
├── types.ts           # AppError, DatabaseConstraintError, BusinessRuleError
├── messages.ts        # ERROR_MESSAGES, constraint mapping, getUserMessage()
├── transform.ts       # transformError(), errorToFormState()
├── audit-failures.ts  # logFailure(), auditError()
├── monitoring.ts      # MonitoringAdapter interface, reportError()
└── action-helpers.ts  # wrapServerAction(), createServerAction()
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/utils/error-handlers.ts` | Add deprecation notice, re-export from transform.ts |
| `src/app/error.tsx` | Import and call reportError() |
| `src/app/admin/error.tsx` | Same |
| `src/app/staff/error.tsx` | Same |
| `src/app/portal/error.tsx` | Same |
| `src/features/payments/payments.actions.ts` | Migrate to createFinancialAction |
| `src/features/students/students.actions.ts` | Migrate to createServerAction |
| `src/features/enrollments/enrollments.actions.ts` | Migrate to createServerAction |
| `src/features/assessments/assessments.actions.ts` | Migrate to createFinancialAction |
| `src/features/auth/auth.actions.ts` | Add error transformation |
| All remaining `*.actions.ts` files | Gradual migration |

## Key Design Decisions

1. **Error codes as const object** - Better tree-shaking than enum
2. **Severity levels** (low/medium/high/critical) - Drive auditing and monitoring decisions
3. **Financial operations = CRITICAL severity** - Always audit, always alert
4. **wrapServerAction pattern** - Reduces boilerplate by ~40%
5. **Backward compatible** - BaseFormState, FormStateAlert unchanged
6. **Monitoring hooks only** - No Sentry implementation yet, just interface

## Verification Plan

1. **TypeScript Compilation**
   ```bash
   npm run build
   ```

2. **Unit Tests**
   ```bash
   npm run test
   ```

3. **Manual Testing**
   - Submit form with invalid data → Field errors display
   - Submit duplicate student ref → User-friendly message
   - Access without permission → Permission denied message + audit log entry
   - Post payment with exhausted booklet → OR_BOOKLET_EXHAUSTED error

4. **Audit Log Verification**
   ```sql
   SELECT * FROM audit_logs
   WHERE action LIKE '%:failed' OR new_state::text LIKE '%error%'
   ORDER BY created_at DESC LIMIT 10;
   ```

5. **Error Boundary Test**
   - Navigate to route that throws → Error boundary displays
   - Console shows error logged to monitoring hook

## Constraints Adhered To

- No business logic changes
- Soft delete only (existing pattern)
- RBAC at 3 levels maintained
- Financial operations use `{ throwOnFail: true }`
- All changes backward compatible
