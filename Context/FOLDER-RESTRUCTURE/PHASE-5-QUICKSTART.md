# Phase 5 Quick Start Guide

**Goal:** Update all import paths to use new feature-based structure

---

## Strategy

Update imports incrementally by directory, testing after each batch:

1. App routes (admin → staff → portal → auth)
2. Feature internal cross-imports
3. Shared components
4. Tests

---

## Search & Replace Patterns

### Auth Feature
```bash
# Find
from "@/actions/auth"
# Replace with
from "@/features/auth"

# Find
from "@/lib/validators/auth"
# Replace with
from "@/features/auth"

# Find
from "@/components/auth/
# Replace with
from "@/features/auth"
```

### Users Feature
```bash
# Find
from "@/actions/users"
# Replace with
from "@/features/users"

# Find
from "@/lib/validators/user"
# Replace with
from "@/features/users"

# Find
from "@/components/users/
# Replace with
from "@/features/users"
```

### Students Feature
```bash
# Find
from "@/actions/students"
# Replace with
from "@/features/students"

# Find
from "@/lib/validators/student"
# Replace with
from "@/features/students"

# Find
from "@/lib/queries/students-directory"
# Replace with
from "@/features/students"

# Find
from "@/lib/utils/students"
# Replace with
from "@/features/students"

# Find
from "@/components/students/
# Replace with
from "@/features/students"
```

### Enrollments Feature
```bash
# Find
from "@/actions/enrollments"
from "@/actions/enrollment-confirmation"
# Replace with
from "@/features/enrollments"

# Find
from "@/lib/validators/enrollment"
from "@/lib/validators/enrollment-confirmation"
# Replace with
from "@/features/enrollments"

# Find
from "@/lib/queries/enrollment-queue"
from "@/lib/queries/enrollment-registration-context"
# Replace with
from "@/features/enrollments"

# Find
from "@/components/enrollments/
# Replace with
from "@/features/enrollments"
```

### Assessments Feature
```bash
# Find
from "@/actions/assessments"
# Replace with
from "@/features/assessments"

# Find
from "@/lib/validators/assessment"
# Replace with
from "@/features/assessments"

# Find
from "@/lib/queries/assessments"
from "@/lib/queries/new-assessment-context"
# Replace with
from "@/features/assessments"

# Find
from "@/components/assessments/
# Replace with
from "@/features/assessments"
```

### Payments Feature
```bash
# Find
from "@/actions/cashier"
# Replace with
from "@/features/payments"

# Find
from "@/lib/validators/cashier"
# Replace with
from "@/features/payments"

# Find
from "@/components/cashier/
# Replace with
from "@/features/payments"
```

### Finance Feature
```bash
# Find
from "@/actions/finance"
from "@/actions/invoices"
# Replace with
from "@/features/finance"

# Find
from "@/lib/validators/finance"
from "@/lib/validators/invoice"
# Replace with
from "@/features/finance"

# Find
from "@/components/finance/
# Replace with
from "@/features/finance"
```

### Academics Feature
```bash
# Find
from "@/actions/academics"
from "@/actions/teacher"
# Replace with
from "@/features/academics"

# Find
from "@/lib/validators/academics"
# Replace with
from "@/features/academics"

# Find
from "@/components/academics/
# Replace with
from "@/features/academics"
```

### School Years Feature
```bash
# Find
from "@/actions/school-years"
# Replace with
from "@/features/school-years"

# Find
from "@/lib/validators/school-year"
# Replace with
from "@/features/school-years"

# Find
from "@/components/school-years/
# Replace with
from "@/features/school-years"
```

### Registrations Feature
```bash
# Find
from "@/lib/validators/registration"
# Replace with
from "@/features/registrations"

# Find
from "@/lib/queries/registrations"
# Replace with
from "@/features/registrations"

# Find
from "@/components/registrations/
# Replace with
from "@/features/registrations"
```

---

## Verification Commands

After each batch of changes, run:

```bash
# Check TypeScript compilation
npm run build

# Check for remaining old imports
grep -r "from \"@/actions/" src/app/
grep -r "from \"@/lib/validators/" src/app/
grep -r "from \"@/lib/queries/" src/app/
grep -r "from \"@/components/" src/app/ | grep -v "from \"@/components/ui" | grep -v "from \"@/components/forms" | grep -v "from \"@/components/layout"

# Should return empty results when done
```

---

## Recommended Order

### Batch 1: Admin Routes (High Priority)
```bash
src/app/admin/students/**/*
src/app/admin/enrollments/**/*
src/app/admin/assessments/**/*
src/app/admin/users/**/*
src/app/admin/academics/**/*
```

### Batch 2: Staff Routes
```bash
src/app/staff/registrar/**/*
src/app/staff/finance/**/*
src/app/staff/cashier/**/*
src/app/staff/teacher/**/*
```

### Batch 3: Portal & Auth Routes
```bash
src/app/portal/**/*
src/app/(auth)/**/*
```

### Batch 4: Feature Internal Imports
```bash
src/features/**/components/**/*
```

### Batch 5: Shared Components (if needed)
```bash
components/ui/**/*
components/forms/**/*
components/layout/**/*
```

---

## Testing After Each Batch

1. Run `npm run build`
2. Check for TypeScript errors
3. Fix any import issues
4. Test affected routes in dev mode
5. Commit the batch

---

## Common Issues & Solutions

### Issue: Import not found
**Cause:** Missing export in barrel file
**Solution:** Add export to `src/features/[feature]/index.ts`

### Issue: Circular dependency
**Cause:** Cross-feature imports
**Solution:** Extract shared logic to `lib/utils/`

### Issue: Type not exported
**Cause:** Type not in barrel export
**Solution:** Add `export type { TypeName } from "./file"`

---

## Automation Script (Optional)

Create a script to automate batch replacements:

```bash
#!/bin/bash
# update-imports.sh

# Auth
find src/app -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/@\/actions\/auth/@\/features\/auth/g'
find src/app -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/@\/lib\/validators\/auth/@\/features\/auth/g'

# Add more replacements...

echo "Import paths updated! Run 'npm run build' to verify."
```

**Warning:** Always commit before running bulk replacements. Test thoroughly after.

---

## Progress Tracking

Create a checklist as you go:

```markdown
## Admin Routes
- [ ] app/admin/students/**/*
- [ ] app/admin/enrollments/**/*
- [ ] app/admin/assessments/**/*
- [ ] app/admin/users/**/*
- [ ] app/admin/academics/**/*
- [ ] app/admin/finance/**/*
- [ ] app/admin/settings/**/*

## Staff Routes
- [ ] app/staff/registrar/**/*
- [ ] app/staff/finance/**/*
- [ ] app/staff/cashier/**/*
- [ ] app/staff/teacher/**/*

## Portal & Auth
- [ ] app/portal/**/*
- [ ] app/(auth)/**/*

## Features Internal
- [ ] src/features/**/components/**/*

## Verification
- [ ] Build passes
- [ ] No old import paths remain
- [ ] All routes tested in dev mode
```

---

## When Complete

1. Run final verification
2. Update MIGRATION-STATUS.md to mark Phase 5 complete
3. Proceed to Phase 6 (cleanup)

