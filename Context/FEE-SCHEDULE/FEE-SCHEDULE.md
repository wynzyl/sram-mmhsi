

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

        How do we implement this as a default fees and not every school year and only Change it when there's a changes or increase?
        Thought for a few seconds

        Implement it as a versioned default fee schedule, not a yearly fee schedule.

        Meaning:

        You create FeeSchedule once.
        Use it for many school years.
        Create a new FeeSchedule only when fees change.

        Example:

        FS-2026-V1 = used from SY 2026-2027 until replaced
        FS-2031-V1 = created only when tuition/misc fees increase
        Correct Table Design

1. fee_schedules

        This is the default fee package/version.

        CREATE TABLE fee_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,

        effective_from DATE NOT NULL,
        effective_to DATE,

        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        -- DRAFT, ACTIVE, ARCHIVED

        is_default BOOLEAN DEFAULT FALSE,

        notes TEXT,

        created_by UUID REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
        );
        Example Data
        code	name	effective_from	effective_to	status	default
        FS-2026-V1	Default Fee Schedule 2026	2026-06-01	NULL	ACTIVE	true

        This means this fee schedule will continue to be used until a new one replaces it.

2. fee_schedule_items

        This contains the fee amounts per assessment group.

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
        Do Not Tie FeeSchedule Directly to School Year

        Avoid this as your main rule:

        FeeSchedule per SchoolYear

        That forces you to recreate fees every school year. Tedious and unnecessary.

        Better:

        FeeSchedule applies until replaced.
        Assessment uses the currently active default FeeSchedule.
        Assessment Table Should Store Which Fee Schedule Was Used

        Add this to assessments:

        ALTER TABLE assessments
        ADD COLUMN fee_schedule_id UUID REFERENCES fee_schedules(id);

        So every assessment knows what fee version was used.

        Example:

        Student	School Year	Grade	Fee Schedule Used
        Juan Dela Cruz	2026-2027	Grade 7	FS-2026-V1
        Maria Santos	2027-2028	Grade 8	FS-2026-V1
        Pedro Reyes	2031-2032	Grade 9	FS-2031-V1

        Same schedule, multiple school years. Clean.

        How the System Selects Default Fees

        When creating an assessment:

        1. Get student's grade level
        2. Get grade level's assessment_group_id
        3. Find the active default fee schedule
        4. Load fee_schedule_items for that assessment group
        5. Copy selected fees into assessment_items
        6. Finalize assessment
        7. Post to ledger

        Query example:

        SELECT fsi.*
        FROM fee_schedule_items fsi
        JOIN fee_schedules fs ON fs.id = fsi.fee_schedule_id
        WHERE fs.status = 'ACTIVE'
        AND fs.is_default = TRUE
        AND fsi.assessment_group_id = :assessment_group_id
        AND fsi.is_active = TRUE;
        When Fees Increase

        Do not edit the old active schedule.

        Create a new schedule:

        Old:
        FS-2026-V1 = ARCHIVED / no longer default

        New:
        FS-2031-V1 = ACTIVE / default

        Process:

        1. Duplicate current FeeSchedule
        2. Rename as new version
        3. Update only changed fee amounts
        4. Set old schedule is_default = false
        5. Set new schedule is_default = true
        6. New assessments use the new schedule
        7. Old assessments remain historically correct
        Important Rule

        Never change the amount of a fee schedule item that was already used in finalized assessments.

        Bad:

        Edit Tuition Fee from 28,000 to 32,000 in the same schedule

        Good:

        Create FS-2031-V1 and put Tuition Fee = 32,000 there

        Why? Because old students assessed under the old rate should not magically change. That is accounting horror movie material.

        Recommended Status Flow
        DRAFT → ACTIVE → ARCHIVED

        Only one schedule should be default at a time:

        -- Business rule:
        Only one fee_schedules row can have:
        status = 'ACTIVE'
        AND is_default = TRUE

        If using PostgreSQL, you can enforce it:

        CREATE UNIQUE INDEX one_active_default_fee_schedule
        ON fee_schedules (is_default)
        WHERE is_default = TRUE AND status = 'ACTIVE';
        Final Recommended Model
        fee_items
        - master list of fee names

        fee_schedules
        - versioned default fee package

        fee_schedule_items
        - fee amounts per assessment group

        assessments
        - stores student assessment and fee_schedule_id used

        assessment_items
        - stores copied/snapshotted fees

        student_ledger_entries
        - stores final debit/credit accounting entries

        This gives you exactly what you want:

        No yearly recreation of fees.
        Fees remain default until changed.
        Old assessments remain safe.
        New fee increase uses a new version.

That is the correct setup. Simple, scalable, and not over-engineered.