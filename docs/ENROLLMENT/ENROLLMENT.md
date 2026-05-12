Enrollment Process Design
Core Rule

Use one Enrollment Page as a work queue for all student types.

New / Transferee → Registration → Enrollment List
Old Student → Existing Student Record → Enrollment List
Enrollment Action → Status: Pending
Pending → Assessment List
Assessment Created → Status: Assessed / Ready for Payment
Payment Made → Status: Enrolled

1. Student Entry to Enrollment List
   New / Transferee

New and transferee students must complete registration first.

After registration, they appear in the Enrollment List Page as:

Ready to Enroll

The registrar reviews the registration details, documents, and intended grade level.

Main action:

Confirm Enrollment

After confirmation:

Enrollment Status = Pending
Old Student

Old students should automatically appear in the Enrollment List Page from previous school year records.

They should not register again.

Display:

Previous Grade Level
Suggested Next Grade Level
Previous Balance Status
Clearance Status

Main action:

Confirm Re-Enrollment

After confirmation:

Enrollment Status = Pending 2. Enrollment Page UI
Page Name
Enrollment Management
Main Tabs
Ready to Enroll
Pending
Assessed / Ready for Payment
Enrolled
Cancelled

The registrar mainly works from:

Ready to Enroll 3. Enrollment List Table

Recommended columns:

Column Description
Student Name Main identifier
Student Type New / Transferee / Old
Previous Grade For old students
Enrolling Grade Target grade level
School Year Current enrollment year
Document Status Complete / Incomplete
Balance Status Clear / With Balance
Enrollment Status Ready / Pending / Assessed / Enrolled
Action Enroll / Re-Enroll / Review 4. Enrollment Action Panel

When the registrar clicks a student, open a side panel or detail page.

<For New / Transferee>

Show:

Student Information
Parent/Guardian Information
Requested Grade Level
Document Checklist
Previous School if Transferee
Registration Notes

Button:

Confirm Enrollment

Result:

Status = Pending
Appears in Assessment List
<For New / Transferee>

<For Old Student>
Show:

Student Information
Previous School Year
Previous Grade Level
Suggested Next Grade Level
Balance Status
Clearance Status

Button:
Confirm Re-Enrollment

Result:
Status = Pending
<For Old Student>

Final Recommended Process

NEW / TRANSFEREE:
Registration
→ Enrollment List
→ Confirm Enrollment
→ Pending
→ Assessment List
→ Assessed / Ready for Payment
→ Payment
→ Enrolled

OLD STUDENT:
Existing Student Record
→ Enrollment List
→ Confirm Re-Enrollment
→ Pending
→ Assessment List
→ Assessed / Ready for Payment
→ Payment
→ Enrolled

The best design is list-first enrollment, not form-first enrollment.

Good:
Open Enrollment List → Review student → Confirm Enrollment

Bad:
Open blank form → Search student → Manually rebuild enrollment
