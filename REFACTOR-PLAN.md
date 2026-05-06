# SRAMS Codebase Refactoring Plan

## Executive Summary

**Goal:** Refactor SRAMS codebase to be production-ready with reusable components, consolidated logic, and better maintainability while preserving all business logic.

**Impact:**
- Reduce duplicate code by **1,250+ lines** across **50+ files**
- Consolidate **30+ instances** of duplicate session/permission checks
- Standardize **27+ FormState types** to use common base
- Replace **3 duplicate button components** with single reusable component
- Migrate **10+ forms** to use reusable field components
- Centralize **4 duplicate audit logging helpers**

**Risk Level:** Low (incremental, file-by-file migration with no breaking changes)

---

## Implementation Phases

### Phase 1: Foundation Utilities (Week 1) ⭐ **Build First**

Create core utilities that all other refactoring depends on.

#### 1.1 Create `lib/utils/action-guards.ts`
**Purpose:** Consolidate session + permission checks (30+ duplicate instances)

**Exports:**
```typescript
export async function requirePermission(permission: string): Promise<SessionUser>
export async function requireAuth(): Promise<SessionUser>
export function notDeleted<T>(table: T): SQL
```

**Replaces Pattern:**
```typescript
// BEFORE (repeated 30+ times):
const session = await requireSession();
if (!hasPermission(session.role, "students:create")) {
  return { message: "You do not have permission..." };
}

// AFTER:
const session = await requirePermission("students:create");
```

**Affected Files:** All 13 action files (students, enrollments, cashier, finance, school-years, users, academics, teacher, assessments, invoices, etc.)

---

#### 1.2 Create `lib/utils/audit-logger.ts`
**Purpose:** Centralize audit logging (4 duplicate helpers)

**Exports:**
```typescript
export async function logAudit(params: AuditParams): Promise<void>
export async function logCreateAction(session, entity, id, data): Promise<void>
export async function logUpdateAction(session, entity, id, previous, updated): Promise<void>
export async function logDeleteAction(session, entity, id, context?): Promise<void>
```

**Replaces:** Local `audit()` functions in:
- `actions/students.ts` (lines 30-51)
- `actions/enrollments.ts` (lines 53-74)
- `actions/school-years.ts` (lines 25-48)
- `actions/users.ts`

---

#### 1.3 Create `lib/utils/error-handlers.ts`
**Purpose:** Consolidate PostgreSQL error extraction

**Exports:**
```typescript
export function extractUniqueConstraint(err: unknown): string | undefined
export function isUniqueConstraintError(err: unknown, constraint?: string): boolean
export function getFormErrorFromDbError(err: unknown): { errors?: Record<string, string[]> } | null
```

**Replaces:** `pgUniqueConstraint()` functions in:
- `actions/students.ts` (lines 53-63)
- `actions/enrollments.ts` (lines 35-45)

---

#### 1.4 Create `lib/utils/currency.ts`
**Purpose:** Centralize currency formatting

**Exports:**
```typescript
export function formatCurrency(amount: number | string): string
export function parseCurrency(formatted: string): number
export const CURRENCY_LOCALE = "en-PH"
export const CURRENCY_CODE = "PHP"
```

**Replaces:** `formatPhp()` in `actions/enrollments.ts` (lines 47-49) and scattered Intl.NumberFormat calls

---

#### 1.5 Create `lib/utils/query-helpers.ts`
**Purpose:** Centralize common query patterns

**Exports:**
```typescript
export async function getActiveSchoolYear(): Promise<SchoolYear | null>
export async function getActiveSchoolYearId(): Promise<string | null>
export function buildSoftDeleteFilter<T>(table: T): SQL
```

**Replaces:** Duplicate `getActiveSchoolYearId()` in:
- `actions/students.ts` (lines 74-81)
- `actions/enrollments.ts` (lines 77-84)

---

#### 1.6 Create `lib/validators/common-schemas.ts`
**Purpose:** Centralize reusable Zod schemas and FormState type

