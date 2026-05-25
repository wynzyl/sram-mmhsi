# Implement Student-Specific Discount Queue Feature

You are a Senior Software Engineer and Senior Software Architect working on a School Registration and Accounts Monitoring System.

## Objective

Implement a student-specific discount processing feature for assessments.

The current system uses static fees and discounts inside the assessment. This is incorrect because discounts such as ESC, sibling discount, scholarship, and foreign student restrictions are student-specific.

Refactor the assessment and finance workflow so that:

1. Fees remain static and reusable through the existing fee schedule.
2. Discounts are applied per student assessment.
3. Discounts are reviewed and approved through a Finance Discount Queue.
4. Payments are blocked until discount review is resolved.
5. Discounts are posted as negative ledger adjustment lines, not as payments or receipts.

---

## Business Rules

### General Rules

- Foreign Student Restriction as an eligibility/blocking rule
- Fee schedules remain static and reusable.
- Discounts must not be stored as static fee schedule items.
- Discounts must be applied to individual student assessments.
- Assessment must not be finalized until all discount reviews are resolved.
- Cashier must not process payments while discount review is pending.
- Discounts must appear in the assessment and ledger as negative adjustment lines.
- Discounts must not generate receipts.
- Discounts must not be treated as payments.
- Wrong discounts must be reversed, not deleted.

---
## Discount Types
    Implement reusable discount definitions through a Discount Catalog.

    Required discount types:

    ESC Discount
    Sibling Discount
    Manual / Special Discount
    Scholarship Discount, if already supported
    Foreign Student Restriction as an eligibility/blocking rule

        -ESC Discount - fix amount (compose of students from Public and Private)
        -Sibling Discount - percentage
        -Academic Discount - percentage
        -Staff Discount - percentage

        #Applies
            All Discount is Applicable to Tuition FEE Only.

## Expected flow:

Enrollment Pending
→ Assessment Draft
→ Assessment Pending Discount Review
→ Assessment Assessed / Finalized
→ Enrollment Ready for Payment / Assessed
→ Cashier Payment Allowed

## Discount Types


Each discount definition should support:

