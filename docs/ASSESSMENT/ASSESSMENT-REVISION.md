Assessment Design Principle

Use this model:

Fee Schedule = reusable template
Assessment = student-specific financial snapshot
Ledger = official accounting record

Do not recreate fee schedules every school year. Create a new fee schedule only when fees change. Once assessment is created, copy the selected fee items into assessment details so historical assessments remain correct even if the fee schedule changes later.

1.  Core Schema Design
    A. Grade Level Group
    Groups grade levels so one fee schedule can apply to many grade levels.

        GradeLevelGroup
        Field Purpose
        id          Primary key
        code        CASA, LOWER_ELEM, HIGHER_ELEM, JHS, SHS
        name        Casa, Grade 1-3, Grade 4-6, Junior High, Senior High
        sortOrder   Display order
        isActive    Enable/disable group

        Example:

        Code        Name                Grade Levels
        CASA        Casa                Junior Casa, Senior Casa, Advance Casa
        LOWER_ELEM  Lower Elementary    Grade 1-3
        HIGHER_ELEM Higher Elementary   Grade 4-6
        JHS Junior  High School         Grade 7-10
        SHS Senior  High School         Grade 11-12

    B. Grade Level
    GradeLevel
    Field Purpose
    id Primary key
    name Grade 1, Grade 2, Grade 7, etc.
    levelOrder Used for promotion sequencing
    groupId Links to GradeLevelGroup
    isActive Enable/disable grade level

        This allows the system to know that Grade 2 uses the LOWER_ELEM fee schedule, while Grade 8 uses the JHS fee schedule.

2.  Fee Schedule Schema
    C. Fee Schedule
    FeeSchedule
    Field Purpose
    id Primary key
    groupId Links schedule to GradeLevelGroup
    scheduleCode Example: CASA-DEFAULT-2026
    name Casa Fee Schedule
    versionNo 1, 2, 3, etc.
    effectiveFrom Date this schedule starts
    effectiveTo Optional end date
    status Draft, Active, Archived
    isDefault Marks default schedule for the group
    createdBy Audit
    approvedBy Optional approval
    createdAt Audit
    Best Practice

    Do not create one fee schedule per school year.
    Create a new schedule only when there is a real fee change.

    Example:

    Schedule Group Effective From Effective To Status
    Lower Elem Fee Schedule v1 Grade 1-3 2024 2028 Active
    Lower Elem Fee Schedule v2 Grade 1-3 2029 null Active

    There is only one ACTIVE for each schedule group
    This is clean, compact, and historically safe.

    D. Fee Item Catalog

        This is the master list of fee names.

        FeeItem
        Field Purpose
        id Primary key
        code TUITION, MISC, BOOKS, PREVIOUS_BALANCE
        name Tuition Fee, Miscellaneous Fee, Books, Previous Balance
        category Tuition, Miscellaneous, Books, Other, Previous Balance
        isSystem True for system-controlled fees like Previous Balance
        isActive Enable/disable
        defaultAccountCode Optional accounting mapping

        Example items:

        Code            Name                Category
        TUITION         Tuition Fee         Tuition
        MISC            Miscellaneous       Fee Miscellaneous
        BOOKS           Books               Books
        UNIFORM         Uniform             Other
        PREVIOUS_BALANCE Previous Balance   Previous Balance

    E. Fee Schedule Items

    These are the fee items inside a specific fee schedule.

        FeeScheduleItem
        Field Purpose
        id Primary key
        feeScheduleId Parent fee schedule
        feeItemId Fee item
        defaultAmount Standard amount
        isRequired Required or optional
        canEditAmount Allow amount override during assessment
        canRemove Allow removal during assessment
        sortOrder Display order
        remarks Optional notes

        Example:

        Schedule Fee Item Amount
        Grade 1-3 Schedule Tuition Fee 30,000
        Grade 1-3 Schedule Miscellaneous Fee 7,500
        Grade 1-3 Schedule Books 5,000 3. Assessment Schema

    F. Assessment Header
    Assessment
    Field Purpose
    id Primary key
    assessmentNo Official assessment number
    enrollmentId Links to enrollment
    studentId Student assessed
    schoolYearId School year of enrollment
    gradeLevelId Grade level during assessment
    gradeLevelGroupId Group used for fee schedule
    feeScheduleId Selected schedule
    status Draft, Posted, Voided
    subtotalAmount Total before discounts
    discountAmount Optional
    previousBalanceAmount Total forwarded previous balance
    totalAssessmentAmount Final amount
    createdBy User who created
    postedBy User who confirmed
    postedAt Posting date
    Rule

        Assessment should be one active posted assessment per enrollment.

        Meaning:

        1 Enrollment = 1 Active Assessment

        If there is a correction, do not silently edit posted assessment. Use:

        Adjustment / Void / Re-assessment

        Money records should not behave like a Google Doc. Once posted, lock it.

    G. Assessment Details
    AssessmentItem
    Field Purpose
    id Primary key
    assessmentId Parent assessment
    feeItemId Original fee item
    sourceFeeScheduleItemId Optional link to template item
    itemCodeSnapshot Fee code copied at assessment time
    itemNameSnapshot Fee name copied at assessment time
    categorySnapshot Category copied at assessment time
    amount Final assessed amount
    quantity Usually 1
    lineTotal Amount x quantity
    sourceType Schedule, Manual, PreviousBalance, Adjustment
    remarks Notes
    Why snapshot fields are important

        If the school changes “Miscellaneous Fee” later to another amount or name, old assessments should not change.

        The old assessment must still show the exact fee name and amount at the time it was created.