**Exports:**
```typescript
// Common field validators
export const emailSchema = z.string().trim().email(...).optional().or(z.literal(""))
export const phoneSchema = z.string().trim().optional().refine(...)
export const uuidSchema = z.string().uuid()
export const nameSchema = z.string().min(1, "Name is required").trim()
export const amountSchema = z.coerce.number().positive()

// Base FormState type
export type BaseFormState<TInput = Record<string, unknown>> = {
  errors?: Partial<Record<keyof TInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
}
```

**Replaces:** 27+ FormState type definitions across all validators

---

### Phase 2: Reusable Components (Week 2) ⭐ **Build Second**

Create UI components that reduce form boilerplate.

#### 2.1 Create `components/forms/FormStateAlert.tsx`
**Purpose:** Standardize error/success message display

**Usage:**
```tsx
<FormStateAlert state={state} />
```

**Replaces:** 20+ manual alert blocks in all forms

---

#### 2.2 Create `components/forms/TextInputField.tsx`
**Purpose:** Reusable controlled text input with error display

**Props:**
```typescript
{
  label: string;
  name: string;
  type?: "text" | "email" | "tel" | "date";
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string[];
}
```

**Replaces:** 40+ manual `<div className="form-group">` patterns

---

#### 2.3 Create `components/forms/SelectField.tsx`
**Purpose:** Reusable select dropdown

**Props:**
```typescript
{
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string[];
}
```

---

#### 2.4 Create `components/forms/CurrencyInputField.tsx`
**Purpose:** Currency input with PHP formatting

**Replaces:** Custom currency input patterns in `PostPaymentForm.tsx` and others

---

#### 2.5 Create `components/shared/ConfirmActionButton.tsx`
**Purpose:** Consolidate confirm-action button pattern

**Props:**
```typescript
{
  action: (formData: FormData) => Promise<any>;
  confirmMessage: string;
  hiddenFields: Record<string, string>;
  label: string;
  loadingLabel: string;
  variant?: "danger" | "primary" | "secondary";
}
```

**Replaces:**
- `components/academics/DeleteSubjectButton.tsx`
- `components/academics/LockGradesButton.tsx`
- `components/academics/RemoveAssignmentButton.tsx`

---

### Phase 3: Incremental Migration (Weeks 3-6) ⭐ **Migrate After Phases 1 & 2**

Migrate existing code to use new utilities and components, one file at a time.

#### 3.1 Migrate Server Actions (Weeks 3-4)

**Migration Pattern for Each Action File:**
1. Import new utilities at top
2. Replace `requireSession() + hasPermission()` → `requirePermission()`
3. Replace local `audit()` → `logCreateAction()` / `logUpdateAction()` / `logDeleteAction()`
4. Replace `pgUniqueConstraint()` → `extractUniqueConstraint()`
5. Replace `getActiveSchoolYearId()` → imported version from query-helpers
6. Replace `formatPhp()` → `formatCurrency()`
7. Test thoroughly before committing

**Order of Migration:**
1. `actions/students.ts` (most complex, good test case)
2. `actions/enrollments.ts`
3. `actions/cashier.ts`
4. `actions/finance.ts`
5. `actions/school-years.ts`
6. `actions/users.ts`
7. `actions/academics.ts`
8. `actions/teacher.ts`
9. `actions/assessments.ts`
10. `actions/invoices.ts`

**Estimated Reduction:** 30-60 lines per file

---

#### 3.2 Migrate Validators (Week 5)

**Migration Pattern:**
```typescript
// BEFORE:
export type CreateStudentFormState = {
  errors?: Partial<Record<keyof CreateStudentInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
  studentId?: string;
};

// AFTER:
import type { BaseFormState } from "@/lib/validators/common-schemas";
export type CreateStudentFormState = BaseFormState<CreateStudentInput> & {
  studentId?: string;
};
```

