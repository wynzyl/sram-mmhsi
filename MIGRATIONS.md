# Database Migrations

This document provides a reference for all database migrations in the SRAMS project.

## Migration Naming Convention

Migrations follow the format: `XXXX_descriptive_name.sql`

- `XXXX` = Sequential number (0000, 0001, etc.)
- `descriptive_name` = Clear description of the migration type and purpose

## Migration History

### 0000_initial_schema.sql
**Type:** Initial Schema
**Date:** 2024-04-28
**Description:** Creates the complete initial database schema for SRAMS

**Changes:**
- **Enums Created:**
  - `booklet_status` (active, exhausted, voided)
  - `enrollment_status` (pending, assessed, enrolled, cancelled)
  - `grade_status` (draft, submitted, locked)
  - `invoice_status` (draft, sent, viewed, settled, overdue)
  - `or_status` (available, consumed, voided)
  - `payment_status` (pending_confirmation, posted, voided)
  - `registration_status` (pending, approved, rejected)
  - `role` (admin, registrar, finance_officer, cashier, teacher, student, parent_guardian)

- **Tables Created:**
  - `users` - User accounts and authentication
  - `sessions` - User sessions (JWT-based auth)
  - `students` - Student records
  - `parents_guardians` - Parent/guardian information
  - `student_guardian_links` - Student-guardian relationships (many-to-many)
  - `school_years` - Academic years
  - `grade_levels` - Grade level definitions (Kinder, Grade 1-12)
  - `sections` - Class sections per grade level
  - `curriculums` - Curriculum definitions
  - `subjects` - Subject definitions per curriculum
  - `teacher_assignments` - Teacher-subject-section assignments
  - `grade_records` - Student grades per subject per grading period
  - `registrations` - Student registration applications
  - `enrollments` - Confirmed student enrollments
  - `assessments` - Fee assessments per enrollment
  - `assessment_items` - Line items for assessments
  - `receipt_booklets` - OR (Official Receipt) booklet tracking
  - `payments` - Payment transactions
  - `payment_allocations` - Payment distribution across assessment items
  - `invoices` - Invoice records
  - `audit_logs` - System audit trail

**Indexes & Constraints:**
- Unique constraints on critical business keys
- Foreign key relationships established
- Indexes on frequently queried columns

---

### 0001_add_fee_schedules_and_soft_delete.sql
**Type:** Feature Addition + Schema Enhancement
**Date:** 2024-04-29
**Description:** Adds fee schedule management and implements soft delete pattern

**Changes:**
- **Tables Created:**
  - `fee_schedules` - Fee structure templates per grade level and school year
  - `fee_schedule_items` - Line items for fee schedules

- **Columns Added:**
  - `school_years.deleted_at` (timestamp, nullable) - Soft delete timestamp
  - `school_years.deleted_by` (uuid, nullable) - User who soft-deleted the record

- **Indexes Modified:**
  - Dropped `enrollment_unique_sy_idx` (old version)
  - Created new `enrollment_unique_sy_idx` with partial index (WHERE status != 'cancelled')
  - Created `fee_schedule_unique_idx` (school_year_id + grade_level_id)

- **Foreign Keys Added:**
  - Fee schedules linked to school years and grade levels
  - Fee schedule items linked to fee schedules (CASCADE delete)
  - Audit fields (created_by, updated_by) linked to users

---

### 0002_add_curriculums.sql
**Type:** Feature Addition
**Date:** 2024-04-29
**Description:** Implements curriculum management system

**Changes:**
- **Tables Created:**
  - `curriculums` - Curriculum definitions with effective school year

- **Columns Added:**
  - `subjects.curriculum_id` (uuid, NOT NULL) - Links subjects to curriculums

- **Foreign Keys Added:**
  - `curriculums.effective_school_year_id` → `school_years.id`
  - `curriculums.created_by` → `users.id`
  - `subjects.curriculum_id` → `curriculums.id`

**Note:** This migration requires existing subjects to be migrated to a default curriculum before applying.

---

### 0003_add_student_guardian_contact_fields.sql
**Type:** Schema Enhancement
**Date:** 2024-05-01
**Description:** Adds contact information and additional fields to students and guardians

**Changes:**