3.  Previous Balance Forwarding Schema

    This is the sensitive part. Do not just add previous balance as a random fee and manually zero the old account. That will confuse accounting later.

    Use a proper transfer record.

    H. Balance Forwarding
    BalanceForwarding
    Field Purpose
    id Primary key
    studentId Student
    fromEnrollmentId Old enrollment/account
    toEnrollmentId Current enrollment
    toAssessmentId Current assessment
    amountForwarded Amount transferred
    status Posted, Voided
    forwardedAt Date forwarded
    forwardedBy User
    remarks Reason/details

        This record proves that the old balance was not paid. It was moved.

        Very important distinction.

    I. Ledger Entry

        The ledger should store all official financial movements.

        StudentLedger
        Field Purpose
        id Primary key
        studentId Student
        enrollmentId Related enrollment
        assessmentId Optional
        assessmentItemId Optional
        paymentId Optional
        balanceForwardingId Optional
        transactionDate Date
        transactionType AssessmentCharge, Payment, BalanceForwardIn, BalanceForwardOut, Adjustment
        description Human-readable description
        debitAmount Increases receivable
        creditAmount Decreases receivable
        runningBalance Optional cached balance
        createdBy Audit
        createdAt Audit
        Ledger behavior
        Transaction Debit Credit Effect
        Assessment charge + Student owes more
        Payment + Student owes less
        Previous balance forwarded in + New enrollment owes more
        Previous balance forwarded out + Old enrollment balance becomes zero
        Discount + Student owes less
        Adjustment increase + Student owes more
        Adjustment decrease + Student owes less 5. Previous Balance Handling
        Correct Process

        Suppose student has this old balance:

        SY 2025-2026 Grade 3 Balance: ₱8,000

        Student now enrolls for:

        SY 2026-2027 Grade 4

        During assessment, system detects the old balance.

        Current assessment should show:

        Fee Item Amount
        Tuition Fee ₱35,000
        Miscellaneous Fee ₱8,000
        Books ₱5,000
        Previous Balance ₱8,000
        Total ₱56,000

        At posting, system creates two ledger movements:

        Old Enrollment Ledger
        Type Debit Credit
        BalanceForwardOut ₱8,000

        Old enrollment balance becomes:

        ₱8,000 - ₱8,000 = ₱0

        Status:

        Balance Forwarded
        New Enrollment Ledger
        Type Debit Credit
        BalanceForwardIn / Previous Balance ₱8,000

        New enrollment now carries the previous balance.

        This keeps accounting clean.

        The old account is not “paid”. It is transferred.

4.  Assessment Page UI Design
    Assessment List Page

    Show all students with:

    Enrollment Status = Pending

    Recommended columns:

    Column Purpose
    Student Name Identify student
    Student Type New, Transferee, Old
    School Year Current enrollment year
    Grade Level Selected grade level
    Grade Group Casa, Grade 1-3, etc.
    Previous Balance Warning if exists
    Enrollment Date Sorting
    Action Create Assessment
    Status badges
    Badge Meaning
    Pending Assessment Ready for assessment
    Has Previous Balance Needs forwarding
    No Fee Schedule Setup error
    Assessment Draft Assessment started but not posted
    Assessment Creation Page

    When user clicks a student:

    Section 1: Student Summary

         Show:

         Student Name
         Student ID
         Student Type
         School Year
         Grade Level
         Grade Level Group
         Enrollment Status: Pending

    Section 2: Fee Schedule Selection

         Default behavior:

         Auto-select active default fee schedule based on GradeLevelGroup

         Example:

         Grade Level: Grade 2
             Group: Grade 1-3
             Selected Fee Schedule: Lower Elementary Fee Schedule v1

             Allow manual selection only if user has permission.
             If user changes schedule manually, require admin approval and remarks.

             Reason:
             Manual override without remarks = future accounting headache.

         Section 3: Assessment Items

             Display copied fee items from schedule:

             Fee Item Source Amount Editable
             Tuition Fee Schedule 30,000 No/Yes
             Miscellaneous Fee Schedule 7,500 No/Yes
             Books Schedule 5,000 Yes
             Previous Balance System 8,000 No

             Allow:

             Add Other Fee
             Edit allowed amounts
             Remove optional fees
             Add remarks

             Do not allow editing the Previous Balance amount directly. If it is wrong, fix the old ledger first. Never patch money casually.

         Section 4: Previous Balance Panel

             If previous balance exists, show a clear warning:

             Previous balance detected from SY 2025-2026: ₱8,000
             This amount will be forwarded to the current assessment.
             Old balance will be marked as Balance Forwarded.

             Display:

             Old School Year Old Grade Balance Action
             2025-2026 Grade 3 ₱8,000 Forward

             Recommended default:

             Auto-forward previous balance during assessment posting.

             But show it clearly before posting.

         Section 5: Summary

             Show:

             Summary Amount
             Current Fees ₱48,000
             Previous Balance ₱8,000
             Discounts ₱0
             Total Assessment ₱56,000

             Buttons:

             Save Draft
             Post Assessment
             Cancel

