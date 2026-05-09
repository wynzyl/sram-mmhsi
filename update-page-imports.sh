#!/bin/bash

# Update external imports script - fixes all page imports to use new feature barrel exports

cd "$(dirname "$0")"

echo "=== Updating Page Imports to Use Feature Barrel Exports ==="

# Auth
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/auth"|from "@/features/auth"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/auth"|from "@/features/auth"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/auth/|from "@/features/auth/components/|g' {} \;

# Users
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/users"|from "@/features/users"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/user"|from "@/features/users"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/users/|from "@/features/users/components/|g' {} \;

# School Years
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/school-years"|from "@/features/school-years"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/school-year"|from "@/features/school-years"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/school-years/|from "@/features/school-years/components/|g' {} \;

# Students
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/students"|from "@/features/students"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/student"|from "@/features/students"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/students"|from "@/features/students"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/utils/students-directory-href"|from "@/features/students"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/students/|from "@/features/students/components/|g' {} \;

# Registrations
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/registrations"|from "@/features/registrations"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/registration"|from "@/features/registrations"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/registrations"|from "@/features/registrations"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/registrations/|from "@/features/registrations/components/|g' {} \;

# Enrollments
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/enrollments"|from "@/features/enrollments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/enrollment-confirmation"|from "@/features/enrollments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/enrollment"|from "@/features/enrollments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/intake-documents"|from "@/features/enrollments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/enrollments-queue"|from "@/features/enrollments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/enrollment-registration-context"|from "@/features/enrollments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/enrollments/|from "@/features/enrollments/components/|g' {} \;

# Assessments
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/assessments"|from "@/features/assessments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/assessment"|from "@/features/assessments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/new-assessment-context"|from "@/features/assessments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/queries/assessments"|from "@/features/assessments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/assessments/|from "@/features/assessments/components/|g' {} \;

# Payments (cashier)
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/cashier"|from "@/features/payments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/cashier"|from "@/features/payments"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/cashier/|from "@/features/payments/components/|g' {} \;

# Finance - fee schedules
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/fee-schedules"|from "@/features/finance"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/fee-schedule"|from "@/features/finance"|g' {} \;

# Finance - booklets
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/booklets"|from "@/features/finance"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/booklet"|from "@/features/finance"|g' {} \;

# Finance - invoices
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/invoices"|from "@/features/finance"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/invoice"|from "@/features/finance"|g' {} \;

# Finance - components
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/finance/|from "@/features/finance/components/|g' {} \;

# Academics - subjects
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/academics"|from "@/features/academics"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/academics"|from "@/features/academics"|g' {} \;

# Academics - grades
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/actions/grades"|from "@/features/academics"|g' {} \;
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/lib/validators/grade"|from "@/features/academics"|g' {} \;

# Academics - components
find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "@/components/academics/|from "@/features/academics/components/|g' {} \;

echo "=== Page imports updated to use feature barrel exports ==="