**Students Table - 6 New Columns:**
1. `lrn` (text, nullable) - Learner Reference Number (DepEd 12-digit ID)
   - Unique constraint added
2. `mobile_number` (text, nullable) - Student contact number
3. `email` (text, nullable) - Student email address
4. `nationality` (text, nullable) - Student nationality
5. `blood_type` (text, nullable) - Student blood type
6. `religion` (text, nullable) - Student religion

**Parents/Guardians Table - 2 New Columns + 2 Constraints:**
1. `address` (text, NOT NULL) - Guardian address
   - Existing records updated with 'N/A' placeholder
2. `occupation` (text, nullable) - Guardian occupation
3. `contact_number` - Changed from nullable to NOT NULL
   - Existing NULL values updated with 'N/A' placeholder
4. `email` - Changed from nullable to NOT NULL
   - Existing NULL values updated with 'noemail@placeholder.com' placeholder

**Constraints Added:**
- `students.lrn` UNIQUE constraint (allows multiple NULL values per SQL standard)

**Backward Compatibility:**
- All student contact fields are nullable (no breaking changes for existing records)
- Guardian fields handle existing NULL data with placeholder values before applying NOT NULL

---

## Migration Best Practices

### Naming Conventions
- **Initial Schema:** `XXXX_initial_schema.sql`
- **Add Table:** `XXXX_add_<table_names>.sql`
- **Modify Table:** `XXXX_update_<table>_<change_description>.sql`
- **Add Constraint:** `XXXX_add_<constraint_type>_to_<table>.sql`
- **Feature Addition:** `XXXX_add_<feature_name>.sql`
- **Schema Enhancement:** `XXXX_enhance_<area>_schema.sql`

### Running Migrations
```bash
# Generate new migration from schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# View database in Drizzle Studio
npm run db:studio
```

### Migration Guidelines
1. **Never modify applied migrations** - Always create new migrations for changes
2. **Include rollback SQL** - Document how to revert changes (in comments or separate file)
3. **Handle existing data** - Use UPDATE statements before applying NOT NULL constraints
4. **Test thoroughly** - Test migrations on development database before production
5. **Keep migrations focused** - One logical change per migration (easier to debug and rollback)
6. **Document breaking changes** - Clearly mark any migrations that require manual intervention

---

## Current Schema Version

**Latest Migration:** `0003_add_student_guardian_contact_fields`
**Total Migrations:** 4
**Last Updated:** 2024-05-01

---

## Rollback Procedures

If you need to rollback a migration, follow these steps:

### Rollback 0003 (Student/Guardian Contact Fields)
```sql
-- Remove student contact fields
ALTER TABLE students DROP COLUMN lrn;
ALTER TABLE students DROP COLUMN mobile_number;
ALTER TABLE students DROP COLUMN email;
ALTER TABLE students DROP COLUMN nationality;
ALTER TABLE students DROP COLUMN blood_type;
ALTER TABLE students DROP COLUMN religion;

-- Revert guardian fields (WARNING: Data loss for address/occupation)
ALTER TABLE parents_guardians DROP COLUMN address;
ALTER TABLE parents_guardians DROP COLUMN occupation;
ALTER TABLE parents_guardians ALTER COLUMN contact_number DROP NOT NULL;
ALTER TABLE parents_guardians ALTER COLUMN email DROP NOT NULL;
```

### Rollback 0002 (Curriculums)
```sql
-- WARNING: Requires reassigning subjects first
ALTER TABLE subjects DROP COLUMN curriculum_id;
DROP TABLE curriculums;
```

### Rollback 0001 (Fee Schedules)
```sql
DROP TABLE fee_schedule_items;
DROP TABLE fee_schedules;
ALTER TABLE school_years DROP COLUMN deleted_at;
ALTER TABLE school_years DROP COLUMN deleted_by;
-- Recreate original enrollment index
```

---

## Migration Checklist

Before creating a new migration:
- [ ] Schema changes are finalized and reviewed
- [ ] Migration naming follows convention
- [ ] Backward compatibility is considered
- [ ] Existing data migration is handled
- [ ] Foreign key constraints are properly defined
- [ ] Indexes are added for performance-critical queries
- [ ] Migration is tested on development database
- [ ] Rollback procedure is documented
- [ ] Team is notified of breaking changes (if any)
