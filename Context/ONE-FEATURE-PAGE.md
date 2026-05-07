## ARCHITECTURE REVISION (Folder and Page)

Do not maintain separate admin/registration and registrar/registration pages if they do the same thing. To avoid duplicate code.

##GOAL architecture is:

One feature page. Different access rules. Different navigation visibility.

Example:

/registration
/enrollment
/assessment
/payments
/students
/grades
/reports
/settings

The Registrar can access /registration.
The Admin can also access /registration.
But the page exists once.

## DO This
(internal) = Admin, Registrar, Cashier, Finance, Teacher
(portal) = Student / Parent

##ROLES
Use RBAC, not folder duplication

    <ROLES/>
    SUPER_ADMIN = (new) system maintenance
    ADMIN = (current) school-wide access and business overview
    REGISTRAR = student records, registration, enrollment
    CASHIER = payment processing
    FINANCE = reports, receivables, invoices
    TEACHER = grade encoding
    STUDENT/PARENT = self-service portal
    </ROLES>

    SUPER_ADMIN
    - Manages system setup, users, roles, database-related settings.

    ADMIN
    - Owner/CEO/Principal level access.
    - Can view all business operations and reports.

    <Final role model>

    Use this role structure:

    <SYSTEM_ADMIN/>
        For system maintenance:
        - Manage users
        - Manage roles
        - School settings
        - Backup/restore
        - Audit logs
        - Fee schedule maintenance
        - School year setup
        - System configuration
    </SYSTEM_ADMIN>

    <ADMIN/>
    - View all dashboards
    - View all students
    - View all enrollment
    - View all assessments
    - View all payments
    - View all reports
    - Override some records if allowed
    </SCHOOL_ADMIN>

    <STAFF/>
    REGISTRAR
    - Student records
    - Registration
    - Enrollment
    - Grades record management
    CASHIER
    - Accept payments
    - Issue OR
    - View balances related to payment processing
    FINANCE
    - View collections
    - Reports
    - Billing
    - Receivables
    - Digital invoices
    TEACHER
    - Encode grades
    - View assigned sections/students
    </STAFF>

    <STUDENT/PARENT/>
    - View own assessment
    - View own balance
    - View own payments
    - View own grades
    <STUDENT/PARENT/>

##Recommended folder structure
    <FOLDER/>
        src/
        app/
            (auth)/
            login/
                page.tsx

            (internal)/
            layout.tsx
            dashboard/
                page.tsx
            students/
                page.tsx
            registration/
                page.tsx
            enrollment/
                page.tsx
            assessment/
                page.tsx
            payments/
                page.tsx
            grades/
                page.tsx
            reports/
                page.tsx
            settings/
                page.tsx

            (portal)/
            student/
                layout.tsx
                account/
                page.tsx
                payments/
                page.tsx
                grades/
                page.tsx

        features/
            registration/
            components/
            actions.ts
            queries.ts
            schema.ts
            permissions.ts

            enrollment/
            components/
            actions.ts
            queries.ts
            schema.ts
            permissions.ts

            assessment/
            components/
            actions.ts
            queries.ts
            schema.ts
            permissions.ts

            payments/
            components/
            actions.ts
            queries.ts
            schema.ts
            permissions.ts

            grades/
            components/
            actions.ts
            queries.ts
            schema.ts
            permissions.ts

        lib/
            auth/
            get-current-user.ts
            permissions.ts
            require-permission.ts

            db/
            index.ts

        components/
            layout/
            internal-sidebar.tsx
            portal-sidebar.tsx
            header.tsx

            ui/
            button.tsx
            input.tsx
            table.tsx
    </FOLDER>

##PERMISSION
    - Each page should check permissions.
    - Also protect server actions
    - Very important: hiding buttons is not security.
    - Frontend permission controls are for user experience.
    - Server-side permission checks are for actual security.

##ARCHITECTURE

    One Next.js app
    One database
    One users table
    One RBAC system
    Feature-based modules
    Shared internal layout
    Separate student/parent portal

    One internal application for Admin + Staff.
    One student/parent portal.
    One canonical page per business feature.
    Role-based access control.
    Permission-based sidebar.
    Shared components, shared services, shared server actions.
    Separate dashboards only when the metrics differ.
    Separate pages only when the workflow truly differs.

##INTERNAL DASHBOARD and MODULE
    @internal dashboard and modules:
    - Dashboard
    - Students
    - Registration
    - Enrollment
    - Assessment
    - Payments
    - Finance
    - Grades
    - Reports
    - Settings

    @student portal:
    - My Account
    - My Assessment
    - My Payments
    - My Grades

#Anything that is not included in this revision will be retain in the current structure.

##AVOID
1. Do not create Admin copies of staff pages
2. Navigation should be permission-based
    @Do not hardcode separate sidebars like this:
    -AdminSidebar
    -RegistrarSidebar
    -CashierSidebar
    -FinanceSidebar
3. Do not change the business logic and process.
4. Do not change the UI design
5. Do not change the schema unless needed.
6. If your not sure with a feature tell to me that you do not know and ask and do not force to implement.