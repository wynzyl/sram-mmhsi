# Form Migration Guide

This guide explains how to migrate existing forms to use the new reusable form components from `components/forms/`.

## Progress

**Phase 3.3 Status:** 1 of 16 forms migrated

### ✅ Migrated Forms
- `components/academics/CreateSubjectForm.tsx`

### 📋 Remaining Forms (15)
- `components/academics/AssignTeacherForm.tsx`
- `components/assessments/AssessmentDraftForm.tsx`
- `components/auth/LoginForm.tsx`
- `components/cashier/PostPaymentForm.tsx`
- `components/enrollments/NewEnrollmentForm.tsx`
- `components/finance/BookletForm.tsx`
- `components/finance/FeeScheduleForm.tsx`
- `components/school-years/EditSchoolYearForm.tsx`
- `components/school-years/SchoolYearForm.tsx`
- `components/students/EditStudentForm.tsx`
- `components/students/GuardianForm.tsx`
- `components/students/StudentForm.tsx` (564 lines - most complex)
- `components/users/EditUserForm.tsx`
- `components/users/ResetPasswordForm.tsx`
- `components/users/UserForm.tsx`

---

## Available Reusable Components

### 1. FormStateAlert
**Purpose:** Standardized error/success message display

**Before:**
```tsx
{state.message && (
  <div className={`alert ${state.success ? 'alert-success' : 'alert-error'}`}>
    {state.message}
  </div>
)}
{state.errors?._form && (
  <div className="alert alert-error">
    {state.errors._form.join(", ")}
  </div>
)}
```

**After:**
```tsx
import { FormStateAlert } from "@/components/forms/FormStateAlert";

<FormStateAlert state={state} />
```

---

### 2. TextInputField
**Purpose:** Reusable controlled text input with error display

**Before:**
```tsx
<div className="form-group">
  <label className="form-label" htmlFor="firstName">
    First Name <span className="required">*</span>
  </label>
  <input
    id="firstName"
    name="firstName"
    type="text"
    className={`form-control ${state.errors?.firstName ? "form-control-error" : ""}`}
    value={firstName}
    onChange={(e) => setFirstName(e.target.value)}
    required
  />
  {state.errors?.firstName && (
    <p className="form-error">{state.errors.firstName[0]}</p>
  )}
</div>
```

**After:**
```tsx
import { TextInputField } from "@/components/forms/TextInputField";

<TextInputField
  label="First Name"
  name="firstName"
  type="text"
  required
  value={firstName}
  onChange={setFirstName}
  error={state.errors?.firstName}
  autoComplete="given-name"
/>
```

**Props:**
- `label` (string, required) - Field label
- `name` (string, required) - HTML name attribute
- `type` (string, optional) - Input type: "text", "email", "tel", "date", "number", "password" (default: "text")
- `required` (boolean, optional) - Shows asterisk in label
- `value` (string, required) - Current value (controlled)
- `onChange` (function, required) - `(value: string) => void`
- `error` (string[], optional) - Field-level errors from `state.errors`
- `autoComplete` (string, optional) - HTML autocomplete attribute
- `placeholder` (string, optional) - Placeholder text
- `disabled` (boolean, optional) - Disable input
- `className` (string, optional) - Additional CSS classes

---

### 3. SelectField
**Purpose:** Reusable select dropdown

**Before:**
```tsx
<div className="form-group">
  <label className="form-label" htmlFor="gradeLevel">
    Grade Level <span className="required">*</span>
  </label>
  <select
    id="gradeLevel"
    name="gradeLevelId"
    className={`form-control ${state.errors?.gradeLevelId ? "form-control-error" : ""}`}
    value={gradeLevelId}
    onChange={(e) => setGradeLevelId(e.target.value)}
    required
  >
    <option value="">Select Grade Level</option>
    {gradeLevels.map((gl) => (
      <option key={gl.id} value={gl.id}>{gl.name}</option>
    ))}
  </select>
  {state.errors?.gradeLevelId && (
    <p className="form-error">{state.errors.gradeLevelId[0]}</p>
  )}
</div>
```

**After:**
```tsx
import { SelectField } from "@/components/forms/SelectField";

<SelectField
  label="Grade Level"
  name="gradeLevelId"
  required
  value={gradeLevelId}
  onChange={setGradeLevelId}
  error={state.errors?.gradeLevelId}
  options={gradeLevels.map((gl) => ({ value: gl.id, label: gl.name }))}
  placeholder="Select Grade Level"
/>
```