**Files to Migrate:**
- `lib/validators/student.ts`
- `lib/validators/enrollment.ts`
- `lib/validators/cashier.ts`
- `lib/validators/finance.ts`
- `lib/validators/school-year.ts`
- `lib/validators/user.ts`
- `lib/validators/academics.ts`
- `lib/validators/assessment.ts`
- `lib/validators/auth.ts`

**Also migrate to use common schemas:**
- Replace duplicate `email` validators with `emailSchema`
- Replace duplicate `name` validators with `nameSchema`
- Replace duplicate `amount` validators with `amountSchema`

**Estimated Reduction:** 100-150 lines across all validators

---

#### 3.3 Migrate Forms (Week 5-6)

**Migration Pattern for Each Form:**
1. Add `import { FormStateAlert } from "@/components/forms/FormStateAlert"`
2. Replace manual error/message blocks → `<FormStateAlert state={state} />`
3. Replace form field patterns → `<TextInputField />` or `<SelectField />`
4. Test form submission, validation, error display

**Priority Order:**
1. `components/students/StudentForm.tsx` (most complex, critical path)
2. `components/students/EditStudentForm.tsx`
3. `components/finance/BookletForm.tsx`
4. `components/finance/FeeScheduleForm.tsx`
5. `components/school-years/SchoolYearForm.tsx`
6. `components/users/UserForm.tsx`
7. `components/users/EditUserForm.tsx`
8. Remaining forms (10+ files)

**Estimated Reduction:** 50-100 lines per form

---

#### 3.4 Migrate Button Components (Week 6)

**Steps:**
1. Find all usages of `DeleteSubjectButton`, `LockGradesButton`, `RemoveAssignmentButton`
2. Replace with `<ConfirmActionButton />` calls
3. Delete old button component files
4. Test confirmation dialogs work

**Estimated Reduction:** 60 lines (3 files eliminated)

---

### Phase 4: Verification & Testing (Throughout)

#### Test Strategy (Per File Migration)

**After Each Action File Migration:**
- [ ] Create operation works
- [ ] Update operation works
- [ ] Delete/soft-delete works
- [ ] Permission denied returns correct error
- [ ] Validation errors display in UI
- [ ] Audit logs are written correctly
- [ ] No console errors

**After Each Form Migration:**
- [ ] Form loads without errors
- [ ] Field validation shows errors
- [ ] Success message displays
- [ ] Error alerts display
- [ ] Form submission succeeds
- [ ] Navigation after success works

**After All Migrations:**
- [ ] Run full test suite: `npm run test`
- [ ] Manual regression test: student registration flow
- [ ] Manual regression test: enrollment creation
- [ ] Manual regression test: payment posting
- [ ] Manual regression test: grade encoding
- [ ] No TypeScript errors: `npm run build`

---

## Critical Files Reference

### Files to Create (Phases 1 & 2)

**Phase 1 - Utilities:**
- `lib/utils/action-guards.ts`
- `lib/utils/audit-logger.ts`
- `lib/utils/error-handlers.ts`
- `lib/utils/currency.ts`
- `lib/utils/query-helpers.ts`
- `lib/validators/common-schemas.ts`

**Phase 2 - Components:**
- `components/forms/FormStateAlert.tsx`
- `components/forms/TextInputField.tsx`
- `components/forms/SelectField.tsx`
- `components/forms/CurrencyInputField.tsx`
- `components/shared/ConfirmActionButton.tsx`

### Files to Modify (Phase 3)

**Server Actions (13 files):**
- `actions/students.ts`
- `actions/enrollments.ts`
- `actions/cashier.ts`
- `actions/finance.ts`
- `actions/school-years.ts`
- `actions/users.ts`
- `actions/academics.ts`
- `actions/teacher.ts`
- `actions/assessments.ts`
- `actions/invoices.ts`
- `actions/registration.ts`
- `actions/auth.ts`
- `actions/portal.ts`

