#!/bin/bash

# Update imports script - fixes all feature internal imports

cd "$(dirname "$0")"

echo "=== Updating Feature Internal Imports ==="

# Users feature
find src/features/users -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/user"|from "./users.schema"|g' {} \;
find src/features/users -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/users"|from "./users.actions"|g' {} \;

# School Years feature
find src/features/school-years -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/school-year"|from "./school-years.schema"|g' {} \;
find src/features/school-years -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/school-years"|from "./school-years.actions"|g' {} \;

# Students feature
find src/features/students -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/student"|from "./students.schema"|g' {} \;
find src/features/students -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/students"|from "./students.queries"|g' {} \;
find src/features/students -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/utils/student-form-snapshot"|from "./students.utils"|g' {} \;
find src/features/students -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/utils/students-directory-href"|from "./students-directory-href"|g' {} \;
find src/features/students -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/students"|from "./students.actions"|g' {} \;

# Registrations feature
find src/features/registrations -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/registration"|from "./registrations.schema"|g' {} \;
find src/features/registrations -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/registrations"|from "./registrations.queries"|g' {} \;
find src/features/registrations -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/registrations"|from "./registrations.actions"|g' {} \;

# Enrollments feature
find src/features/enrollments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/enrollment"|from "./enrollments.schema"|g' {} \;
find src/features/enrollments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/intake-documents"|from "./enrollments.schema"|g' {} \;
find src/features/enrollments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/enrollments-queue"|from "./enrollments-queue.queries"|g' {} \;
find src/features/enrollments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/enrollment-registration-context"|from "./enrollment-registration-context.queries"|g' {} \;
find src/features/enrollments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/enrollments"|from "./enrollments.actions"|g' {} \;
find src/features/enrollments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/enrollment-confirmation"|from "./enrollment-confirmation.actions"|g' {} \;

# Assessments feature
find src/features/assessments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/assessment"|from "./assessments.schema"|g' {} \;
find src/features/assessments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/new-assessment-context"|from "./new-assessment-context.queries"|g' {} \;
find src/features/assessments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/assessments"|from "./assessments.queries"|g' {} \;
find src/features/assessments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/assessments"|from "./assessments.actions"|g' {} \;

# Payments feature
find src/features/payments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/cashier"|from "./payments.schema"|g' {} \;
find src/features/payments -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/cashier"|from "./payments.actions"|g' {} \;

# Finance feature - fee schedules
find src/features/finance/fee-schedules -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/fee-schedule"|from "./fee-schedules.schema"|g' {} \;
find src/features/finance/fee-schedules -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/fee-schedules"|from "./fee-schedules.actions"|g' {} \;

# Finance feature - booklets
find src/features/finance/booklets -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/booklet"|from "./booklets.schema"|g' {} \;
find src/features/finance/booklets -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/booklets"|from "./booklets.actions"|g' {} \;

# Finance feature - invoices
find src/features/finance/invoices -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/invoice"|from "./invoices.schema"|g' {} \;
find src/features/finance/invoices -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/invoices"|from "./invoices.actions"|g' {} \;

# Finance feature - components (these import from sub-modules)
find src/features/finance/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/fee-schedule"|from "../fee-schedules/fee-schedules.schema"|g' {} \;
find src/features/finance/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/fee-schedules"|from "../fee-schedules/fee-schedules.actions"|g' {} \;
find src/features/finance/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/booklet"|from "../booklets/booklets.schema"|g' {} \;
find src/features/finance/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/booklets"|from "../booklets/booklets.actions"|g' {} \;
find src/features/finance/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/invoice"|from "../invoices/invoices.schema"|g' {} \;
find src/features/finance/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/invoices"|from "../invoices/invoices.actions"|g' {} \;

# Academics feature - subjects
find src/features/academics/subjects -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/academics"|from "./subjects.schema"|g' {} \;
find src/features/academics/subjects -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/academics"|from "./subjects.actions"|g' {} \;

# Academics feature - grades
find src/features/academics/grades -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/grade"|from "./grades.schema"|g' {} \;
find src/features/academics/grades -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/grades"|from "./grades.actions"|g' {} \;

# Academics feature - components (these import from sub-modules)
find src/features/academics/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/academics"|from "../subjects/subjects.schema"|g' {} \;
find src/features/academics/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/academics"|from "../subjects/subjects.actions"|g' {} \;
find src/features/academics/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/grade"|from "../grades/grades.schema"|g' {} \;
find src/features/academics/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/grades"|from "../grades/grades.actions"|g' {} \;

# Auth feature
find src/features/auth -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/auth"|from "./auth.schema"|g' {} \;
find src/features/auth -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/auth"|from "./auth.actions"|g' {} \;

echo "=== Feature internal imports updated ==="
