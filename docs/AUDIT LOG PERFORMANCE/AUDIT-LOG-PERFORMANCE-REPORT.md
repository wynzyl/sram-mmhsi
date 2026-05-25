## PERFORMANCE DASHBOARD REPORT AND MONITORING

Recommended Design
1. Main Page Name

Use:

Activity Monitor

This page changes content based on role.

Page Layout
Top Section: Summary Cards

Show 4–5 cards only.

Example:

Card	Example
Payments Today	₱45,000
New Enrollments	28
Voided Payments	2
Edited Assessments	5
Critical Alerts	1

Good for CEO/Admin because they want quick operational visibility.

Middle Section: Latest Top 5 Important Logs

This is the main list.

Recommended Columns
Column	Purpose
Time	When it happened
Severity	Info / Warning / Critical
Module	Enrollment, Assessment, Cashier
User	Who performed it
Activity	What happened
Reference	Student ID, OR No., Assessment No.
Amount / Status	If applicable
Action	View Details

Example:

Time	Severity	Module	User	Activity	Reference	Amount
10:15 AM	Critical	Cashier	Maria	Payment voided	OR-2026-00045	₱5,000
09:55 AM	Warning	Assessment	Ana	Fee amount edited	SRAMS-2026-00084	₱11,700
09:30 AM	Info	Enrollment	Pedro	Student enrolled	SRAMS-2026-00081	Enrolled
Right Side / Bottom: Alerts Panel

Show only issues that need attention.

Example:

Alert	Meaning
5 failed login attempts	Possible unauthorized access
Backup failed	System risk
Payment voided today	Finance review needed
Assessment edited	Fee control check
OR number skipped	Cashier accountability issue

This is especially useful for Super Admin.

Detail Drawer Design

When user clicks View Details, open a side drawer.

Drawer Should Show
Section	Content
Activity Summary	“Payment voided by Cashier Maria”
User Details	Name, role, IP address
Affected Record	Student, OR number, assessment ID
Before Value	Old amount/status
After Value	New amount/status
Reason	Required for voids, edits, cancellations
Timestamp	Exact date and time

This avoids cluttering the main table.

Role-Based Design
Super Admin View

Design focus: security + system risk

Show:

Failed login attempts
User role changes
Payment voids / OR changes
Assessment edits
Backup / database errors

Best layout:

Summary Cards + Security Alerts + Latest Critical Logs

Admin / CEO View

Design focus: business operation

Show:

Payments today
Voided payments
New enrollments
Assessments created/edited
Cancelled enrollments

Best layout:

Executive Summary Cards + Latest Transaction Logs

Finance View

Design focus: accounts and ledger control

Show:

Assessments created
Assessment edits
Discounts applied
Ledger adjustments
Payment mismatch / corrections

Best layout:

Account Activity Table + Financial Exception Alerts

Registrar View

Design focus: student records and enrollment

Show:

New student registered
Old student added to enrollment
Student information updated
Enrollment status changed
Enrollment cancelled

Best layout:

Enrollment Activity Feed + Student Record Changes

Cashier View

Design focus: collections and OR accountability

Show:

Payment posted
OR number issued
Payment voided
Payment method changed
Daily collection updated

Best layout:

Payment Activity Feed + Daily Collection Summary

Best Visual Design

Use simple severity badges:

Severity	Badge
Info	Blue / Gray
Warning	Yellow / Orange
Critical	Red

Use icons:

Activity	Icon Meaning
Payment	Receipt icon
Enrollment	User-plus icon
Assessment	Calculator icon
Security	Shield icon
Warning	Alert triangle icon
System	Server/database icon

Keep it clean. This is a monitoring page, not a Christmas tree.

Recommended Filters

Keep filters minimal:

Filter	Use
Date Range	Today, Week, Month
Module	Enrollment, Assessment, Cashier
User	Staff activity
Severity	Info, Warning, Critical
Search	Student ID, OR number, name

Default view should always be:

Today + Latest Top 5 Important Logs

Final Recommendation

Use this structure:

Activity Monitor
│
├── Summary Cards
│   ├── Payments Today
│   ├── New Enrollments
│   ├── Edited Assessments
│   ├── Voided Payments
│   └── Critical Alerts
│
├── Latest Top 5 Important Logs
│   ├── Time
│   ├── Severity
│   ├── Module
│   ├── User
│   ├── Activity
│   ├── Reference
│   └── View Details
│
└── Detail Drawer
    ├── Before Value
    ├── After Value
    ├── Reason
    ├── User
    ├── IP Address
    └── Timestamp