Act as a Senior software architect, Senior Engineer, and Senior Developer. Build a School Registration and Accounts Monitoring app for a private K(Casa-Junior Casa-Advance Casa)-Grade 12 school.

User Roles:
- Admin: Super User (can access all pages)
- Registrar: Manage student records and Grades
- Finance Officer: Can view payment status and send digital invoices via Gmail
- Cashier: Process all Payment Transactions (Cash, GCash, Bank Transfer)
- Teacher: Inputs 4 Periodical Grades with Average
- Student and Parent: View account balance, payments, assessment, and grades

Core Features:
- A dashboard for Admins showing 'Total Enrolled' and 'Pending Payments' using 4 key metric cards
- A data table for all registrations with sortable columns for 'Payment Status' (Paid/Unpaid)

This system should solve the following problems:
- tedious form application process
- difficulty finding balances, assessment, and payment records
- difficulty tracking payments
- difficulty locating previous student records

Business Goals:
- The CEO/Admin must have an overview of all document processes and financial transactions for better business analysis
- The Registrar must have fast real-time access to student records
- The Cashier must have daily, weekly, and monthly collection overviews

Critical Cashier / OR Tracking Requirement:
The system must include Official Receipt (OR) tracking as a core accounting workflow.

Required OR Tracking Features:
1. Manual input of serialized OR numbers
2. OR Booklet management
3. Ability to create and manage OR booklets with:
   - booklet name/code
   - starting OR number
   - ending OR number
   - next available OR number
   - active / inactive status
4. Cashier can select which available booklet is currently in use
5. System automatically consumes the next OR serial number when a payment is posted
6. Prevent duplicate OR usage
7. Prevent posting outside booklet range
8. Mark booklet as fully consumed once ending number is reached
9. Every payment transaction must be linked to:
   - OR number
   - OR booklet
   - payment date
   - cashier
   - payment method
   - amount
   - student/account reference
10. Admin and Finance must be able to review OR usage history and collection audit trail
11. Support manual override only for authorized roles, with audit logging
12. Include cashier reports for:
   - daily collections
   - weekly collections
   - monthly collections
   - OR utilization history
   - missing / skipped / voided OR numbers if applicable

Functional Scope:
- Registration and student record management
- Assessment and account balance monitoring
- Payment tracking and payment posting
- Grade encoding for 4 periodical grades with average
- Parent/Student visibility into balances, payments, assessments, and grades
- Executive and operational dashboards
- Cashier collection monitoring and OR control

Integrations:
- Stripe (optional) for tuition payments
- Google Sheets for backup storage
- Gmail integration for digital invoices

Important Integration Rules:
- Google Sheets is for backup/export only, not the main database
- Stripe is optional and should not complicate the core cashier/manual payment process
- Gmail invoice sending must be logged

Design:
- Use a clean, stable, grid-aligned layout
- Use Deep Red as the primary color
- Use Green accents
- Maintain a professional academic feel
- Prioritize readability and operational efficiency over flashy UI

Architecture Expectations:
- Build this as a production-minded web app
- Keep the system modular, maintainable, and scalable
- Separate student master records from registration transactions
- Separate assessment, billing, and payment records properly
- Treat OR tracking as part of the accounting/payment domain, not just a UI field
- Include proper audit logs for critical financial actions
- Design for future expansion without overengineering

Expected Deliverables:
1. System architecture summary
2. Recommended tech stack
3. Folder structure
4. Core database/schema design
5. Role permissions matrix
6. Main modules and routes
7. Registration workflow
8. Payment and assessment workflow
9. OR booklet and OR consumption workflow
10. Grade encoding workflow
11. Dashboard structure
12. Integration plan for Gmail, Stripe, and Google Sheets
13. MVP-first development phases
14. Risks, edge cases, and bad assumptions to avoid

Enrollment cancellation and refunds (SRAMS): Operational refunds are represented by **voiding posted payments** on the student’s assessment ledger (OR stays consumed/voided, never reused). Cancelling an enrollment closes the ledger for new payments; registrars cannot finalize cancellation while collections remain on the ledger until those payments are voided unless an admin uses the audited override path documented with OR workflow.

Important:
- Think like a real architect and builder, not just a UI generator
- Make concrete decisions
- Keep the first version practical and school-operations-friendly
- Do not overengineer, but do not ignore accounting controls
- OR tracking is a critical business requirement and must be treated as a first-class feature