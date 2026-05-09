# Feature Import Reference Guide

Quick reference for importing from the new feature-based structure.

## Standard Features

### Auth
```typescript
// OLD
import { loginAction } from "@/actions/auth";
import { loginSchema } from "@/lib/validators/auth";
import LoginForm from "@/components/auth/LoginForm";

// NEW
import { loginAction, loginSchema, LoginForm } from "@/features/auth";
```

### Users
```typescript
// OLD
import { createUserAction } from "@/actions/users";
import { createUserSchema } from "@/lib/validators/user";
import UserForm from "@/components/users/UserForm";

// NEW
import { createUserAction, createUserSchema, UserForm } from "@/features/users";
```

### Students
```typescript
// OLD
import { createStudentAction } from "@/actions/students";
import { createStudentSchema } from "@/lib/validators/student";
import { getStudentsDirectory } from "@/lib/queries/students-directory";
import { buildStudentDirectoryHref } from "@/lib/utils/students";
import StudentForm from "@/components/students/StudentForm";

// NEW
import { 
  createStudentAction, 
  createStudentSchema,
  getStudentsDirectory,
  buildStudentDirectoryHref,
  StudentForm 
} from "@/features/students";
```

### School Years
```typescript
// OLD
import { createSchoolYearAction } from "@/actions/school-years";
import { createSchoolYearSchema } from "@/lib/validators/school-year";
import SchoolYearForm from "@/components/school-years/SchoolYearForm";

// NEW
import { 
  createSchoolYearAction, 
  createSchoolYearSchema, 
  SchoolYearForm 
} from "@/features/school-years";
```

### Registrations
```typescript
// OLD
import { createRegistrationAction } from "@/actions/students"; // Note: was in students
import { registrationSchema } from "@/lib/validators/registration";
import { getRegistrations } from "@/lib/queries/registrations";
import RegistrationsTable from "@/components/registrations/RegistrationsTable";

// NEW
import { 
  createRegistrationAction,
  registrationSchema,
  getRegistrations,
  RegistrationsTable 
} from "@/features/registrations";
```

---

## Complex Features

### Enrollments
```typescript
// OLD
import { createEnrollmentAction } from "@/actions/enrollments";
import { enrollmentSchema } from "@/lib/validators/enrollment";
import { getEnrollmentQueue } from "@/lib/queries/enrollment-queue";
import { getEnrollmentContext } from "@/lib/queries/enrollment-registration-context";
import EnrollmentWizardForm from "@/components/enrollments/EnrollmentWizardForm";

// NEW
import { 
  createEnrollmentAction,
  enrollmentSchema,
  getEnrollmentQueue,
  getEnrollmentContext,
  EnrollmentWizardForm 
} from "@/features/enrollments";
```

### Assessments
```typescript
// OLD
import { createAssessmentAction } from "@/actions/assessments";
import { assessmentSchema } from "@/lib/validators/assessment";
import { getAssessments } from "@/lib/queries/assessments";
import { getNewAssessmentContext } from "@/lib/queries/new-assessment-context";
import AssessmentDraftForm from "@/components/assessments/AssessmentDraftForm";

// NEW
import { 
  createAssessmentAction,
  assessmentSchema,
  getAssessments,
  getNewAssessmentContext,
  AssessmentDraftForm 
} from "@/features/assessments";
```

### Payments
```typescript
// OLD
import { postPaymentAction } from "@/actions/cashier";
import { paymentSchema } from "@/lib/validators/cashier";
import PaymentPostingForm from "@/components/cashier/PaymentPostingForm";

// NEW
import { 
  postPaymentAction,
  paymentSchema,
  PaymentPostingForm 
} from "@/features/payments";
```

---

## Sub-Module Features

### Finance (Sub-Modules)

#### Fee Schedules
```typescript
// OLD
import { createFeeScheduleAction } from "@/actions/finance";
import { feeScheduleSchema } from "@/lib/validators/finance";
import FeeScheduleForm from "@/components/finance/FeeScheduleForm";

// NEW
import { 
  createFeeScheduleAction,
  feeScheduleSchema,
  FeeScheduleForm 
} from "@/features/finance";
// OR (if you need to be explicit)
import { createFeeScheduleAction } from "@/features/finance/fee-schedules/fee-schedules.actions";
import { feeScheduleSchema } from "@/features/finance/fee-schedules/fee-schedules.schema";
```

#### Booklets
```typescript
// OLD
import { createBookletAction } from "@/actions/finance";
import { bookletSchema } from "@/lib/validators/finance";
import ReceiptBookletForm from "@/components/finance/ReceiptBookletForm";

// NEW
import { 
  createBookletAction,
  bookletSchema,
  ReceiptBookletForm 
} from "@/features/finance";
```

#### Invoices
```typescript
// OLD
import { generateInvoiceAction } from "@/actions/invoices";
import { invoiceSchema } from "@/lib/validators/invoice";
import InvoiceForm from "@/components/finance/InvoiceForm";

// NEW
import { 
  generateInvoiceAction,
  invoiceSchema,
  InvoiceForm 
} from "@/features/finance";
```

### Academics (Sub-Modules)

#### Subjects
```typescript
// OLD
import { createSubjectAction } from "@/actions/academics";
import { subjectSchema } from "@/lib/validators/academics";
import CreateSubjectForm from "@/components/academics/CreateSubjectForm";

// NEW
import { 
  createSubjectAction,
  subjectSchema,
  CreateSubjectForm 
} from "@/features/academics";
// OR (if you need to be explicit)
import { createSubjectAction } from "@/features/academics/subjects/subjects.actions";
import { subjectSchema } from "@/features/academics/subjects/subjects.schema";
```

#### Grades
```typescript
// OLD
import { encodeGradesAction } from "@/actions/teacher";
import { gradeSchema } from "@/lib/validators/academics";
import GradeEncodingTable from "@/components/academics/GradeEncodingTable";

// NEW
import { 
  encodeGradesAction,
  gradeSchema,
  GradeEncodingTable 
} from "@/features/academics";
```

---

## Import Patterns

### Single Feature Import
```typescript
// All related functionality from one feature
import { 
  createStudentAction,
  updateStudentAction,
  createStudentSchema,
  updateStudentSchema,
  StudentForm,
  EditStudentForm
} from "@/features/students";
```

### Multi-Feature Import
```typescript
// When you need multiple features
import { loginAction } from "@/features/auth";
import { createStudentAction } from "@/features/students";
import { createEnrollmentAction } from "@/features/enrollments";
```

### Type-Only Import
```typescript
// Import types separately when needed
import type { CreateStudentInput } from "@/features/students";
```

---

## Migration Checklist

When updating imports in a file:

1. ✅ Identify old import paths
2. ✅ Replace with new feature-based imports
3. ✅ Group related imports from same feature
4. ✅ Verify barrel exports include all needed exports
5. ✅ Test the file compiles
6. ✅ Commit the change

---

## Common Mistakes to Avoid

❌ **Don't** import from internal files directly:
```typescript
// WRONG
import { loginAction } from "@/features/auth/auth.actions";
```

✅ **Do** use barrel exports:
```typescript
// CORRECT
import { loginAction } from "@/features/auth";
```

❌ **Don't** mix old and new import styles:
```typescript
// WRONG
import { loginAction } from "@/features/auth";
import { createStudentAction } from "@/actions/students"; // old path
```

✅ **Do** use consistent new paths:
```typescript
// CORRECT
import { loginAction } from "@/features/auth";
import { createStudentAction } from "@/features/students";
```

---

## Verification Commands

```bash
# Check for remaining old imports (after migration)
grep -r "from \"@/actions/" src/app/
grep -r "from \"@/lib/validators/" src/app/
grep -r "from \"@/components/" src/app/ | grep -v "from \"@/components/ui"
grep -r "from \"@/lib/queries/" src/app/

# Should all return empty after full migration
```