**Validators (9 files):**
- `lib/validators/student.ts`
- `lib/validators/enrollment.ts`
- `lib/validators/cashier.ts`
- `lib/validators/finance.ts`
- `lib/validators/school-year.ts`
- `lib/validators/user.ts`
- `lib/validators/academics.ts`
- `lib/validators/assessment.ts`
- `lib/validators/auth.ts`

**Forms (10+ files):**
- `components/students/StudentForm.tsx`
- `components/students/EditStudentForm.tsx`
- `components/finance/BookletForm.tsx`
- `components/finance/FeeScheduleForm.tsx`
- `components/school-years/SchoolYearForm.tsx`
- `components/users/UserForm.tsx`
- `components/users/EditUserForm.tsx`
- `components/cashier/PostPaymentForm.tsx`
- (And others as identified)

### Files to Delete (Phase 3.4)

After migration complete:
- `components/academics/DeleteSubjectButton.tsx`
- `components/academics/LockGradesButton.tsx`
- `components/academics/RemoveAssignmentButton.tsx`

---

## Expected Outcomes

### Code Quality Improvements

1. **Reduced Duplication:** 1,250+ lines of duplicate code eliminated
2. **Single Source of Truth:** Permission checks, audit logging, error handling all centralized
3. **Consistency:** All forms use same components, same error display patterns
4. **Better DX:** Developers write less boilerplate, focus on business logic
5. **Easier Testing:** Utilities can be unit tested independently
6. **Reduced Bugs:** Centralized logic means bugs fixed once, not 10+ times

### Maintainability Standards (Post-Refactoring)

**Enforce in Code Reviews:**
- ✅ ALWAYS use `requirePermission()` for auth checks (never duplicate session + permission pattern)
- ✅ ALWAYS use `logCreateAction()` / `logUpdateAction()` for audit (never duplicate audit helper)
- ✅ ALWAYS extend `BaseFormState` for form types (never manually define FormState)
- ✅ ALWAYS use `<FormStateAlert />` for error display (never manual alert blocks)
- ✅ ALWAYS use reusable field components (TextInputField, SelectField) over manual `<div className="form-group">`
- ✅ ALWAYS use `<ConfirmActionButton />` for confirm-actions (never create one-off button components)

### Business Logic Guarantee

**NO business logic changes:**
- All validation rules remain identical
- All permission checks remain identical
- All audit logging behavior remains identical
- All error handling behavior remains identical
- All form submission flows remain identical

**Only implementation patterns change (how code is organized, not what it does)**

---

## Risk Mitigation

**Low Risk Phases (1 & 2):**
- Creating new utilities is additive only
- Creating new components doesn't affect existing code
- TypeScript will catch integration issues

**Medium Risk Phase (3):**
- File-by-file migration reduces blast radius
- Each file tested before moving to next
- Old code remains until new code verified

**High Risk Areas:**
- Complex forms like `StudentForm.tsx` require extensive testing
- Multi-step flows (enrollment, payment) need end-to-end testing

**Mitigation Strategy:**
1. Build all utilities first (zero risk, additive)
2. Migrate one file at a time, test thoroughly
3. Keep old code until new code verified
4. Run test suite after each migration
5. Manual regression tests for critical flows

---

## Success Criteria

Refactoring complete when:
- [ ] All 6 Phase 1 utilities created and tested
- [ ] All 5 Phase 2 components created and tested
- [ ] All 13 action files migrated and tested
- [ ] All 9 validator files migrated
- [ ] All 10+ forms migrated
- [ ] All 3 button components replaced and deleted
- [ ] Full test suite passes (`npm run test`)
- [ ] Build succeeds with no errors (`npm run build`)
- [ ] Manual regression tests pass (enrollment, payment, grading flows)
- [ ] CLAUDE.md updated with new patterns

---

## Notes

- **No Breaking Changes:** All existing functionality must work exactly the same
- **Preserve Business Logic:** Only refactor implementation patterns, not business rules
- **Test Thoroughly:** Each migrated file must be tested before moving to next
- **Incremental Commits:** Commit after each file migration for easy rollback
- **Documentation:** Update CLAUDE.md with new patterns after completion
