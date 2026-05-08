Use FeeSchedule as the parent and FeeScheduleItems as the child.
Your fees are not directly per grade level; they are per assessment group.

Clean structure:

AssessmentGroup
FeeItem
FeeSchedule
FeeScheduleItem
Assessment
AssessmentItem
1. Assessment Groups Table

This groups grade levels for fee assessment.

CREATE TABLE assessment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,

  description TEXT,
  sort_order INT DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
Sample Data
code	name	Grade Coverage
CASA	Casa	Junior Casa, Senior Casa, Advance Casa
LOWER_ELEM	Lower Elementary	Grade 1 to Grade 3
HIGHER_ELEM	Higher Elementary	Grade 4 to Grade 6
JHS	Junior High School	Grade 7 to Grade 10
SHS	Senior High School	Grade 11 to Grade 12
2. Link Grade Levels to Assessment Groups

Each grade level belongs to one assessment group.

ALTER TABLE grade_levels
ADD COLUMN assessment_group_id UUID REFERENCES assessment_groups(id);
Example
Grade Level	Assessment Group
Junior Casa	CASA
Senior Casa	CASA
Advance Casa	CASA
Grade 1	LOWER_ELEM
Grade 2	LOWER_ELEM
Grade 3	LOWER_ELEM
Grade 4	HIGHER_ELEM
Grade 5	HIGHER_ELEM
Grade 6	HIGHER_ELEM
Grade 7	JHS
Grade 8	JHS
Grade 9	JHS
Grade 10	JHS
Grade 11	SHS
Grade 12	SHS
3. Fee Items Table

This is your master lookup table of fees.

CREATE TABLE fee_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,

  category VARCHAR(50) NOT NULL,
  -- TUITION, MISC, BOOKS, UNIFORM, OTHER, DISCOUNT

  fee_type VARCHAR(30) NOT NULL DEFAULT 'CHARGE',
  -- CHARGE, DISCOUNT

  description TEXT,

  is_required BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
Sample Fee Items
code	name	category	fee_type	required
TUITION	Tuition Fee	TUITION	CHARGE	Yes
MISC	Miscellaneous Fee	MISC	CHARGE	Yes
BOOKS	Books	BOOKS	CHARGE	No
ID_FEE	ID Fee	OTHER	CHARGE	Yes
PE_UNIFORM	PE Uniform	UNIFORM	CHARGE	No
LAB_FEE	Laboratory Fee	MISC	CHARGE	No
ESC_GRANT	ESC Grant	DISCOUNT	DISCOUNT	No
4. Fee Schedule Table

This is the parent table. Since fees change only every 5 years, this table handles validity periods.

CREATE TABLE fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,

  effective_from_school_year_id UUID NOT NULL REFERENCES school_years(id),
  effective_to_school_year_id UUID REFERENCES school_years(id),

  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, ACTIVE, ARCHIVED

  notes TEXT,

  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
Example
code	name	Effective From	Effective To	status
FS-2026-2030	Fee Schedule 2026-2030	SY 2026-2027	SY 2030-2031	ACTIVE
FS-2031-2035	Fee Schedule 2031-2035	SY 2031-2032	SY 2035-2036	DRAFT
5. Fee Schedule Items Table

This is where each assessment group gets its own fees and amounts.

CREATE TABLE fee_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  fee_schedule_id UUID NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
  assessment_group_id UUID NOT NULL REFERENCES assessment_groups(id),
  fee_item_id UUID NOT NULL REFERENCES fee_items(id),

  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,

  is_default BOOLEAN DEFAULT TRUE,
  is_required BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (fee_schedule_id, assessment_group_id, fee_item_id)
);
Sample Fee Schedule Items
Fee Schedule	Group	Fee Item	Amount
FS-2026-2030	CASA	Tuition Fee	18,000.00
FS-2026-2030	CASA	Miscellaneous Fee	5,000.00
FS-2026-2030	CASA	Books	3,500.00
FS-2026-2030	LOWER_ELEM	Tuition Fee	22,000.00
FS-2026-2030	LOWER_ELEM	Miscellaneous Fee	6,000.00
FS-2026-2030	LOWER_ELEM	Books	4,500.00
FS-2026-2030	HIGHER_ELEM	Tuition Fee	24,000.00
FS-2026-2030	HIGHER_ELEM	Miscellaneous Fee	6,500.00
FS-2026-2030	JHS	Tuition Fee	28,000.00
FS-2026-2030	JHS	Miscellaneous Fee	8,000.00
FS-2026-2030	SHS	Tuition Fee	32,000.00
FS-2026-2030	SHS	Miscellaneous Fee	9,000.00
6. Assessment Item Link

During assessment, selected fee_schedule_items are copied into assessment_items.

Very important: copy the fee name and amount as snapshot. Do not only reference the fee schedule item.

CREATE TABLE assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,

  fee_schedule_item_id UUID REFERENCES fee_schedule_items(id),
  fee_item_id UUID NOT NULL REFERENCES fee_items(id),

  fee_code_snapshot VARCHAR(50) NOT NULL,
  fee_name_snapshot VARCHAR(150) NOT NULL,
  category_snapshot VARCHAR(50) NOT NULL,
  fee_type_snapshot VARCHAR(30) NOT NULL,

  amount NUMERIC(12, 2) NOT NULL,

  created_at TIMESTAMP DEFAULT NOW()
);
Assessment Flow
1. Student is enrolled in a grade level.
2. System checks grade_levels.assessment_group_id.
3. System finds the ACTIVE fee_schedule for the current school year.
4. System loads fee_schedule_items by assessment_group_id.
5. Registrar selects applicable fees.
6. Selected fees are copied to assessment_items.
7. Once finalized, assessment_items are posted to the student ledger.
Example

Student enrolls in Grade 8.

Grade 8 → Assessment Group: JHS
Current SY → 2026-2027
Active Fee Schedule → FS-2026-2030
Load Fees → JHS fees only

Result:

Fee Item	Amount
Tuition Fee	28,000.00
Miscellaneous Fee	8,000.00
Books	5,500.00
ID Fee	250.00

Then these are copied to assessment items and posted to the student ledger.

Best Design Decision

Use this:

FeeSchedule = valid fee package per period, usually 5 years
FeeScheduleItem = actual fee amount per assessment group
FeeItem = reusable fee lookup
AssessmentItem = copied/snapshotted selected fee
LedgerEntry = final accounting debit/credit record

This is better than assigning fees directly to every grade level because your pricing is grouped. Less data duplication, cleaner maintenance, less future headache. Database aspirin, basically.