**Props:**
- `label` (string, required) - Field label
- `name` (string, required) - HTML name attribute
- `required` (boolean, optional) - Shows asterisk in label
- `value` (string, required) - Current value (controlled)
- `onChange` (function, required) - `(value: string) => void`
- `error` (string[], optional) - Field-level errors
- `options` (array, required) - `Array<{ value: string; label: string }>`
- `placeholder` (string, optional) - Placeholder option text
- `disabled` (boolean, optional) - Disable select

---

### 4. CurrencyInputField
**Purpose:** Currency input with PHP formatting

**Before:**
```tsx
<div className="form-group">
  <label className="form-label" htmlFor="amount">
    Amount <span className="required">*</span>
  </label>
  <input
    id="amount"
    name="amount"
    type="number"
    step="0.01"
    className={`form-control ${state.errors?.amount ? "form-control-error" : ""}`}
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    required
  />
  {state.errors?.amount && (
    <p className="form-error">{state.errors.amount[0]}</p>
  )}
</div>
```

**After:**
```tsx
import { CurrencyInputField } from "@/components/forms/CurrencyInputField";

<CurrencyInputField
  label="Amount"
  name="amount"
  required
  value={amount}
  onChange={setAmount}
  error={state.errors?.amount}
/>
```

---

## Migration Patterns

### Pattern 1: Uncontrolled Form (No Local State)

For simple forms that don't need to track field values in component state, just migrate the alert blocks:

```tsx
// Before
{state.message && <div className="alert">{state.message}</div>}
{state.errors?._form && <div className="alert alert-error">{state.errors._form.join(", ")}</div>}

// After
import { FormStateAlert } from "@/components/forms/FormStateAlert";
<FormStateAlert state={state} />
```

**Example:** `components/academics/CreateSubjectForm.tsx`

---

### Pattern 2: Controlled Form (With Local State)

For forms that track field values in component state (e.g., StudentForm), migrate both alerts and field components:

**Step 1 - Add imports:**
```tsx
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { TextInputField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";
```

**Step 2 - Replace alert blocks:**
```tsx
// Replace all manual alert/error divs with:
<FormStateAlert state={state} />
```

**Step 3 - Replace form fields:**
```tsx
// Old pattern:
<div className="form-group">
  <label>First Name *</label>
  <input name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
  {state.errors?.firstName && <p className="form-error">{state.errors.firstName[0]}</p>}
</div>

// New pattern:
<TextInputField
  label="First Name"
  name="firstName"
  required
  value={firstName}
  onChange={setFirstName}
  error={state.errors?.firstName}
/>
```

---

## Migration Checklist

For each form migration:

- [ ] Import `FormStateAlert` from `@/components/forms/FormStateAlert`
- [ ] Replace manual `state.message` blocks with `<FormStateAlert state={state} />`
- [ ] Replace manual `state.errors?._form` blocks (already handled by FormStateAlert)
- [ ] (Optional) Import field components: `TextInputField`, `SelectField`, `CurrencyInputField`
- [ ] (Optional) Replace manual field patterns with reusable components
- [ ] Test form submission
- [ ] Test validation error display
- [ ] Test success message display
- [ ] Verify no console errors

---

## Estimated Effort

- **Small forms (80-120 lines):** 10-15 minutes
- **Medium forms (150-250 lines):** 20-30 minutes
- **Large forms (350+ lines):** 45-60 minutes
- **StudentForm.tsx (564 lines):** 60-90 minutes

**Total estimated time for all 15 remaining forms:** 6-8 hours

---

## Notes

- **FormStateAlert is always beneficial** - It standardizes error display and handles both form-level and message-level errors automatically
- **Field components are optional** - Only migrate fields if the form uses controlled components (useState for field values)
- **Uncontrolled forms** - If a form doesn't track field values in state, just migrate the alerts
- **Preserve existing functionality** - Migration should not change behavior, only consolidate code
- **Test thoroughly** - Forms are critical user-facing features

---

## Example: Complete Migration

See `components/academics/CreateSubjectForm.tsx` for a working example of:
- FormStateAlert usage
- Clean, consolidated error handling
- Reduced boilerplate code