5.  Posting Rules

        When user clicks Post Assessment, execute everything in one database transaction.

        Transaction Steps
        Validate enrollment is still Pending.
        Validate student has no posted assessment for the same enrollment.
        Validate fee schedule is active.
        Copy schedule items into assessment items.
        Add manual fees if any.
        Detect and add previous balance item.
        Create assessment header.
        Create assessment item rows.
        Create ledger debit entries for all assessment charges.
        Create balance forwarding record if previous balance exists.
        Create old enrollment BalanceForwardOut ledger credit.
        Create new enrollment BalanceForwardIn ledger debit.
        Mark old balance as Balance Forwarded.
        Update enrollment status:
        Pending → Assessed
        Lock assessment as Posted.

        This must be atomic. Either all succeed or all fail. No half-posted assessment. Half-posted finance records are where systems go to die.

6.  Status Flow
    Enrollment Status
    Pending → Assessed → Enrolled -> Cancelled

         Meaning:

         Status Meaning
         Pending Enrollment created, waiting for assessment
         Assessed Assessment posted, ready for payment
         Enrolled Payment received based on school policy
         Cancelled Enrollment cancelled manually
         Assessment Status
         Draft → Posted → Voided
         Status Meaning
         Draft Work in progress
         Posted Official assessment
         Voided Cancelled assessment, with audit trail
         Previous Balance Status
         Open → Forwarded → Settled
         Status Meaning
         Open Still unpaid in old enrollment
         Forwarded Moved to current enrollment
         Settled Paid already

7.  Payment Alignment

    Since your actual cashier process accepts a fixed payment amount and not payment per fee item, keep cashier UI simple:

    Total Assessment: ₱56,000
    Paid: ₱10,000
    Balance: ₱46,000
    Input Payment Amount: **\_\_**
    Payment Method: Cash / GCash / Bank Transfer
    OR Number: **\_\_**

    Behind the scenes, payment should create a ledger credit:

    Payment = Credit to Student Receivable

    Optional but recommended: create internal payment allocation using FIFO:

    Oldest charge first
    Previous Balance
    Tuition
    Miscellaneous
    Books
    Other fees

    But do not force the cashier to allocate manually. Cashier should not be doing accounting gymnastics at the counter.

8.  Final Recommended Schema Map

        Minimum clean structure:

        GradeLevelGroup
        ↓
        GradeLevel
        ↓
        Enrollment
        ↓
        Assessment
        ↓
        AssessmentItem
        ↓
        StudentLedger

        Fee template side:

        FeeItem
        ↓
        FeeSchedule
        ↓
        FeeScheduleItem

        Previous balance side:

        BalanceForwarding
        ↓
        StudentLedger

9.  Best Practice Summary

        Use this architecture:

        Grade Level belongs to Grade Level Group.
        Grade Level Group has active Fee Schedule.
        Fee Schedule contains Fee Schedule Items.
        Assessment copies Fee Schedule Items into Assessment Items.
        Assessment posting creates Student Ledger entries.
        Previous Balance is transferred using BalanceForwarding records.
        Old balance is zeroed through ledger credit, not manual editing.
        Current assessment receives Previous Balance as a system-generated fee item.
        Enrollment status changes from Pending to Assessed after posting.

        The most important design decision:

        Fee Schedule is a template. Assessment is the official snapshot. Ledger is the truth.

That gives you a clean school finance system without duplicating yearly fee schedules, while still preserving accounting history.

#Never bypass this if implementing assessment process, if you not sure stop and always ask questions.
